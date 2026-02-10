#!/usr/bin/env python3
"""Docker Discovery Module - Discovers containers via Docker socket."""

import logging
from typing import Dict, List, Optional, Any

try:
    import docker
    DOCKER_AVAILABLE = True
except ImportError:
    DOCKER_AVAILABLE = False

logger = logging.getLogger(__name__)


class DockerDiscovery:
    def __init__(self, socket_path: str = "unix:///var/run/docker.sock"):
        if not DOCKER_AVAILABLE:
            raise ImportError("docker package not installed. Run: pip install docker")
        self.socket_path = socket_path
        self._client = None

    @property
    def client(self) -> "docker.DockerClient":
        if self._client is None:
            self._client = docker.DockerClient(base_url=self.socket_path)
        return self._client

    def list_containers(self, network: Optional[str] = None,
                        include_stopped: bool = False) -> List[Dict[str, Any]]:
        try:
            containers = self.client.containers.list(all=include_stopped)
            result = []

            for container in containers:
                info = self._extract_container_info(container)
                if network is not None and network not in info['networks']:
                    continue
                result.append(info)

            logger.info(f"Discovered {len(result)} containers" +
                       (f" on network '{network}'" if network else ""))
            return result

        except docker.errors.DockerException as e:
            logger.error(f"Docker error listing containers: {e}")
            raise

    def _extract_container_info(self, container) -> Dict[str, Any]:
        networks = {}
        net_settings = container.attrs.get('NetworkSettings', {}).get('Networks', {})

        for net_name, net_info in net_settings.items():
            networks[net_name] = {
                'ip': net_info.get('IPAddress', ''),
                'gateway': net_info.get('Gateway', ''),
                'mac': net_info.get('MacAddress', ''),
                'network_id': net_info.get('NetworkID', '')[:12],
            }

        image_tags = container.image.tags if container.image.tags else []
        image_name = image_tags[0] if image_tags else container.attrs.get('Image', 'unknown')[:12]

        return {
            'id': container.id,
            'short_id': container.short_id,
            'name': container.name,
            'image': image_name,
            'status': container.status,
            'networks': networks,
            'labels': container.labels,
        }

    def get_container(self, container_id: str) -> Dict[str, Any]:
        try:
            container = self.client.containers.get(container_id)
            return self._extract_container_info(container)
        except docker.errors.NotFound:
            logger.error(f"Container not found: {container_id}")
            raise

    def get_container_pid(self, container_id: str) -> int:
        try:
            container = self.client.containers.get(container_id)
            state = container.attrs.get('State', {})

            if not state.get('Running', False):
                raise ValueError(f"Container {container_id} is not running")

            pid = state.get('Pid', 0)
            if pid == 0:
                raise ValueError(f"Container {container_id} has no PID")

            logger.debug(f"Container {container_id[:12]} PID: {pid}")
            return pid

        except docker.errors.NotFound:
            logger.error(f"Container not found: {container_id}")
            raise

    def get_container_ip(self, container_id: str, network: Optional[str] = None) -> str:
        info = self.get_container(container_id)
        networks = info['networks']

        if not networks:
            raise ValueError(f"Container {container_id} has no network interfaces")

        if network:
            if network not in networks:
                raise ValueError(f"Container {container_id} not on network '{network}'")
            ip = networks[network]['ip']
        else:
            ip = next(iter(networks.values()))['ip']

        if not ip:
            raise ValueError(f"Container {container_id} has no IP address")

        return ip

    def get_container_interfaces(self, container_id: str) -> List[str]:
        SKIP_INTERFACES = {'lo', 'tunl0', 'ip6tnl0', 'sit0', 'gre0', 'gretap0', 'ip_vti0', 'ip6_vti0', 'ip6gre0'}

        try:
            container = self.client.containers.get(container_id)
            result = container.exec_run('ip -o link show', demux=True)

            interfaces = []
            if result.exit_code == 0 and result.output[0]:
                for line in result.output[0].decode().strip().split('\n'):
                    if line:
                        parts = line.split(':')
                        if len(parts) >= 2:
                            iface = parts[1].strip().split('@')[0]
                            if iface not in SKIP_INTERFACES:
                                interfaces.append(iface)

            if 'eth0' in interfaces:
                interfaces.remove('eth0')
                interfaces.insert(0, 'eth0')

            logger.debug(f"Container {container_id[:12]} interfaces: {interfaces}")
            return interfaces if interfaces else ['eth0']

        except docker.errors.NotFound:
            logger.error(f"Container not found: {container_id}")
            raise
        except docker.errors.APIError as e:
            logger.error(f"Error getting interfaces: {e}")
            return ['eth0']

    def ping(self) -> bool:
        try:
            self.client.ping()
            return True
        except Exception as e:
            logger.error(f"Docker ping failed: {e}")
            return False

    def get_networks(self) -> List[Dict[str, Any]]:
        try:
            networks = self.client.networks.list()
            return [
                {
                    'id': net.id[:12],
                    'name': net.name,
                    'driver': net.attrs.get('Driver', 'unknown'),
                    'scope': net.attrs.get('Scope', 'unknown'),
                }
                for net in networks
            ]
        except docker.errors.DockerException as e:
            logger.error(f"Error listing networks: {e}")
            raise


if __name__ == '__main__':
    import sys

    logging.basicConfig(level=logging.INFO)

    try:
        dd = DockerDiscovery()

        if not dd.ping():
            print("ERROR: Cannot connect to Docker daemon")
            sys.exit(1)

        print("=== Docker Networks ===")
        for net in dd.get_networks():
            print(f"  - {net['name']} ({net['driver']})")

        print("\n=== Running Containers ===")
        containers = dd.list_containers()
        for c in containers:
            print(f"\n  [{c['short_id']}] {c['name']}")
            print(f"      Image: {c['image']}")
            print(f"      Status: {c['status']}")
            for net_name, net_info in c['networks'].items():
                print(f"      Network '{net_name}': {net_info['ip']}")

            try:
                pid = dd.get_container_pid(c['id'])
                print(f"      PID: {pid}")
            except ValueError as e:
                print(f"      PID: (not available)")

        if not containers:
            print("  No running containers found")

    except ImportError as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
