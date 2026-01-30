from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from datetime import datetime
import networkx as nx
import threading
import time
import json
import os
import re
import functools
import requests
import eventlet

# Monkey patch for Eventlet (Green Threads) concurrency
eventlet.monkey_patch()

from prometheus_client import Gauge, generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from domain.models.agent import Agent
from infrastructure.parsers.ping_parser import parse_ping_output

app = Flask(__name__)
app.config['SECRET_KEY'] = settings.SECRET_KEY
CORS(app, origins=settings.CORS_ALLOWED_ORIGINS)
# async_mode will auto-detect eventlet
socketio = SocketIO(app, cors_allowed_origins=settings.CORS_ALLOWED_ORIGINS)

# Logging setup
logger = setup_logging()

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

    def get_node_average_stats(self, node_id):
        with self.lock:
            if not self.graph.has_node(node_id):
                return {'latency': 0, 'packet_loss': 0}
            
            # Get all outgoing edges
            edges = self.graph.out_edges(node_id, data=True)
            if not edges:
                return {'latency': 0, 'packet_loss': 0}
            
            total_latency = 0
            total_loss = 0
            count = 0
            
            for _, _, data in edges:
                # Only count links that have stats
                if 'latency' in data:
                    l = data.get('latency', -1)
                    p = data.get('packet_loss', 0)
                    if l >= 0: # Valid latency
                        total_latency += l
                        total_loss += p
                        count += 1
            
            if count == 0:
                return {'latency': 0, 'packet_loss': 0}
            
            return {
                'latency': round(total_latency / count, 2),
                'packet_loss': round(total_loss / count, 2)
            }

topology_manager = TopologyManager()

# Prometheus Metrics
cpu_usage_gauge = Gauge('geod_cpu_usage_percent', 'CPU Usage Percent', ['hostname'])
memory_usage_gauge = Gauge('geod_memory_usage_percent', 'Memory Usage Percent', ['hostname'])
disk_usage_gauge = Gauge('geod_disk_usage_percent', 'Disk Usage Percent', ['hostname'])
bytes_sent_gauge = Gauge('geod_network_bytes_sent_total', 'Network Bytes Sent Total', ['hostname'])
bytes_recv_gauge = Gauge('geod_network_bytes_recv_total', 'Network Bytes Recv Total', ['hostname'])
packets_sent_gauge = Gauge('geod_network_packets_sent_total', 'Network Packets Sent Total', ['hostname'])
packets_recv_gauge = Gauge('geod_network_packets_recv_total', 'Network Packets Recv Total', ['hostname'])
errors_in_gauge = Gauge('geod_network_errors_in_total', 'Network Errors In Total', ['hostname'])
errors_out_gauge = Gauge('geod_network_errors_out_total', 'Network Errors Out Total', ['hostname'])
drops_in_gauge = Gauge('geod_network_drops_in_total', 'Network Drops In Total', ['hostname'])
drops_out_gauge = Gauge('geod_network_drops_out_total', 'Network Drops Out Total', ['hostname'])
active_connections_gauge = Gauge('geod_network_active_connections', 'Network Active Connections', ['hostname'])
latency_link_gauge = Gauge('geod_network_latency_ms', 'Network Latency MS', ['source', 'target'])
packet_loss_link_gauge = Gauge('geod_network_packet_loss_percent', 'Network Packet Loss Percent', ['source', 'target'])
latency_avg_gauge = Gauge('geod_network_latency_avg_ms', 'Network Latency Average MS', ['hostname'])
packet_loss_avg_gauge = Gauge('geod_network_packet_loss_avg_percent', 'Network Packet Loss Average Percent', ['hostname'])

memory_used_gauge = Gauge('geod_memory_used_bytes', 'Memory Used Bytes', ['hostname'])
memory_total_gauge = Gauge('geod_memory_total_bytes', 'Memory Total Bytes', ['hostname'])
disk_used_gauge = Gauge('geod_disk_used_bytes', 'Disk Used Bytes', ['hostname'])
disk_total_gauge = Gauge('geod_disk_total_bytes', 'Disk Total Bytes', ['hostname'])


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
    return jsonify([agent.to_dict() for agent in sid_to_agent.values()])

@app.route('/metrics')
def metrics():
    return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}

@app.route('/api/history', methods=['GET'])
def get_history():
    """
    Proxy to Prometheus to get historical data.
    Query params:
    - hostname: required
    - start: timestamp (seconds)
    - end: timestamp (seconds)
    - step: seconds (resolution)
    """
    hostname = request.args.get('hostname')
    start = request.args.get('start')
    end = request.args.get('end')
    step = request.args.get('step', '15s')

    if not all([hostname, start, end]):
        return jsonify({'error': 'Missing required parameters'}), 400

    # We need to query multiple metrics to reconstruct the state
    # CPU, Mem, Disk, Net Sent, Net Recv
    
    # Helper to query prometheus
    def query_prom(query_str):
        try:
            # prometheus service is at 'prometheus:9090' in docker-compose
            prom_host = os.environ.get('PROMETHEUS_URL', 'http://prometheus:9090')
            
            url = f'{prom_host}/api/v1/query_range'
            response = requests.get(url, params={
                'query': query_str,
                'start': start,
                'end': end,
                'step': step
            })
            if response.status_code == 200:
                return response.json().get('data', {}).get('result', [])
            return []
        except Exception as e:
            logger.error(f"Prometheus query error: {e}")
            return []

    # Calculate a rate window that is at least 2x the step to ensure continuity, min 1m
    # Step format examples: '15s', '1m', '5m'
    step_val = 15
    if step.endswith('s'): step_val = int(step[:-1])
    elif step.endswith('m'): step_val = int(step[:-1]) * 60
    elif step.endswith('h'): step_val = int(step[:-1]) * 3600
    
    rate_window = f"{max(60, step_val * 4)}s"

    # Parallelize or just sequential? Sequential is safer for now.
    cpu_data = query_prom(f'geod_cpu_usage_percent{{hostname="{hostname}"}}')
    
    mem_percent_data = query_prom(f'geod_memory_usage_percent{{hostname="{hostname}"}}')
    mem_used_data = query_prom(f'geod_memory_used_bytes{{hostname="{hostname}"}}')
    mem_total_data = query_prom(f'geod_memory_total_bytes{{hostname="{hostname}"}}')
    
    disk_percent_data = query_prom(f'geod_disk_usage_percent{{hostname="{hostname}"}}')
    disk_used_data = query_prom(f'geod_disk_used_bytes{{hostname="{hostname}"}}')
    disk_total_data = query_prom(f'geod_disk_total_bytes{{hostname="{hostname}"}}')
    
    # Use rate() for counters to get per-second averages over the step window
    # Bytes -> Mbps: rate(bytes) * 8 / 1e6
    net_sent_data = query_prom(f'rate(geod_network_bytes_sent_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000')
    net_recv_data = query_prom(f'rate(geod_network_bytes_recv_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000')
    
    # Packets -> PPS: rate(packets)
    pkts_sent_data = query_prom(f'rate(geod_network_packets_sent_total{{hostname="{hostname}"}}[{rate_window}])')
    pkts_recv_data = query_prom(f'rate(geod_network_packets_recv_total{{hostname="{hostname}"}}[{rate_window}])')
    
    # For gauges like Latency, we use avg_over_time to smooth out the graph if we are zooming out
    latency_data = query_prom(f'avg_over_time(geod_network_latency_avg_ms{{hostname="{hostname}"}}[{rate_window}])')
    loss_data = query_prom(f'avg_over_time(geod_network_packet_loss_avg_percent{{hostname="{hostname}"}}[{rate_window}])')

    # Counters (Errors/Drops) we probably still want as rates or just raw deltas? 
    # Usually seeing "Errors per second" is better.
    err_in_data = query_prom(f'rate(geod_network_errors_in_total{{hostname="{hostname}"}}[{rate_window}])')
    err_out_data = query_prom(f'rate(geod_network_errors_out_total{{hostname="{hostname}"}}[{rate_window}])')
    drop_in_data = query_prom(f'rate(geod_network_drops_in_total{{hostname="{hostname}"}}[{rate_window}])')
    drop_out_data = query_prom(f'rate(geod_network_drops_out_total{{hostname="{hostname}"}}[{rate_window}])')
    
    active_conn_data = query_prom(f'geod_network_active_connections{{hostname="{hostname}"}}')
    

    # Format for frontend
    # We want a unified list of points ordered by time
    # This is a bit tricky because timestamps might slightly differ.
    # However, if 'step' is aligned, they should be close.
    
    # Let's organize by timestamp
    history = {} # timestamp -> object
    
    def process_series(series_data, category, subkey, cast=float):
        if not series_data: return
        values = series_data[0].get('values', [])
        for t, v in values:
            t = int(t)
            if t not in history:
                history[t] = {'timestamp': datetime.fromtimestamp(t).isoformat(), 'system': {'memory': {}, 'disk': {}}, 'network': {}}
            
            target = history[t]
            if category == 'system':
                if subkey == 'cpu_percent': target['system']['cpu_percent'] = cast(v)
                elif subkey.startswith('memory.'): 
                    target['system']['memory'][subkey.split('.')[1]] = cast(v)
                elif subkey.startswith('disk.'):
                    target['system']['disk'][subkey.split('.')[1]] = cast(v)
            elif category == 'network':
                target['network'][subkey] = cast(v)

    process_series(cpu_data, 'system', 'cpu_percent')
    
    process_series(mem_percent_data, 'system', 'memory.percent')
    process_series(mem_used_data, 'system', 'memory.used')
    process_series(mem_total_data, 'system', 'memory.total')
    
    process_series(disk_percent_data, 'system', 'disk.percent')
    process_series(disk_used_data, 'system', 'disk.used')
    process_series(disk_total_data, 'system', 'disk.total')
    
    # These are now RATES (Mbps, PPS) or Averages, not cumulative totals
    process_series(net_sent_data, 'network', 'throughput_sent_mbps')
    process_series(net_recv_data, 'network', 'throughput_recv_mbps')
    process_series(pkts_sent_data, 'network', 'pps_sent')
    process_series(pkts_recv_data, 'network', 'pps_recv')
    
    process_series(err_in_data, 'network', 'errors_in_rate')
    process_series(err_out_data, 'network', 'errors_out_rate')
    process_series(drop_in_data, 'network', 'drop_in_rate')
    process_series(drop_out_data, 'network', 'drop_out_rate')
    process_series(active_conn_data, 'network', 'active_connections', cast=int)
    
    process_series(latency_data, 'network', 'latency_avg')
    process_series(loss_data, 'network', 'packet_loss_avg')
    
    sorted_history = sorted(history.values(), key=lambda x: x['timestamp'])
    
    return jsonify(sorted_history)

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
        hostname = agent.hostname
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

    agent = Agent(
        sid=sid,
        hostname=hostname,
        ip_address=data.get('ip_address'),
        os=data.get('os'),
        connected_at=datetime.now(),
        last_heartbeat=datetime.now()
    )

    sid_to_agent[sid] = agent
    hostname_to_sid[hostname] = sid

    # Add to topology graph as a node
    topology_manager.add_node(hostname, data={'ip': data.get('ip_address'), 'type': 'agent', 'status': 'online'})
    
    # Auto-connect to all existing agents (Full Mesh)
    try:
        current_topo = topology_manager.get_topology_json()
        existing_nodes = [n['id'] for n in current_topo.get('nodes', []) if n['id'] != hostname and n.get('type') == 'agent']
        
        for other_node in existing_nodes:
            # Create bidirectional links if they don't exist
            topology_manager.add_link(hostname, other_node, {'monitoring': True, 'type': 'auto'})
            topology_manager.add_link(other_node, hostname, {'monitoring': True, 'type': 'auto'})
            logger.info(f"Auto-connected {hostname} <-> {other_node}")
    except Exception as e:
        logger.error(f"Error in auto-connection logic: {e}")

    logger.info(f"Agent registered: {hostname} ({sid})")
    emit('registration_confirmed', {'agent_id': sid, 'status': 'registered'})
    socketio.server.emit('agent_connected', agent.to_dict(), namespace='/')
    
    # Broadcast updated topology immediately so new node appears
    socketio.server.emit('topology_update', topology_manager.get_topology_json(), namespace='/')

@socketio.on('heartbeat')
def handle_heartbeat(data):
    sid = request.sid
    if sid in sid_to_agent:
        sid_to_agent[sid].update_heartbeat()

@socketio.on('network_stats')
def handle_network_stats(data):
    sid = request.sid
    if sid in sid_to_agent:
        # Treat stats as a heartbeat (Alive!)
        sid_to_agent[sid].update_heartbeat()

        hostname = sid_to_agent[sid].hostname
        
        # Update Prometheus Metrics
        try:
            # System
            cpu_usage_gauge.labels(hostname=hostname).set(data['system']['cpu_percent'])
            memory_usage_gauge.labels(hostname=hostname).set(data['system']['memory']['percent'])
            memory_used_gauge.labels(hostname=hostname).set(data['system']['memory']['used'])
            memory_total_gauge.labels(hostname=hostname).set(data['system']['memory']['total'])
            disk_usage_gauge.labels(hostname=hostname).set(data['system']['disk']['percent'])
            disk_used_gauge.labels(hostname=hostname).set(data['system']['disk']['used'])
            disk_total_gauge.labels(hostname=hostname).set(data['system']['disk']['total'])
            
            # Network
            bytes_sent_gauge.labels(hostname=hostname).set(data['network']['bytes_sent'])
            bytes_recv_gauge.labels(hostname=hostname).set(data['network']['bytes_recv'])
            packets_sent_gauge.labels(hostname=hostname).set(data['network']['packets_sent'])
            packets_recv_gauge.labels(hostname=hostname).set(data['network']['packets_recv'])
            errors_in_gauge.labels(hostname=hostname).set(data['network']['errors_in'])
            errors_out_gauge.labels(hostname=hostname).set(data['network']['errors_out'])
            drops_in_gauge.labels(hostname=hostname).set(data['network']['drop_in'])
            drops_out_gauge.labels(hostname=hostname).set(data['network']['drop_out'])
            active_connections_gauge.labels(hostname=hostname).set(data['network']['active_connections'])
            
        except Exception as e:
            logger.error(f"Error updating metrics for {hostname}: {e}")

        # Inject Topology Stats (Latency/Loss)
        topo_stats = topology_manager.get_node_average_stats(hostname)
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
    
    if sid not in sid_to_agent:
        return

    source_hostname = sid_to_agent[sid].hostname

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
            # Parse ping output to get latency and packet loss
            output = result_data.get('output', '')
            latency, packet_loss = parse_ping_output(output)

            logger.info(f"Link Update: {source_hostname} -> {target_hostname} : {latency}ms, {packet_loss}% loss")
            
            # We update if valid latency OR significant packet loss (100% loss might show latency=-1)
            if latency > 0 or packet_loss > 0:
                stats_update = {'latency': latency, 'packet_loss': packet_loss}
                topology_manager.update_link_stats(source_hostname, target_hostname, stats_update)
                
                # Broadcast topology update
                socketio.server.emit('link_stats_update', {
                    'source': source_hostname,
                    'target': target_hostname,
                    'latency': latency,
                    'packet_loss': packet_loss
                }, namespace='/')

                # Update Prometheus Metrics (Link)
                try:
                    latency_link_gauge.labels(source=source_hostname, target=target_hostname).set(latency)
                    packet_loss_link_gauge.labels(source=source_hostname, target=target_hostname).set(packet_loss)
                    
                    # Update Averages
                    avgs = topology_manager.get_node_average_stats(source_hostname)
                    latency_avg_gauge.labels(hostname=source_hostname).set(avgs['latency'])
                    packet_loss_avg_gauge.labels(hostname=source_hostname).set(avgs['packet_loss'])
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
        socketio.sleep(settings.MONITOR_INTERVAL_SECONDS)
        
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
