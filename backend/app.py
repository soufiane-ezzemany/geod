from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import datetime
import logging
import networkx as nx
import threading
import time
import json
import os
import re

app = Flask(__name__)
app.config['SECRET_KEY'] = 'geod-secret-key'
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Backend")

# Global State
class TopologyManager:
    def __init__(self):
        self.graph = nx.DiGraph()
        # Ensure we have at least an empty structure
        self.lock = threading.Lock()

    def add_node(self, node_id, data=None):
        with self.lock:
            self.graph.add_node(node_id, **(data or {}))

    def add_link(self, source, target, data=None):
        with self.lock:
            self.graph.add_edge(source, target, **(data or {}))

    def update_link_stats(self, source, target, stats):
        with self.lock:
            if self.graph.has_edge(source, target):
                # Update existing edge data with new stats (latency, packet_loss, etc.)
                for k, v in stats.items():
                    self.graph[source][target][k] = v
                self.graph[source][target]['last_updated'] = datetime.now().isoformat()
            else:
                # Create if it doesn't exist (dynamic discovery)
                self.graph.add_edge(source, target, **stats, last_updated=datetime.now().isoformat())

    def get_topology_json(self):
        with self.lock:
            return nx.node_link_data(self.graph)
    
    def load_from_dict(self, data):
        with self.lock:
            self.graph = nx.node_link_graph(data)

topology_manager = TopologyManager()

# Map hostname (stable ID) -> current socket SID
hostname_to_sid = {}
# Map sid -> agent info
sid_to_agent = {}

@app.route('/')
def hello_world():
    return 'GeoD Network Monitoring Backend'

@app.route('/api/topology', methods=['GET'])
def get_topology():
    return jsonify(topology_manager.get_topology_json())

@app.route('/api/topology', methods=['POST'])
def update_topology():
    data = request.json
    try:
        topology_manager.load_from_dict(data)
        # Broadcast update to frontend
        socketio.emit('topology_update', topology_manager.get_topology_json())
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/agents', methods=['GET'])
def get_agents():
    return jsonify(list(sid_to_agent.values()))

# --- SocketIO Handlers ---

@socketio.on('connect')
def handle_connect():
    logger.info(f'Client connected: {request.sid}')
    emit('connected', {'message': 'Connected to GeoD Backend'})

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    if sid in sid_to_agent:
        agent = sid_to_agent.pop(sid)
        hostname = agent.get('hostname')
        if hostname and hostname in hostname_to_sid:
            del hostname_to_sid[hostname]
        
            # Mark as offline in topology
            topology_manager.add_node(hostname, data={'status': 'offline'})

            logger.info(f"Agent disconnected: {hostname} ({sid})")
            socketio.server.emit('agent_disconnected', {'agent_id': sid, 'hostname': hostname}, namespace='/')

            # Broadcast updated topology so frontend sees the offline status
            socketio.server.emit('topology_update', topology_manager.get_topology_json(), namespace='/')

@socketio.on('register_agent')
def handle_agent_registration(data):
    sid = request.sid
    hostname = data.get('hostname', 'unknown')
    
    agent_info = {
        'sid': sid,
        'hostname': hostname,
        'ip_address': data.get('ip_address'),
        'os': data.get('os'),
        'connected_at': datetime.now().isoformat(),
        'last_heartbeat': datetime.now().isoformat()
    }
    
    sid_to_agent[sid] = agent_info
    hostname_to_sid[hostname] = sid
    
    # Add to topology graph as a node
    topology_manager.add_node(hostname, data={'ip': data.get('ip_address'), 'type': 'agent', 'status': 'online'})
    
    # Auto-connect to all existing agents (Full Mesh)
    try:
        current_topo = topology_manager.get_topology_json()
        existing_nodes = [n['id'] for n in current_topo.get('nodes', []) if n['id'] != hostname and n.get('type') == 'agent']
        
        for other_node in existing_nodes:
            # Create bidirectional links if they don't exist
            # Note: add_link (via networkx add_edge) updates attributes if edge exists, 
            # so we can safely call it. We set monitoring=True by default.
            topology_manager.add_link(hostname, other_node, {'monitoring': True, 'type': 'auto'})
            topology_manager.add_link(other_node, hostname, {'monitoring': True, 'type': 'auto'})
            logger.info(f"Auto-connected {hostname} <-> {other_node}")
    except Exception as e:
        logger.error(f"Error in auto-connection logic: {e}")

    logger.info(f"Agent registered: {hostname} ({sid})")
    emit('registration_confirmed', {'agent_id': sid, 'status': 'registered'})
    socketio.server.emit('agent_connected', agent_info, namespace='/')
    
    # Broadcast updated topology immediately so new node appears
    socketio.server.emit('topology_update', topology_manager.get_topology_json(), namespace='/')

@socketio.on('heartbeat')
def handle_heartbeat(data):
    sid = request.sid
    if sid in sid_to_agent:
        sid_to_agent[sid]['last_heartbeat'] = datetime.now().isoformat()

@socketio.on('network_stats')
def handle_network_stats(data):
    sid = request.sid
    if sid in sid_to_agent:
        # Broadcast stats to frontend
        socketio.server.emit('network_stats_update', {
            'hostname': sid_to_agent[sid]['hostname'],
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
    
    if sid not in sid_to_agent:
        return

    source_hostname = sid_to_agent[sid]['hostname']

    if command == 'ping' and result_data:
        target_ip = result_data.get('target')
        params = data.get('params', {})
        
        # Primary method: Use echoed target_hostname from params
        target_hostname = params.get('target_hostname')
        
        # Fallback method: Reverse lookup from IP
        if not target_hostname and target_ip:
            for h_name, s_id in hostname_to_sid.items():
                if sid_to_agent[s_id].get('ip_address') == target_ip:
                    target_hostname = h_name
                    break
        
        if target_hostname:
            # Parse ping output to get latency
            output = result_data.get('output', '')
            latency = -1
            
            # Linux/Mac/Unix: time=12.3 ms
            # Windows: Average = 12ms
            
            # Try Linux/Unix pattern first
            # Matches: time=12.3 or time=12.3ms
            linux_match = re.search(r'time=([\d.]+)', output)
            if linux_match:
                try:
                    latency = float(linux_match.group(1))
                except ValueError:
                    pass
            else:
                # Try Windows pattern
                # Matches: Average = 12ms or Average=12ms
                win_match = re.search(r'Average\s*=\s*(\d+)', output)
                if win_match:
                    try:
                        latency = float(win_match.group(1))
                    except ValueError:
                        pass
            
            logger.info(f"Link Update: {source_hostname} -> {target_hostname} : {latency}ms")
            
            if latency > 0:
                topology_manager.update_link_stats(source_hostname, target_hostname, {'latency': latency})
                # Broadcast topology update
                socketio.server.emit('link_stats_update', {
                    'source': source_hostname,
                    'target': target_hostname,
                    'latency': latency
                }, namespace='/')

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
    
    if target_hostname in hostname_to_sid:
        target_sid = hostname_to_sid[target_hostname]
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
        time.sleep(5) # Check every 5 seconds
        
        try:
            # We need a snapshot of the graph to iterate safely
            graph_data = topology_manager.get_topology_json()
            links = graph_data.get('links', [])
            
            for link in links:
                source = link.get('source')
                target = link.get('target')
                
                # Check if both are connected
                if source in hostname_to_sid and target in hostname_to_sid:
                    source_sid = hostname_to_sid[source]
                    target_agent = sid_to_agent[hostname_to_sid[target]]
                    target_ip = target_agent.get('ip_address')
                    
                    if target_ip:
                        # Instruct source to ping target
                        socketio.emit('execute_command', {
                            'command': 'ping',
                            'params': {'target': target_ip, 'count': 1, 'target_hostname': target},
                            'request_id': f"monitor_{source}_{target}_{int(time.time())}"
                        }, room=source_sid)
                        
        except Exception as e:
            logger.error(f"Error in monitor loop: {e}")

# Start background thread
monitor_thread = threading.Thread(target=monitor_links_loop, daemon=True)
monitor_thread.start()

if __name__ == '__main__':

    socketio.run(app, debug=True, host='0.0.0.0', port=5000, allow_unsafe_werkzeug=True)
