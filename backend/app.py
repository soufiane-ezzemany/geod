from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import datetime
import time
import eventlet

# Monkey patch for Eventlet (Green Threads) concurrency
eventlet.monkey_patch()

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from domain.models.agent import Agent
from infrastructure.parsers.ping_parser import parse_ping_output
from infrastructure.external.prometheus_client import PrometheusClient
from application.services.metrics_service import MetricsService
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.history_service import HistoryService

app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
CORS(app, origins=settings.CORS_ALLOWED_ORIGINS)
# async_mode will auto-detect eventlet
socketio = SocketIO(app, cors_allowed_origins=settings.CORS_ALLOWED_ORIGINS)

# Logging setup
logger = setup_logging()

# Services
prom_client = PrometheusClient()
metrics_service = MetricsService()
agent_registry = AgentRegistry()
topology_service = TopologyService()
history_service = HistoryService(prom_client)

@app.route('/')
def hello_world():
    return 'GeoD Network Monitoring Backend'

@app.route('/api/topology', methods=['GET'])
def get_topology():
    return jsonify(topology_service.get_topology_json())

@app.route('/api/topology', methods=['POST'])
def update_topology():
    data = request.json
    try:
        topology_service.load_from_dict(data)
        # Broadcast update to frontend
        socketio.emit('topology_update', topology_service.get_topology_json())
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/agents', methods=['GET'])
def get_agents():
    return jsonify([agent.to_dict() for agent in agent_registry.get_all()])

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/history', methods=['GET'])
def get_history():
    """
    Get historical metrics data for an agent.
    Query params:
    - hostname: required
    - start: timestamp (seconds)
    - end: timestamp (seconds)
    - step: seconds (resolution, default: 15s)
    """
    hostname = request.args.get('hostname')
    start = request.args.get('start')
    end = request.args.get('end')
    step = request.args.get('step', '15s')

    if not all([hostname, start, end]):
        return jsonify({'error': 'Missing required parameters'}), 400

    try:
        history = history_service.get_agent_history(hostname, start, end, step)
        return jsonify(history)
    except Exception as e:
        logger.error(f"Error fetching history for {hostname}: {e}")
        return jsonify({'error': 'Failed to fetch history'}), 500

# --- SocketIO Handlers ---

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to GeoD Backend'})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    agent = agent_registry.unregister(sid)

    if agent:
        hostname = agent.hostname
        # Mark as offline in topology
        topology_service.add_node(hostname, data={'status': 'offline'})

        logger.info(f"Agent disconnected: {hostname} ({sid})")
        socketio.server.emit('agent_disconnected', {'agent_id': sid, 'hostname': hostname}, namespace='/')

        # Broadcast updated topology so frontend sees the offline status
        socketio.server.emit('topology_update', topology_service.get_topology_json(), namespace='/')

@socketio.on('register_agent')
def handle_agent_registration(data):
    sid = request.sid
    hostname = data.get('hostname', 'unknown')

    agent = Agent(
        sid=sid,
        hostname=hostname,
        ip_address=data.get('ip_address'),
        os=data.get('os'),
        connected_at=datetime.now(),
        last_heartbeat=datetime.now()
    )

    agent_registry.register(agent)

    # Auto-connect to all existing agents (Full Mesh)
    try:
        topology_service.auto_connect_agent(
            hostname,
            {'ip': data.get('ip_address'), 'type': 'agent', 'status': 'online'}
        )

        # Log connections
        existing_nodes = [n for n in topology_service.get_all_agent_nodes() if n != hostname]
        for other_node in existing_nodes:
            logger.info(f"Auto-connected {hostname} <-> {other_node}")
    except Exception as e:
        logger.error(f"Error in auto-connection logic: {e}")

    logger.info(f"Agent registered: {hostname} ({sid})")
    emit('registration_confirmed', {'agent_id': sid, 'status': 'registered'})
    socketio.server.emit('agent_connected', agent.to_dict(), namespace='/')

    # Broadcast updated topology immediately so new node appears
    socketio.server.emit('topology_update', topology_service.get_topology_json(), namespace='/')

@socketio.on('heartbeat')
def handle_heartbeat(data):
    sid = request.sid
    agent = agent_registry.get_by_sid(sid)
    if agent:
        agent.update_heartbeat()

@socketio.on('network_stats')
def handle_network_stats(data):
    sid = request.sid
    agent = agent_registry.get_by_sid(sid)
    if agent:
        # Treat stats as a heartbeat (Alive!)
        agent.update_heartbeat()

        hostname = agent.hostname

        # Update Prometheus Metrics
        try:
            metrics_service.update_system_metrics(hostname, data['system'])
            metrics_service.update_network_metrics(hostname, data['network'])
        except Exception as e:
            logger.error(f"Error updating metrics for {hostname}: {e}")

        # Inject Topology Stats (Latency/Loss)
        topo_stats = topology_service.get_node_average_stats(hostname)
        data['network']['latency_avg'] = topo_stats['latency']
        data['network']['packet_loss_avg'] = topo_stats['packet_loss']

        # Broadcast stats to frontend
        socketio.server.emit('network_stats_update', {
            'hostname': hostname,
            'stats': data,
            'timestamp': datetime.now().isoformat()
        }, namespace='/')

@socketio.on('command_result')
def handle_command_result(data):
    """
    Handle results from agents.
    If it's a 'ping' result, we update the topology link stats.
    """
    sid = request.sid
    command = data.get('command')
    result_data = data.get('data')

    agent = agent_registry.get_by_sid(sid)
    if not agent:
        return

    source_hostname = agent.hostname

    if command == 'ping' and result_data:
        target_ip = result_data.get('target')
        params = data.get('params', {})
        
        # Primary method: Use echoed target_hostname from params
        target_hostname = params.get('target_hostname')
        
        # Fallback method: Reverse lookup from IP
        if not target_hostname and target_ip:
            for agent_item in agent_registry.get_all():
                if agent_item.ip_address == target_ip:
                    target_hostname = agent_item.hostname
                    break
        
        if target_hostname:
            # Parse ping output to get latency and packet loss
            output = result_data.get('output', '')
            latency, packet_loss = parse_ping_output(output)

            logger.info(f"Link Update: {source_hostname} -> {target_hostname} : {latency}ms, {packet_loss}% loss")
            
            # We update if valid latency OR significant packet loss (100% loss might show latency=-1)
            if latency > 0 or packet_loss > 0:
                stats_update = {'latency': latency, 'packet_loss': packet_loss}
                topology_service.update_link_stats(source_hostname, target_hostname, stats_update)

                # Broadcast topology update
                socketio.server.emit('link_stats_update', {
                    'source': source_hostname,
                    'target': target_hostname,
                    'latency': latency,
                    'packet_loss': packet_loss
                }, namespace='/')

                # Update Prometheus Metrics (Link)
                try:
                    metrics_service.update_link_metrics(source_hostname, target_hostname, latency, packet_loss)
                    avgs = topology_service.get_node_average_stats(source_hostname)
                    metrics_service.update_average_metrics(source_hostname, avgs['latency'], avgs['packet_loss'])
                except Exception as e:
                    logger.error(f"Error updating latency metrics: {e}")

    # Only broadcast to console if it's NOT a background monitoring request
    request_id = data.get('request_id', '')
    if not str(request_id).startswith('monitor_'):
        socketio.server.emit('command_result_update', {
            'hostname': source_hostname,
            'result': data
        }, namespace='/')

@socketio.on('trigger_command')
def handle_trigger_command(data):
    """
    Frontend triggers a command on an agent.
    Expects: {'target_hostname': '...', 'command': '...', 'params': {...}}
    """
    target_hostname = data.get('target_hostname')
    command = data.get('command')
    params = data.get('params', {})

    target_sid = agent_registry.get_sid_by_hostname(target_hostname)
    if target_sid:
        emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': f"req_{int(time.time())}"
        }, room=target_sid)
        return {'status': 'sent'}
    else:
        return {'status': 'error', 'message': 'Agent not found'}


# --- Background Monitoring Task ---

def monitor_links_loop():
    """
    Periodically checks defined links and triggers pings.
    """
    while True:
        socketio.sleep(settings.MONITOR_INTERVAL_SECONDS)
        
        try:
            # We need a snapshot of the graph to iterate safely
            graph_data = topology_service.get_topology_json()
            links = graph_data.get('links', [])
            
            for link in links:
                source = link.get('source')
                target = link.get('target')

                # Check if both are connected
                source_sid = agent_registry.get_sid_by_hostname(source)
                target_agent = agent_registry.get_by_hostname(target)

                if source_sid and target_agent:
                    target_ip = target_agent.ip_address

                    if target_ip:
                        # Instruct source to ping target
                        socketio.emit('execute_command', {
                            'command': 'ping',
                            'params': {'target': target_ip, 'count': settings.PING_COUNT, 'target_hostname': target},
                            'request_id': f"monitor_{source}_{target}_{int(time.time())}"
                        }, room=source_sid)

                        # Stagger pings to prevent "thundering herd"
                        socketio.sleep(settings.PING_STAGGER_DELAY_SECONDS) 
                        
        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")

# Start background task using SocketIO's manager
socketio.start_background_task(monitor_links_loop)

if __name__ == '__main__':
    # allow_unsafe_werkzeug is not needed/compatible with standard run in some versions, 
    # but debug=True usually handles it.
    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
