# CRITICAL: monkey_patch MUST be the first thing before any other imports
import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flasgger import Swagger
import time
import logging

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from application.service_factory import ServiceFactory

app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
app.config['SWAGGER'] = {
    'title': 'GeoD Network Monitoring API',
    'uiversion': 3,
    'version': '1.0.0',
    'description': 'API for network monitoring and chaos engineering control.'
}
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
Swagger(app)

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
    """
    Root endpoint.
    ---
    tags:
      - System
    responses:
      200:
        description: Welcome message
    """
    return 'GeoD Network Monitoring Backend'

@app.route('/api/topology', methods=['GET'])
def get_topology():
    """
    Get current network topology.
    ---
    tags:
      - Topology
    responses:
      200:
        description: Topology graph data
    """
    return jsonify(container.topology_service.get_topology_json())

@app.route('/api/topology', methods=['POST'])
def update_topology():
    """
    Update topology structure.
    ---
    tags:
      - Topology
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
    responses:
      200:
        description: Topology updated
      400:
        description: Invalid data
    """
    data = request.json
    try:
        container.topology_service.load_from_dict(data)
        socketio.emit('topology_update', container.topology_service.get_topology_json())
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/agents', methods=['GET'])
def get_agents():
    """
    List connected agents.
    ---
    tags:
      - Agents
    responses:
      200:
        description: List of connected agents
    """
    return jsonify([agent.to_dict() for agent in container.agent_registry.get_all()])

@app.route('/metrics')
def metrics():
    """
    Prometheus metrics endpoint.
    ---
    tags:
      - Monitoring
    responses:
      200:
        description: Prometheus metrics
    """
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/history', methods=['GET'])
def get_history():
    """
    Get historical metrics for an agent.
    ---
    tags:
      - Monitoring
    parameters:
      - name: hostname
        in: query
        type: string
        required: true
      - name: start
        in: query
        type: string
        required: true
      - name: end
        in: query
        type: string
        required: true
      - name: step
        in: query
        type: string
        default: 15s
    responses:
      200:
        description: Historical data
      400:
        description: Missing parameters
    """
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
    """
    Apply advanced chaos rules to a host.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: hostname
        in: path
        type: string
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            rules:
              type: array
              items:
                type: object
            interface:
              type: string
            mode:
              type: string
              enum: [replace, append]
    responses:
      200:
        description: Rules applied
      400:
        description: Error applying rules
    """
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
    """
    Clear all chaos rules from a host.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: hostname
        in: path
        type: string
        required: true
    responses:
      200:
        description: Rules cleared
    """
    result = container.chaos_service.clear_vm_chaos(hostname)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/chaos/host/<hostname>', methods=['GET'])
def get_host_chaos(hostname):
    """
    Get active chaos rules for a host.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: hostname
        in: path
        type: string
        required: true
    responses:
      200:
        description: Current rules
    """
    return jsonify({
        'hostname': hostname,
        'rules': [],
        'message': 'Rule listing not yet implemented'
    })

@app.route('/api/chaos/container/<hostname>', methods=['POST'])
def set_container_chaos(hostname):
    """
    Apply advanced chaos rules to a container.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: hostname
        in: path
        type: string
        required: true
        description: Agent hostname managing the container
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - container_id
          properties:
            container_id:
              type: string
            rules:
              type: array
              items:
                type: object
            mode:
              type: string
              enum: [replace, append]
    responses:
      200:
        description: Rules applied
      400:
        description: Error applying rules
    """
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
    """
    Clear chaos rules from a container.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: hostname
        in: path
        type: string
        required: true
      - name: container_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Rules cleared
    """
    result = container.chaos_service.clear_container_chaos(hostname, container_id)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)


@app.route('/api/services', methods=['GET'])
def get_services():
    """
    List discovered services and containers.
    ---
    tags:
      - Services
    responses:
      200:
        description: List of services and agents
    """
    return jsonify({
        'services': container.container_registry.get_all(),
        'agents': [agent.to_dict() for agent in container.agent_registry.get_all()]
    })


@app.route('/api/chaos/service/<service_name>', methods=['POST'])
def set_service_chaos(service_name):
    """
    Apply advanced chaos rules to a service.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: service_name
        in: path
        type: string
        required: true
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            rules:
              type: array
              items:
                type: object
            mode:
              type: string
              enum: [replace, append]
    responses:
      200:
        description: Rules applied
    """
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
    """
    Clear chaos rules from a service.
    ---
    tags:
      - Chaos (Advanced)
    parameters:
      - name: service_name
        in: path
        type: string
        required: true
    responses:
      200:
        description: Rules cleared
    """
    result = container.chaos_service.clear_service_chaos(service_name)
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)


@app.route('/api/discover', methods=['POST'])
def trigger_discovery():
    """
    Trigger container discovery on all agents.
    ---
    tags:
      - Services
    responses:
      200:
        description: Discovery triggered
    """
    result = container.chaos_service.trigger_discovery()
    if 'error' in result:
        return jsonify({'error': result['error']}), result.get('status_code', 400)
    return jsonify(result)

# --- QUICK ACTION ENDPOINTS ---

@app.route('/api/actions/network/latency', methods=['POST'])
def quick_latency():
    """
    Quickly add network latency.
    ---
    tags:
      - Quick Actions
    description: Simplify adding latency to a host, container, or service.
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - target
            - latency
          properties:
            target:
              type: string
              description: Hostname, container ID, or Service Name
            target_type:
              type: string
              enum: [host, container, service]
              default: host
            latency:
              type: string
              description: Latency value (e.g., '100ms')
            jitter:
              type: string
              description: Jitter value (e.g., '10ms')
            host_for_container:
              type: string
              description: (Required if target_type=container) Hostname of the agent
    responses:
      200:
        description: Latency applied
      400:
        description: Invalid input
    """
    data = request.json
    target = data.get('target')
    latency = data.get('latency')
    jitter = data.get('jitter')
    target_type = data.get('target_type', 'host')
    
    if not target or not latency:
        return jsonify({'error': 'target and latency are required'}), 400

    latency_val = f"{latency} {jitter}" if jitter else latency
    rule = {
        "effects": {"latency": latency_val}
    }
    
    if target_type == 'host':
        result = container.chaos_service.apply_vm_chaos(target, [rule])
    elif target_type == 'service':
        result = container.chaos_service.apply_service_chaos(target, [rule])
    elif target_type == 'container':
        host = data.get('host_for_container')
        if not host:
             return jsonify({'error': 'host_for_container required for container target'}), 400
        result = container.chaos_service.apply_container_chaos(host, target, [rule])
    else:
        return jsonify({'error': 'Invalid target_type'}), 400

    if 'error' in result:
        return jsonify(result), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/actions/network/loss', methods=['POST'])
def quick_loss():
    """
    Quickly add packet loss.
    ---
    tags:
      - Quick Actions
    description: Simplify adding packet loss to a host, container, or service.
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - target
            - loss
          properties:
            target:
              type: string
              description: Hostname, container ID, or Service Name
            target_type:
              type: string
              enum: [host, container, service]
              default: host
            loss:
              type: string
              description: Loss percentage (e.g., '10%')
            host_for_container:
              type: string
              description: (Required if target_type=container) Hostname of the agent
    responses:
      200:
        description: Loss applied
      400:
        description: Invalid input
    """
    data = request.json
    target = data.get('target')
    loss = data.get('loss')
    target_type = data.get('target_type', 'host')
    
    if not target or not loss:
        return jsonify({'error': 'target and loss are required'}), 400

    rule = {
        "effects": {"loss": loss}
    }
    
    if target_type == 'host':
        result = container.chaos_service.apply_vm_chaos(target, [rule])
    elif target_type == 'service':
        result = container.chaos_service.apply_service_chaos(target, [rule])
    elif target_type == 'container':
        host = data.get('host_for_container')
        if not host:
             return jsonify({'error': 'host_for_container required for container target'}), 400
        result = container.chaos_service.apply_container_chaos(host, target, [rule])
    else:
        return jsonify({'error': 'Invalid target_type'}), 400

    if 'error' in result:
        return jsonify(result), result.get('status_code', 400)
    return jsonify(result)

@app.route('/api/actions/network/clear', methods=['POST'])
def quick_clear():
    """
    Quickly clear all rules.
    ---
    tags:
      - Quick Actions
    description: Clear rules from a host, container, or service.
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - target
          properties:
            target:
              type: string
              description: Hostname, container ID, or Service Name
            target_type:
              type: string
              enum: [host, container, service]
              default: host
            host_for_container:
              type: string
              description: (Required if target_type=container) Hostname of the agent
    responses:
      200:
        description: Rules cleared
      400:
        description: Invalid input
    """
    data = request.json
    target = data.get('target')
    target_type = data.get('target_type', 'host')
    
    if not target:
        return jsonify({'error': 'target is required'}), 400

    if target_type == 'host':
        result = container.chaos_service.clear_vm_chaos(target)
    elif target_type == 'service':
        result = container.chaos_service.clear_service_chaos(target)
    elif target_type == 'container':
        host = data.get('host_for_container')
        if not host:
             return jsonify({'error': 'host_for_container required for container target'}), 400
        result = container.chaos_service.clear_container_chaos(host, target)
    else:
        return jsonify({'error': 'Invalid target_type'}), 400

    if 'error' in result:
        return jsonify(result), result.get('status_code', 400)
    return jsonify(result)

# --- SOCKET.IO HANDLERS ---

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

@app.route('/api/commands/execute', methods=['POST'])
def execute_agent_command():
    """
    Execute a generic command on a target agent.
    ---
    tags:
      - Agents
    description: This endpoint forwards a specified command and parameters to a target agent via WebSocket.
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - target_hostname
            - command
          properties:
            target_hostname:
              type: string
              description: The hostname of the agent to execute the command on.
            command:
              type: string
              description: The command to execute (e.g., 'ping', 'list_connections').
            params:
              type: object
              description: Parameters for the command.
    responses:
      200:
        description: Command successfully sent to agent.
      404:
        description: Agent not found.
      400:
        description: Invalid request.
    """
    data = request.json
    target_hostname = data.get('target_hostname')
    command = data.get('command')
    params = data.get('params', {})

    if not target_hostname or not command:
        return jsonify({'status': 'error', 'message': 'target_hostname and command are required'}), 400

    logger.info(f"Received REST command: {command} for {target_hostname} with params: {params}")

    target_sid = container.agent_registry.get_sid_by_hostname(target_hostname)
    if target_sid:
        logger.info(f"Forwarding {command} to agent {target_hostname} (sid: {target_sid})")
        socketio.emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': f"req_{int(time.time())}"
        }, room=target_sid, namespace='/') # Explicitly specify namespace if not default
        return jsonify({'status': 'sent', 'message': 'Command sent to agent'})
    else:
        logger.warning(f"Agent not found: {target_hostname}")
        return jsonify({'status': 'error', 'message': 'Agent not found'}), 404


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