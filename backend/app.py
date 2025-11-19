from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from datetime import datetime
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Store connected agents
connected_agents = {}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/')
def hello_world():
    return 'Network Monitoring Backend'

@app.route('/api/agents', methods=['GET'])
def get_agents():
    """Get list of all connected agents"""
    agents_info = [
        {
            'agent_id': agent_id,
            'hostname': info['hostname'],
            'ip_address': info['ip_address'],
            'connected_at': info['connected_at'],
            'last_heartbeat': info.get('last_heartbeat', info['connected_at'])
        }
        for agent_id, info in connected_agents.items()
    ]
    return jsonify(agents_info)

@app.route('/api/agents/<agent_id>', methods=['GET'])
def get_agent(agent_id):
    """Get specific agent details"""
    if agent_id in connected_agents:
        return jsonify(connected_agents[agent_id])
    return jsonify({'error': 'Agent not found'}), 404

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to backend'})

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f'Client disconnected: {request.sid}')
    # Remove agent from connected list
    if request.sid in connected_agents:
        agent_info = connected_agents.pop(request.sid)
        logger.info(f"Agent {agent_info.get('hostname', 'unknown')} disconnected")
        # Notify other clients about agent disconnection
        emit('agent_disconnected', {'agent_id': request.sid}, broadcast=True, include_self=False)

@socketio.on('register_agent')
def handle_agent_registration(data):
    """Handle agent registration"""
    agent_id = request.sid
    connected_agents[agent_id] = {
        'agent_id': agent_id,
        'hostname': data.get('hostname', 'unknown'),
        'ip_address': data.get('ip_address', 'unknown'),
        'os': data.get('os', 'unknown'),
        'connected_at': datetime.now().isoformat(),
        'last_heartbeat': datetime.now().isoformat()
    }
    logger.info(f"Agent registered: {data.get('hostname')} ({agent_id})")
    emit('registration_confirmed', {'agent_id': agent_id, 'status': 'registered'})
    # Notify other clients about new agent
    emit('agent_connected', connected_agents[agent_id], broadcast=True, include_self=False)

@socketio.on('heartbeat')
def handle_heartbeat(data):
    """Handle agent heartbeat"""
    agent_id = request.sid
    if agent_id in connected_agents:
        connected_agents[agent_id]['last_heartbeat'] = datetime.now().isoformat()
        emit('heartbeat_ack', {'timestamp': datetime.now().isoformat()})

@socketio.on('network_stats')
def handle_network_stats(data):
    """Handle network statistics from agent"""
    agent_id = request.sid
    logger.info(f"Network stats from {agent_id}: {data}")
    # Broadcast stats to all connected clients (e.g., frontend dashboard)
    emit('network_stats_update', {
        'agent_id': agent_id,
        'stats': data,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True, include_self=False)

@socketio.on('command')
def handle_command(data):
    """Send command to specific agent"""
    target_agent_id = data.get('target_agent_id')
    command = data.get('command')
    params = data.get('params', {})
    
    if target_agent_id in connected_agents:
        logger.info(f"Sending command '{command}' to agent {target_agent_id}")
        emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': data.get('request_id')
        }, room=target_agent_id)
        emit('command_sent', {'status': 'sent', 'target_agent_id': target_agent_id})
    else:
        emit('command_error', {'error': 'Agent not found', 'target_agent_id': target_agent_id})

@socketio.on('command_result')
def handle_command_result(data):
    """Handle command execution result from agent"""
    agent_id = request.sid
    logger.info(f"Command result from {agent_id}: {data}")
    # Broadcast result to all clients
    emit('command_result_update', {
        'agent_id': agent_id,
        'result': data,
        'timestamp': datetime.now().isoformat()
    }, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)
