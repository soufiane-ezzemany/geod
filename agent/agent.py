#!/usr/bin/env python3
"""
Network Monitoring and Manipulation Agent. Connects to backend via WebSocket for real-time communication
"""

import socketio
import psutil
import platform
import socket
import time
import logging
import subprocess
import json
from typing import Dict, Any, Optional
from datetime import datetime
import threading
from tc_manager import TCManager

try:
    from docker_discovery import DockerDiscovery, DOCKER_AVAILABLE
    from ns_tc_manager import NamespaceTCManager
except ImportError:
    DOCKER_AVAILABLE = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NetworkAgent:
    """Agent for network monitoring and manipulation"""
    
    def __init__(self, backend_url: str, reconnect: bool = True):
        """
        Initialize the network agent
        
        Args:
            backend_url: URL of the backend server (e.g., 'http://localhost:5000')
            reconnect: Whether to automatically reconnect on disconnection
        """
        self.backend_url = backend_url
        self.reconnect = reconnect
        self.sio = socketio.Client(logger=False, engineio_logger=False)
        self.agent_id = None
        self.running = False
        self.stats_interval = 5
        self.heartbeat_interval = 10
        self.iperf_process = None

        self.docker_discovery = None
        self.ns_tc_manager = None
        if DOCKER_AVAILABLE:
            try:
                self.docker_discovery = DockerDiscovery()
                if self.docker_discovery.ping():
                    self.ns_tc_manager = NamespaceTCManager(self.docker_discovery)
                    logger.info("Docker discovery enabled")
                else:
                    self.docker_discovery = None
            except Exception as e:
                logger.warning(f"Docker discovery unavailable: {e}")

        self._register_handlers()
        
    def _register_handlers(self):
        """Register WebSocket event handlers"""
        
        @self.sio.on('connect')
        def on_connect():
            logger.info(f"Connected to backend at {self.backend_url}")
            self._register_agent()
        
        @self.sio.on('disconnect')
        def on_disconnect():
            logger.warning("Disconnected from backend")
            self.agent_id = None
        
        @self.sio.on('connected')
        def on_backend_connected(data):
            logger.info(f"Backend acknowledged connection: {data}")
        
        @self.sio.on('registration_confirmed')
        def on_registration_confirmed(data):
            self.agent_id = data.get('agent_id')
            logger.info(f"Registration confirmed. Agent ID: {self.agent_id}")
        
        @self.sio.on('heartbeat_ack')
        def on_heartbeat_ack(data):
            logger.debug(f"Heartbeat acknowledged: {data}")
        
        @self.sio.on('execute_command')
        def on_execute_command(data):
            logger.info(f"Received command: {data}")
            # Offload to a thread to avoid blocking the main SocketIO loop
            t = threading.Thread(target=self._handle_command_threaded, args=(data,), daemon=True)
            t.start()
    
    def _register_agent(self):
        """Register this agent with the backend"""
        agent_info = {
            'hostname': socket.gethostname(),
            'ip_address': self._get_ip_address(),
            'os': platform.system(),
            'os_version': platform.version(),
            'platform': platform.platform(),
            'processor': platform.processor(),
        }
        logger.info(f"Registering agent: {agent_info}")
        self.sio.emit('register_agent', agent_info)
    
    def _get_ip_address(self) -> str:
        """Get the primary IP address of this machine"""
        try:
            # Try to get FQDN first (for Grid5000 multi-site deployments)
            fqdn = socket.getfqdn()
            if '.' in fqdn and fqdn != socket.gethostname():
                logger.info(f"Using FQDN as IP address: {fqdn}")
                return fqdn
            
            # Fallback: Connect to an external host to determine the primary interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_address = s.getsockname()[0]
            s.close()
            return ip_address
        except Exception as e:
            logger.error(f"Error getting IP address: {e}")
            return "unknown"
            
    def _get_default_interface(self) -> str:
        """Get the default network interface name associated with the primary IP"""
        primary_ip = self._get_ip_address()
        if primary_ip == "unknown":
            return "eth0" # Fallback
            
        try:
            addrs = psutil.net_if_addrs()
            for interface, entries in addrs.items():
                for entry in entries:
                    if entry.address == primary_ip:
                        return interface
        except Exception as e:
            logger.error(f"Error finding default interface: {e}")
            
        return "eth0" # Fallback
    
    def _get_network_stats(self) -> Dict[str, Any]:
        """Collect network statistics"""
        try:
            net_io = psutil.net_io_counters()
            net_connections = len(psutil.net_connections())
            
            # Get per-interface statistics
            net_if_stats = psutil.net_if_stats()
            net_if_addrs = psutil.net_if_addrs()
            
            interfaces = {}
            for iface, addrs in net_if_addrs.items():
                if iface in net_if_stats:
                    stats = net_if_stats[iface]
                    interfaces[iface] = {
                        'is_up': stats.isup,
                        'speed': stats.speed,
                        'mtu': stats.mtu,
                        'addresses': [
                            {
                                'family': str(addr.family),
                                'address': addr.address,
                                'netmask': addr.netmask
                            }
                            for addr in addrs
                        ]
                    }
            
            return {
                'bytes_sent': net_io.bytes_sent,
                'bytes_recv': net_io.bytes_recv,
                'packets_sent': net_io.packets_sent,
                'packets_recv': net_io.packets_recv,
                'errors_in': net_io.errin,
                'errors_out': net_io.errout,
                'drop_in': net_io.dropin,
                'drop_out': net_io.dropout,
                'active_connections': net_connections,
                'interfaces': interfaces,
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            import traceback
            logger.error(f"Error collecting network stats: {e} (type: {type(e)})\n{traceback.format_exc()}")
            return {'error': f'{e} (type: {type(e)})', 'traceback': traceback.format_exc()}
    
    def _get_system_stats(self) -> Dict[str, Any]:
        """Collect system statistics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'cpu_percent': cpu_percent,
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent
                },
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error collecting system stats: {e}")
            return {'error': str(e)}
    
    def _send_stats(self):
        """Send network statistics to backend"""
        while self.running:
            if self.sio.connected:
                try:
                    network_stats = self._get_network_stats()
                    system_stats = self._get_system_stats()
                    
                    stats = {
                        'network': network_stats,
                        'system': system_stats
                    }
                    
                    self.sio.emit('network_stats', stats)
                    logger.debug("Sent network stats to backend")
                except Exception as e:
                    logger.error(f"Error sending stats: {e}")
            
            time.sleep(self.stats_interval)
    
    def _send_heartbeat(self):
        """Send periodic heartbeat to backend"""
        while self.running:
            if self.sio.connected:
                try:
                    self.sio.emit('heartbeat', {
                        'timestamp': datetime.now().isoformat()
                    })
                    logger.debug("Sent heartbeat")
                except Exception as e:
                    logger.error(f"Error sending heartbeat: {e}")
            
            time.sleep(self.heartbeat_interval)
    
    def _handle_command_threaded(self, data: Dict[str, Any]):
        """Handle commands received from backend (threaded)"""
        command = data.get('command')
        params = data.get('params', {})
        request_id = data.get('request_id')
        
        logger.info(f"Executing command: {command} with params: {params}")
        
        result = {
            'request_id': request_id,
            'command': command,
            'params': params,
            'status': 'success',
            'data': None,
            'error': None,
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            if command == 'get_network_stats':
                result['data'] = self._get_network_stats()
            
            elif command == 'get_system_stats':
                result['data'] = self._get_system_stats()
            
            elif command == 'ping':
                target = params.get('target', '8.8.8.8')
                count = params.get('count', 4)
                result['data'] = self._ping(target, count)
            
            elif command == 'list_connections':
                result['data'] = self._list_connections()

            elif command == 'start_iperf_server':
                result['data'] = self._start_iperf_server(params)

            elif command == 'run_iperf_client':
                result['data'] = self._run_iperf_client(params)

            elif command == 'chaos_control':
                result['data'] = self._chaos_control(params)

            elif command == 'discover_containers':
                result['data'] = self._discover_containers(params)

            elif command == 'external_chaos_control':
                result['data'] = self._external_chaos_control(params)

            else:
                result['status'] = 'error'
                result['error'] = f"Unknown command: {command}"
        
        except Exception as e:
            logger.error(f"Error executing command {command}: {e}")
            result['status'] = 'error'
            result['error'] = str(e)
        
        self.sio.emit('command_result', result)
    
    def _ping(self, target: str, count: int = 4) -> Dict[str, Any]:
        """Execute ping command"""
        try:
            param = '-n' if platform.system().lower() == 'windows' else '-c'
            command = ['ping', param, str(count), target]
            output = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True)
            return {'output': output, 'target': target, 'count': count}
        except subprocess.CalledProcessError as e:
            return {'error': e.output, 'target': target}
    
    def _list_connections(self) -> Dict[str, Any]:
        """List all network connections"""
        try:
            connections = []
            for conn in psutil.net_connections(kind='inet'):
                connections.append({
                    'fd': conn.fd,
                    'family': str(conn.family),
                    'type': str(conn.type),
                    'local_address': f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    'remote_address': f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    'status': conn.status,
                    'pid': conn.pid
                })
            return {'connections': connections, 'count': len(connections)}
        except Exception as e:
            return {'error': str(e)}
    
    def _chaos_control(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if platform.system() != 'Linux':
            return {'error': 'Traffic control only supported on Linux'}

        interface = params.get('interface') or self._get_default_interface()
        rules = params.get('rules', [])
        mode = params.get('mode', 'replace')

        logger.info(f"Applying chaos control on {interface}: {len(rules)} rules, mode={mode}")

        tc_manager = TCManager()

        for rule in rules:
            if not tc_manager.validate_rule(rule):
                return {'error': f'Invalid rule: {rule}'}

        if mode == 'replace':
            tc_manager.remove_all(interface)

        if not rules:
            return {'status': 'cleared', 'interface': interface}

        try:
            tc_manager.setup_hierarchy(interface)
        except Exception as e:
            return {'error': f'Failed to setup hierarchy: {str(e)}'}

        results = []
        for idx, rule in enumerate(rules):
            class_id = 10 + idx
            try:
                tc_manager.add_rule(interface, rule, class_id)
                results.append({
                    'rule': rule,
                    'status': 'success',
                    'class_id': class_id
                })
            except Exception as e:
                results.append({
                    'rule': rule,
                    'status': 'error',
                    'error': str(e)
                })
                logger.error(f"Failed to add rule {idx}: {e}")

        return {
            'status': 'applied',
            'interface': interface,
            'rules_count': len(rules),
            'results': results
        }

    def _discover_containers(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.docker_discovery:
            return {'error': 'Docker discovery not available'}

        try:
            network = params.get('network')
            include_stopped = params.get('include_stopped', False)
            containers = self.docker_discovery.list_containers(network=network, include_stopped=include_stopped)
            return {'containers': containers, 'count': len(containers)}
        except Exception as e:
            return {'error': str(e)}

    def _external_chaos_control(self, params: Dict[str, Any]) -> Dict[str, Any]:
        if not self.ns_tc_manager:
            return {'error': 'External chaos control not available (Docker not accessible)'}

        container_id = params.get('container_id')
        rules = params.get('rules', [])
        mode = params.get('mode', 'replace')

        if not container_id:
            return {'error': 'container_id required'}

        tc_manager = TCManager()
        for rule in rules:
            if not tc_manager.validate_rule(rule):
                return {'error': f'Invalid rule: {rule}'}

        logger.info(f"External chaos on container {container_id[:12]}: {len(rules)} rules, mode={mode}")

        if mode == 'replace':
            self.ns_tc_manager.remove_all(container_id)

        if not rules:
            return {'status': 'cleared', 'container_id': container_id}

        try:
            self.ns_tc_manager.setup_hierarchy(container_id)
        except Exception as e:
            return {'error': f'Failed to setup hierarchy: {str(e)}'}

        results = []
        for idx, rule in enumerate(rules):
            class_id = 10 + idx
            try:
                self.ns_tc_manager.add_rule(container_id, rule, class_id)
                results.append({'rule': rule, 'status': 'success', 'class_id': class_id})
            except Exception as e:
                results.append({'rule': rule, 'status': 'error', 'error': str(e)})
                logger.error(f"Failed to add rule {idx}: {e}")

        return {
            'status': 'applied',
            'container_id': container_id,
            'rules_count': len(rules),
            'results': results
        }

    def _start_iperf_server(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Start iperf3 server"""
        try:
            port = params.get('port', 5201)
            # Kill existing if any
            self._kill_existing_iperf()
            
            cmd = ['iperf3', '-s', '-p', str(port), '-D']
            subprocess.check_call(cmd)
            return {'status': 'started', 'port': port}
        except Exception as e:
            return {'error': str(e)}

    def _run_iperf_client(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Run iperf3 client"""
        try:
            target = params.get('target')
            duration = params.get('duration', 5)
            port = params.get('port', 5201)
            
            if not target:
                return {'error': 'Target required'}
            
            cmd = ['iperf3', '-c', target, '-p', str(port), '-t', str(duration), '-J']
            output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, universal_newlines=True)
            result_json = json.loads(output)
            
            # Extract key metrics
            end_sum = result_json.get('end', {}).get('sum_sent', {})
            bits_per_second = end_sum.get('bits_per_second', 0)
            
            return {
                'output': result_json,
                'summary': {
                    'bandwidth_mbps': bits_per_second / 1_000_000,
                    'bytes_sent': end_sum.get('bytes', 0)
                }
            }
        except subprocess.CalledProcessError as e:
            return {'error': str(e), 'output': e.output}
        except json.JSONDecodeError:
            return {'error': 'Failed to parse iperf JSON output', 'output': output}
        except Exception as e:
            return {'error': str(e)}

    def _kill_existing_iperf(self):
        """Stop iperf processes"""
        try:
            # This is a bit aggressive, kills all iperf3 instances
            if platform.system() == 'Linux' or platform.system() == 'Darwin':
                subprocess.call(['pkill', 'iperf3'])
            elif platform.system() == 'Windows':
                subprocess.call(['taskkill', '/F', '/IM', 'iperf3.exe'])
            return {'status': 'stopped'}
        except Exception as e:
            return {'error': str(e)}
    
    def start(self):
        """Start the agent"""
        logger.info("Starting network agent...")
        self.running = True
        
        try:
            self.sio.connect(self.backend_url)
            
            stats_thread = threading.Thread(target=self._send_stats, daemon=True)
            heartbeat_thread = threading.Thread(target=self._send_heartbeat, daemon=True)
            
            stats_thread.start()
            heartbeat_thread.start()
            
            logger.info("Agent started successfully")
            
            # Keep the main thread alive
            while self.running:
                time.sleep(1)
                
        except KeyboardInterrupt:
            logger.info("Received keyboard interrupt, shutting down...")
            self.stop()
        except Exception as e:
            logger.error(f"Error in agent: {e}")
            self.stop()
    
    def stop(self):
        """Stop the agent"""
        logger.info("Stopping agent...")
        self.running = False
        if self.sio.connected:
            self.sio.disconnect()
        logger.info("Agent stopped")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Network Monitoring and Manipulation Agent')
    parser.add_argument('--backend', '-b', default='http://localhost:5000',
                      help='Backend server URL (default: http://localhost:5000)')
    parser.add_argument('--stats-interval', '-s', type=int, default=5,
                      help='Stats reporting interval in seconds (default: 5)')
    parser.add_argument('--heartbeat-interval', '-hb', type=int, default=30,
                      help='Heartbeat interval in seconds (default: 30)')
    parser.add_argument('--no-reconnect', action='store_true',
                      help='Disable automatic reconnection')
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose logging')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    agent = NetworkAgent(
        backend_url=args.backend,
        reconnect=not args.no_reconnect
    )
    agent.stats_interval = args.stats_interval
    agent.heartbeat_interval = args.heartbeat_interval
    
    agent.start()


if __name__ == '__main__':
    main()
