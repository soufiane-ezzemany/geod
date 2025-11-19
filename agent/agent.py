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
from typing import Dict, Any, Optional
from datetime import datetime
import threading

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
            self._handle_command(data)
    
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
            # Connect to an external host to determine the primary interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip_address = s.getsockname()[0]
            s.close()
            return ip_address
        except Exception as e:
            logger.error(f"Error getting IP address: {e}")
            return "unknown"
    
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
    
    def _handle_command(self, data: Dict[str, Any]):
        """Handle commands received from backend"""
        command = data.get('command')
        params = data.get('params', {})
        request_id = data.get('request_id')
        
        logger.info(f"Executing command: {command} with params: {params}")
        
        result = {
            'request_id': request_id,
            'command': command,
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
            
            elif command == 'traceroute':
                target = params.get('target', '8.8.8.8')
                result['data'] = self._traceroute(target)
            

            
            elif command == 'list_connections':
                result['data'] = self._list_connections()
            
            elif command == 'bandwidth_limit':
                interface = params.get('interface')
                limit = params.get('limit')
                result['data'] = self._set_bandwidth_limit(interface, limit)
            
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
    
    def _traceroute(self, target: str) -> Dict[str, Any]:
        """Execute traceroute command"""
        try:
            command = ['traceroute' if platform.system() != 'Windows' else 'tracert', target]
            output = subprocess.check_output(command, stderr=subprocess.STDOUT, universal_newlines=True, timeout=30)
            return {'output': output, 'target': target}
        except subprocess.CalledProcessError as e:
            return {'error': e.output, 'target': target}
        except subprocess.TimeoutExpired:
            return {'error': 'Traceroute timed out', 'target': target}
    
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
    

    
    def _set_bandwidth_limit(self, interface: str, limit: str) -> Dict[str, Any]:
        """Set bandwidth limit on interface (requires tc on Linux)"""
        logger.warning(f"Attempting to set bandwidth limit on {interface}: {limit}")
        try:
            if platform.system() == 'Linux':
                # Example: limit should be like "1mbit"
                cmd = ['sudo', 'tc', 'qdisc', 'add', 'dev', interface, 'root', 'tbf', 'rate', limit, 'burst', '32kbit', 'latency', '400ms']
                output = subprocess.check_output(cmd, stderr=subprocess.STDOUT, universal_newlines=True)
                return {'status': 'applied', 'interface': interface, 'limit': limit, 'output': output}
            else:
                return {'error': 'Bandwidth limiting only supported on Linux'}
        except subprocess.CalledProcessError as e:
            return {'error': str(e), 'output': e.output}
    
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
    parser.add_argument('--heartbeat-interval', '-hb', type=int, default=10,
                      help='Heartbeat interval in seconds (default: 10)')
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
