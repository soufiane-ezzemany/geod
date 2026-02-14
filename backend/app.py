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
container.init_chaos_service(lambda *args, **kwargs: socketio.emit(*args, **kwargs))

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

@app.route('/api/chaos/host/<hostname>', methods=['POST'])
def set_host_chaos(hostname):
    data = request.json
    result = container.chaos_service.apply_vm_chaos(
        hostname,
        data.get('rules', []),
        data.get('interface'),
        data.get('mode', 'replace')
    )
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/chaos/host/<hostname>', methods=['DELETE'])
def clear_host_chaos(hostname):
    result = container.chaos_service.clear_vm_chaos(hostname)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/chaos/host/<hostname>', methods=['GET'])
def get_host_chaos(hostname):
    return jsonify({
        'hostname': hostname,
        'rules': [],
        'message': 'Rule listing not yet implemented'
    })

@app.route('/api/chaos/container/<hostname>', methods=['POST'])
def set_container_chaos(hostname):
    data = request.json
    container_id = data.get('container_id')
    if not container_id:
        return jsonify({'error': 'container_id required'}), 400

    result = container.chaos_service.apply_container_chaos(
        hostname,
        container_id,
        data.get('rules', []),
        data.get('mode', 'replace')
    )
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/chaos/container/<hostname>/<container_id>', methods=['DELETE'])
def clear_container_chaos(hostname, container_id):
    result = container.chaos_service.clear_container_chaos(hostname, container_id)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)


@app.route('/api/services', methods=['GET'])
def get_services():
    return jsonify({
        'services': container.container_registry.get_all(),
        'agents': [agent.to_dict() for agent in container.agent_registry.get_all()]
    })


@app.route('/api/chaos/service/<service_name>', methods=['POST'])
def set_service_chaos(service_name):
    data = request.json
    result = container.chaos_service.apply_service_chaos(
        service_name,
        data.get('rules', []),
        data.get('mode', 'replace')
    )
    if 'error' in result:
        return jsonify({'error': result['error'], 'hint': result.get('hint')}), result.get('status_code', 400)
    return jsonify(result)


@app.route('/api/chaos/service/<service_name>', methods=['DELETE'])
def clear_service_chaos(service_name):
    result = container.chaos_service.clear_service_chaos(service_name)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)


@app.route('/api/discover', methods=['POST'])
def trigger_discovery():
    result = container.chaos_service.trigger_discovery()
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to GeoD Backend'})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    agent = container.agent_event_handler.handle_disconnection(sid)

    if agent:
        container.container_registry.remove_agent(agent.hostname)

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

    if command == 'discover_containers' and result_data:
        agent = container.agent_registry.get_by_sid(sid)
        if agent:
            containers_list = result_data.get('containers', [])
            container.container_registry.update_containers(agent.hostname, containers_list)

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
