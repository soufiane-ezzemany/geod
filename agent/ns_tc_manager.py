#!/usr/bin/env python3
"""Namespace TC Manager - Injects chaos into external containers via nsenter."""

import subprocess
import logging
import os
from typing import Dict, Any, List, Optional

try:
    from docker_discovery import DockerDiscovery
except ImportError:
    from agent.docker_discovery import DockerDiscovery

logger = logging.getLogger(__name__)


class NamespaceTCManager:

    def __init__(self, docker_discovery: Optional[DockerDiscovery] = None):
        self.docker = docker_discovery or DockerDiscovery()
        self.active_containers: Dict[str, Dict[str, Any]] = {}
        self.host_proc = os.environ.get('HOST_PROC', '/proc')

    def _exec_in_ns(self, pid: int, cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
        """Execute command in container's network namespace."""
        ns_path = f"{self.host_proc}/{pid}/ns/net"
        full_cmd = ['nsenter', f'--net={ns_path}', '--'] + cmd
        logger.debug(f"Executing: {' '.join(full_cmd)}")
        return subprocess.run(full_cmd, capture_output=True, text=True, check=check)

    def _get_all_interfaces(self, pid: int) -> List[str]:
        """Get all network interfaces in the container namespace (except lo)."""
        result = self._exec_in_ns(pid, ['ip', '-o', 'link', 'show'], check=False)
        interfaces = []
        if result.returncode == 0:
            for line in result.stdout.strip().split('\n'):
                if line:
                    parts = line.split(':')
                    if len(parts) >= 2:
                        iface = parts[1].strip().split('@')[0]
                        if iface and iface != 'lo':
                            interfaces.append(iface)
        return interfaces if interfaces else ['eth0']

    def _get_overlay_interface(self, container_id: str, pid: int) -> str:
        """
        Get the overlay network interface (service mesh) for a container.

        Priority:
        1. User-specified overlay network from container's networks
        2. Any overlay network (not ingress, not bridge)
        3. Fallback to last interface (usually overlay in Swarm)
        4. Final fallback to eth0
        """
        try:
            # Get container's network info from Docker API
            networks = self.docker.get_container_networks(container_id)
            all_interfaces = self._get_all_interfaces(pid)

            # Get interface IPs to match with networks
            interface_ips = {}
            for iface in all_interfaces:
                result = self._exec_in_ns(pid, ['ip', '-4', '-o', 'addr', 'show', 'dev', iface], check=False)
                if result.returncode == 0 and result.stdout:
                    # Format: "42: eth0    inet 10.0.0.22/24 ..."
                    parts = result.stdout.split()
                    for i, part in enumerate(parts):
                        if part == 'inet' and i + 1 < len(parts):
                            ip = parts[i + 1].split('/')[0]
                            interface_ips[iface] = ip
                            break

            # Find overlay network interface (not ingress, not bridge)
            for net_name, net_info in networks.items():
                net_ip = net_info.get('ip', '')
                # Skip ingress and bridge networks
                if 'ingress' in net_name.lower() or 'bridge' in net_name.lower() or 'gwbridge' in net_name.lower():
                    continue
                # Find interface with matching IP
                for iface, ip in interface_ips.items():
                    if ip == net_ip:
                        logger.info(f"Found overlay interface {iface} ({ip}) for network {net_name}")
                        return iface

            # Fallback: use last interface (usually overlay in Swarm with multiple networks)
            if len(all_interfaces) > 1:
                # Last interface is typically the user-defined overlay network
                iface = all_interfaces[-1]
                logger.info(f"Using last interface {iface} as overlay (fallback)")
                return iface

            return 'eth0'
        except Exception as e:
            logger.warning(f"Error detecting overlay interface: {e}, falling back to eth0")
            return 'eth0'

    def _resolve_interface(self, container_id: str, pid: int, interface: Optional[str] = None) -> str:
        """
        Resolve which interface to use for chaos injection.

        Args:
            container_id: Container ID
            pid: Container PID
            interface: Optional explicit interface name, or "all" for all interfaces

        Returns:
            Interface name to use
        """
        if interface and interface != 'auto':
            return interface

        return self._get_overlay_interface(container_id, pid)

    def setup_hierarchy(self, container_id: str, interface: Optional[str] = None) -> str:
        """
        Setup tc hierarchy on the specified interface (or auto-detect overlay).

        Args:
            container_id: Container ID
            interface: Optional interface name. If None, auto-detects overlay network.
        """
        pid = self.docker.get_container_pid(container_id)
        iface = self._resolve_interface(container_id, pid, interface)

        self._exec_in_ns(pid, ['tc', 'qdisc', 'del', 'dev', iface, 'root'], check=False)
        self._exec_in_ns(pid, ['tc', 'qdisc', 'add', 'dev', iface, 'root', 'handle', '1:', 'htb'])

        self.active_containers[container_id] = {'interface': iface, 'rules': []}
        logger.info(f"TC hierarchy setup in container {container_id[:12]} on {iface}")
        return iface

    def add_rule(self, container_id: str, rule: Dict[str, Any], class_id: int, interface: Optional[str] = None) -> None:
        """
        Add a chaos rule to the container.

        Args:
            container_id: Container ID
            rule: Rule with 'effects' and optional 'target'
            class_id: TC class ID for this rule
            interface: Optional interface. If None, uses the one from setup_hierarchy.
        """
        pid = self.docker.get_container_pid(container_id)

        if container_id in self.active_containers:
            iface = self.active_containers[container_id].get('interface')
        else:
            iface = self._resolve_interface(container_id, pid, interface)

        classid = f"1:{class_id}"
        handle = f"{class_id}:"
        fwmark = class_id
        effects = rule.get('effects', {})
        target = rule.get('target', {})

        self._exec_in_ns(pid, [
            'tc', 'class', 'add', 'dev', iface,
            'parent', '1:', 'classid', classid,
            'htb', 'rate', '100mbit'
        ], check=False)

        netem_cmd = ['tc', 'qdisc', 'add', 'dev', iface, 'parent', classid, 'handle', handle, 'netem']
        if effects.get('latency'):
            netem_cmd.extend(['delay', effects['latency']])
        if effects.get('loss'):
            netem_cmd.extend(['loss', effects['loss']])
        if effects.get('limit'):
            netem_cmd.extend(['rate', effects['limit']])

        self._exec_in_ns(pid, netem_cmd, check=False)

        if target and any(target.values()):
            self._add_iptables_mark(pid, iface, target, fwmark)
            filter_cmd = [
                'tc', 'filter', 'add', 'dev', iface,
                'parent', '1:', 'protocol', 'ip', 'prio', '1',
                'handle', str(fwmark), 'fw', 'flowid', classid
            ]
        else:
            filter_cmd = [
                'tc', 'filter', 'add', 'dev', iface,
                'parent', '1:', 'protocol', 'ip', 'prio', '2',
                'u32', 'match', 'u32', '0', '0', 'flowid', classid
            ]

        self._exec_in_ns(pid, filter_cmd, check=False)

        if container_id not in self.active_containers:
            self.active_containers[container_id] = {'interface': iface, 'rules': []}
        self.active_containers[container_id]['rules'].append(fwmark)

        logger.info(f"Rule added to {container_id[:12]} on {iface}: target={target}, effects={effects}")

    def _add_iptables_mark(self, pid: int, interface: str, target: Dict[str, Any], fwmark: int) -> None:
        """Add iptables mark for targeted traffic."""
        iptables_cmd = ['iptables', '-t', 'mangle', '-A', 'POSTROUTING', '-o', interface]

        if target.get('dst_ip'):
            iptables_cmd.extend(['-d', target['dst_ip']])
        elif target.get('dst_subnet'):
            iptables_cmd.extend(['-d', target['dst_subnet']])

        if target.get('protocol'):
            proto = target['protocol'].lower()
            iptables_cmd.extend(['-p', proto])
            if target.get('dst_port'):
                iptables_cmd.extend(['--dport', str(target['dst_port'])])

        iptables_cmd.extend(['-j', 'MARK', '--set-mark', str(fwmark)])
        self._exec_in_ns(pid, iptables_cmd, check=False)

    def remove_all(self, container_id: str) -> None:
        """Remove all chaos rules from the container."""
        try:
            pid = self.docker.get_container_pid(container_id)
        except (ValueError, Exception) as e:
            logger.warning(f"Cannot get PID for {container_id}: {e}")
            self.active_containers.pop(container_id, None)
            return

        if container_id in self.active_containers:
            iface = self.active_containers[container_id].get('interface')
            interfaces = [iface] if iface else self._get_all_interfaces(pid)
        else:
            interfaces = self._get_all_interfaces(pid)

        self._exec_in_ns(pid, ['iptables', '-t', 'mangle', '-F', 'POSTROUTING'], check=False)

        for interface in interfaces:
            self._exec_in_ns(pid, ['tc', 'qdisc', 'del', 'dev', interface, 'root'], check=False)

        self.active_containers.pop(container_id, None)
        logger.info(f"All rules removed from container {container_id[:12]} on {interfaces}")

    def remove_all_containers(self) -> None:
        """Remove chaos rules from all tracked containers."""
        for container_id in list(self.active_containers.keys()):
            self.remove_all(container_id)

    def get_interfaces(self, container_id: str) -> Dict[str, Any]:
        """Get all interfaces and their network info for a container."""
        try:
            pid = self.docker.get_container_pid(container_id)
        except (ValueError, Exception) as e:
            return {'error': str(e)}

        interfaces = self._get_all_interfaces(pid)
        networks = self.docker.get_container_networks(container_id)
        overlay_iface = self._get_overlay_interface(container_id, pid)

        result = {
            'container_id': container_id,
            'interfaces': [],
            'recommended': overlay_iface
        }

        for iface in interfaces:
            iface_info = {'name': iface, 'ip': None, 'network': None}
            ip_result = self._exec_in_ns(pid, ['ip', '-4', '-o', 'addr', 'show', 'dev', iface], check=False)
            if ip_result.returncode == 0 and ip_result.stdout:
                parts = ip_result.stdout.split()
                for i, part in enumerate(parts):
                    if part == 'inet' and i + 1 < len(parts):
                        iface_info['ip'] = parts[i + 1].split('/')[0]
                        break

            for net_name, net_info in networks.items():
                if net_info.get('ip') == iface_info['ip']:
                    iface_info['network'] = net_name
                    break

            result['interfaces'].append(iface_info)

        return result

    def get_stats(self, container_id: str) -> Dict[str, Any]:
        """Get tc stats for a container."""
        try:
            pid = self.docker.get_container_pid(container_id)
        except (ValueError, Exception) as e:
            return {'error': str(e)}

        if container_id in self.active_containers:
            iface = self.active_containers[container_id].get('interface')
            interfaces = [iface] if iface else self._get_all_interfaces(pid)
        else:
            interfaces = self._get_all_interfaces(pid)

        stats = {'container_id': container_id, 'interfaces': interfaces, 'tc_qdisc': {}, 'tc_class': {}}

        for interface in interfaces:
            result = self._exec_in_ns(pid, ['tc', 'qdisc', 'show', 'dev', interface], check=False)
            stats['tc_qdisc'][interface] = result.stdout if result.returncode == 0 else result.stderr

            result = self._exec_in_ns(pid, ['tc', 'class', 'show', 'dev', interface], check=False)
            stats['tc_class'][interface] = result.stdout if result.returncode == 0 else result.stderr

        result = self._exec_in_ns(pid, ['iptables', '-t', 'mangle', '-L', '-n', '-v'], check=False)
        stats['iptables'] = result.stdout if result.returncode == 0 else result.stderr

        return stats


if __name__ == '__main__':
    import sys

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print("Usage: python ns_tc_manager.py <container_name_or_id> [latency] [interface]")
        print("Example: python ns_tc_manager.py redis-test 100ms")
        print("Example: python ns_tc_manager.py webapp 200ms eth2")
        sys.exit(1)

    container = sys.argv[1]
    latency = sys.argv[2] if len(sys.argv) > 2 else '100ms'
    interface = sys.argv[3] if len(sys.argv) > 3 else None

    dd = DockerDiscovery()
    tc = NamespaceTCManager(dd)

    containers = dd.list_containers()
    target = next((c for c in containers if container in c['name'] or container in c['id']), None)

    if not target:
        print(f"Container '{container}' not found")
        sys.exit(1)

    print(f"Target: {target['name']} ({target['short_id']})")

    print(f"\n1. Getting interfaces...")
    ifaces = tc.get_interfaces(target['id'])
    print(f"   Available: {ifaces['interfaces']}")
    print(f"   Recommended (overlay): {ifaces['recommended']}")

    print(f"\n2. Setting up TC hierarchy...")
    used_iface = tc.setup_hierarchy(target['id'], interface)
    print(f"   Using interface: {used_iface}")

    print(f"\n3. Adding latency rule ({latency})...")
    tc.add_rule(target['id'], {'effects': {'latency': latency}}, class_id=10)

    print(f"\n4. Stats:")
    stats = tc.get_stats(target['id'])
    for iface, qdisc in stats['tc_qdisc'].items():
        print(f"   {iface}: {qdisc.strip()}")

    print("\n5. Press Enter to remove rules...")
    input()

    tc.remove_all(target['id'])
    print("Rules removed.")
