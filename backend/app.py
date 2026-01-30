from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import time
import eventlet

eventlet.monkey_patch()

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from application.service_factory import ServiceFactory

app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
CORS(app, origins=settings.CORS_ALLOWED_ORIGINS)
socketio = SocketIO(app, cors_allowed_origins=settings.CORS_ALLOWED_ORIGINS)

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

    target_sid = container.agent_registry.get_sid_by_hostname(target_hostname)
    if target_sid:
        emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': f"req_{int(time.time())}"
        }, room=target_sid)
        return {'status': 'sent'}
    else:
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
                    target_ip = target_agent.ip_address

                    if target_ip:
                        socketio.emit('execute_command', {
                            'command': 'ping',
                            'params': {'target': target_ip, 'count': settings.PING_COUNT, 'target_hostname': target},
                            'request_id': f"monitor_{source}_{target}_{int(time.time())}"
                        }, room=source_sid)

                        socketio.sleep(settings.PING_STAGGER_DELAY_SECONDS)

        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")
socketio.start_background_task(monitor_links_loop)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
