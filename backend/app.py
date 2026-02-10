# CRITICAL: monkey_patch MUST be the first thing before any other imports
import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import time

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from application.service_factory import ServiceFactory

app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

# Extended ping timeout for Grid5000 network latency
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    ping_timeout=60,
    ping_interval=25,
    logger=False,
    engineio_logger=False
)

logger = setup_logging()
container = ServiceFactory()

@app.route('/')
def hello_world():
    return 'GeoD Network Monitoring Backend'

@app.route('/api/topology', methods=['GET'])
def get_topology():
    return jsonify(container.topology_service.get_topology_json())

@app.route('/api/topology', methods=['POST'])
def update_topology():
    data = request.json
    try:
        container.topology_service.load_from_dict(data)
        socketio.emit('topology_update', container.topology_service.get_topology_json())
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/agents', methods=['GET'])
def get_agents():
    return jsonify([agent.to_dict() for agent in container.agent_registry.get_all()])

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/history', methods=['GET'])
def get_history():
    hostname = request.args.get('hostname')
    start = request.args.get('start')
    end = request.args.get('end')
    step = request.args.get('step', '15s')

    if not all([hostname, start, end]):
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        history = container.history_service.get_agent_history(hostname, start, end, step)
        return jsonify(history)
    except Exception as e:
        logger.error(f"Error fetching history for {hostname}: {e}")
        return jsonify({'error': 'Failed to fetch history'}), 500

@app.route('/api/chaos/rules/<hostname>', methods=['POST'])
def set_chaos_rules(hostname):
    data = request.json
    rules = data.get('rules', [])
    interface = data.get('interface')
    mode = data.get('mode', 'replace')

    target_sid = container.agent_registry.get_sid_by_hostname(hostname)
    if not target_sid:
        return jsonify({'error': 'Agent not found'}), 404

    socketio.emit('execute_command', {
        'command': 'chaos_control',
        'params': {
            'rules': rules,
            'interface': interface,
            'mode': mode
        },
        'request_id': f"chaos_{int(time.time())}"
    }, room=target_sid)

    return jsonify({
        'status': 'sent',
        'hostname': hostname,
        'rules_count': len(rules)
    })

@app.route('/api/chaos/rules/<hostname>', methods=['DELETE'])
def clear_chaos_rules(hostname):
    target_sid = container.agent_registry.get_sid_by_hostname(hostname)
    if not target_sid:
        return jsonify({'error': 'Agent not found'}), 404

    socketio.emit('execute_command', {
        'command': 'chaos_control',
        'params': {'rules': []},
        'request_id': f"chaos_clear_{int(time.time())}"
    }, room=target_sid)

    return jsonify({
        'status': 'cleared',
        'hostname': hostname
    })

@app.route('/api/chaos/rules/<hostname>', methods=['GET'])
def get_chaos_rules(hostname):
    return jsonify({
        'hostname': hostname,
        'rules': [],
        'message': 'Rule listing not yet implemented'
    })

@app.route('/api/containers', methods=['GET'])
def get_containers():
    agent_hostname = request.args.get('agent')
    if not agent_hostname:
        return jsonify({'error': 'agent parameter required'}), 400

    target_sid = container.agent_registry.get_sid_by_hostname(agent_hostname)
    if not target_sid:
        return jsonify({'error': 'Agent not found'}), 404

    socketio.emit('execute_command', {
        'command': 'discover_containers',
        'params': {
            'network': request.args.get('network'),
            'include_stopped': request.args.get('include_stopped', 'false').lower() == 'true'
        },
        'request_id': f"containers_{int(time.time())}"
    }, room=target_sid)

    return jsonify({'status': 'request_sent', 'agent': agent_hostname})

@app.route('/api/chaos/external/<hostname>', methods=['POST'])
def set_external_chaos(hostname):
    data = request.json
    container_id = data.get('container_id')
    rules = data.get('rules', [])
    mode = data.get('mode', 'replace')

    if not container_id:
        return jsonify({'error': 'container_id required'}), 400

    target_sid = container.agent_registry.get_sid_by_hostname(hostname)
    if not target_sid:
        return jsonify({'error': 'Agent not found'}), 404

    socketio.emit('execute_command', {
        'command': 'external_chaos_control',
        'params': {
            'container_id': container_id,
            'rules': rules,
            'mode': mode
        },
        'request_id': f"ext_chaos_{int(time.time())}"
    }, room=target_sid)

    return jsonify({
        'status': 'sent',
        'agent': hostname,
        'container_id': container_id,
        'rules_count': len(rules)
    })

@app.route('/api/chaos/external/<hostname>/<container_id>', methods=['DELETE'])
def clear_external_chaos(hostname, container_id):
    target_sid = container.agent_registry.get_sid_by_hostname(hostname)
    if not target_sid:
        return jsonify({'error': 'Agent not found'}), 404

    socketio.emit('execute_command', {
        'command': 'external_chaos_control',
        'params': {
            'container_id': container_id,
            'rules': []
        },
        'request_id': f"ext_chaos_clear_{int(time.time())}"
    }, room=target_sid)

    return jsonify({
        'status': 'cleared',
        'agent': hostname,
        'container_id': container_id
    })

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to GeoD Backend'})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    agent = container.agent_event_handler.handle_disconnection(sid)

    if agent:
        socketio.server.emit('agent_disconnected', {
            'agent_id': sid,
            'hostname': agent.hostname
        }, namespace='/')
        socketio.server.emit('topology_update', container.agent_event_handler.get_topology_snapshot(), namespace='/')

@socketio.on('register_agent')
def handle_agent_registration(data):
    sid = request.sid
    agent = container.agent_event_handler.handle_registration(sid, data)

    emit('registration_confirmed', {'agent_id': sid, 'status': 'registered'})
    socketio.server.emit('agent_connected', agent.to_dict(), namespace='/')
    socketio.server.emit('topology_update', container.agent_event_handler.get_topology_snapshot(), namespace='/')

@socketio.on('heartbeat')
def handle_heartbeat(data):
    sid = request.sid
    container.agent_event_handler.handle_heartbeat(sid)

@socketio.on('network_stats')
def handle_network_stats(data):
    sid = request.sid
    enriched_stats = container.agent_event_handler.handle_network_stats(sid, data)

    if enriched_stats:
        socketio.server.emit('network_stats_update', enriched_stats, namespace='/')

@socketio.on('command_result')
def handle_command_result(data):
    sid = request.sid
    command = data.get('command')
    result_data = data.get('data')
    params = data.get('params', {})

    update_info = container.command_handler.handle_command_result(
        sid, command, result_data, params
    )

    if update_info:
        socketio.server.emit('link_stats_update', update_info, namespace='/')

    request_id = data.get('request_id', '')
    if not container.command_handler.is_monitoring_request(request_id):
        agent = container.agent_registry.get_by_sid(sid)
        if agent:
            socketio.server.emit('command_result_update', {
                'hostname': agent.hostname,
                'result': data
            }, namespace='/')

@socketio.on('trigger_command')
def handle_trigger_command(data):
    target_hostname = data.get('target_hostname')
    command = data.get('command')
    params = data.get('params', {})

    logger.info(f"Received trigger_command: {command} for {target_hostname} with params: {params}")

    target_sid = container.agent_registry.get_sid_by_hostname(target_hostname)
    if target_sid:
        logger.info(f"Forwarding {command} to agent {target_hostname} (sid: {target_sid})")
        emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': f"req_{int(time.time())}"
        }, room=target_sid)
        return {'status': 'sent'}
    else:
        logger.warning(f"Agent not found: {target_hostname}")
        return {'status': 'error', 'message': 'Agent not found'}

def monitor_links_loop():
    """Periodically checks defined links and triggers pings."""
    while True:
        socketio.sleep(settings.MONITOR_INTERVAL_SECONDS)

        try:
            graph_data = container.topology_service.get_topology_json()
            links = graph_data.get('links', [])

            for link in links:
                source = link.get('source')
                target = link.get('target')

                source_sid = container.agent_registry.get_sid_by_hostname(source)
                target_agent = container.agent_registry.get_by_hostname(target)

                if source_sid and target_agent:
                    # Use hostname for ping in Docker Swarm overlay networks
                    # IP addresses from bridge network don't route properly in overlay
                    target_hostname = target_agent.hostname

                    if target_hostname:
                        socketio.emit('execute_command', {
                            'command': 'ping',
                            'params': {'target': target_hostname, 'count': settings.PING_COUNT, 'target_hostname': target},
                            'request_id': f"monitor_{source}_{target}_{int(time.time())}"
                        }, room=source_sid)

                        socketio.sleep(settings.PING_STAGGER_DELAY_SECONDS)

        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")
socketio.start_background_task(monitor_links_loop)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
