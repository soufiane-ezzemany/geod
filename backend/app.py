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

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST

from config import settings
from config.logging_config import setup_logging
from domain.models.agent import Agent
from infrastructure.parsers.ping_parser import parse_ping_output
from infrastructure.external.prometheus_client import PrometheusClient
from application.services.metrics_service import MetricsService
from application.services.agent_registry import AgentRegistry

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
    return jsonify([agent.to_dict() for agent in agent_registry.get_all()])

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

    # Calculate rate window for counters
    rate_window = prom_client.calculate_rate_window(step)

    # Query all metrics
    cpu_data = prom_client.query_range(f'geod_cpu_usage_percent{{hostname="{hostname}"}}', start, end, step)
    
    mem_percent_data = prom_client.query_range(f'geod_memory_usage_percent{{hostname="{hostname}"}}', start, end, step)
    mem_used_data = prom_client.query_range(f'geod_memory_used_bytes{{hostname="{hostname}"}}', start, end, step)
    mem_total_data = prom_client.query_range(f'geod_memory_total_bytes{{hostname="{hostname}"}}', start, end, step)
    
    disk_percent_data = prom_client.query_range(f'geod_disk_usage_percent{{hostname="{hostname}"}}', start, end, step)
    disk_used_data = prom_client.query_range(f'geod_disk_used_bytes{{hostname="{hostname}"}}', start, end, step)
    disk_total_data = prom_client.query_range(f'geod_disk_total_bytes{{hostname="{hostname}"}}', start, end, step)
    
    # Use rate() for counters to get per-second averages over the step window
    # Bytes -> Mbps: rate(bytes) * 8 / 1e6
    net_sent_data = prom_client.query_range(f'rate(geod_network_bytes_sent_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000', start, end, step)
    net_recv_data = prom_client.query_range(f'rate(geod_network_bytes_recv_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000', start, end, step)
    
    # Packets -> PPS: rate(packets)
    pkts_sent_data = prom_client.query_range(f'rate(geod_network_packets_sent_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    pkts_recv_data = prom_client.query_range(f'rate(geod_network_packets_recv_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    
    # For gauges like Latency, we use avg_over_time to smooth out the graph if we are zooming out
    latency_data = prom_client.query_range(f'avg_over_time(geod_network_latency_avg_ms{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    loss_data = prom_client.query_range(f'avg_over_time(geod_network_packet_loss_avg_percent{{hostname="{hostname}"}}[{rate_window}])', start, end, step)

    # Counters (Errors/Drops) we probably still want as rates or just raw deltas? 
    # Usually seeing "Errors per second" is better.
    err_in_data = prom_client.query_range(f'rate(geod_network_errors_in_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    err_out_data = prom_client.query_range(f'rate(geod_network_errors_out_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    drop_in_data = prom_client.query_range(f'rate(geod_network_drops_in_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    drop_out_data = prom_client.query_range(f'rate(geod_network_drops_out_total{{hostname="{hostname}"}}[{rate_window}])', start, end, step)
    
    active_conn_data = prom_client.query_range(f'geod_network_active_connections{{hostname="{hostname}"}}', start, end, step)
    

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
    agent = agent_registry.unregister(sid)

    if agent:
        hostname = agent.hostname
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

    agent_registry.register(agent)

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
                    metrics_service.update_link_metrics(source_hostname, target_hostname, latency, packet_loss)
                    avgs = topology_manager.get_node_average_stats(source_hostname)
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
            graph_data = topology_manager.get_topology_json()
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
