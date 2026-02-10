#!/usr/bin/env python3
"""Namespace TC Manager - Injects chaos into external containers via nsenter."""

import subprocess
import logging
from typing import Dict, Any, List, Optional

try:
    from docker_discovery import DockerDiscovery
except ImportError:
    from agent.docker_discovery import DockerDiscovery

logger = logging.getLogger(__name__)


class NamespaceTCManager:

    def __init__(self, docker_discovery: Optional[DockerDiscovery] = None):
        self.docker = docker_discovery or DockerDiscovery()
        self.active_containers: Dict[str, List[int]] = {}

    def _exec_in_ns(self, pid: int, cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
        full_cmd = ['nsenter', '--target', str(pid), '--net', '--'] + cmd
        logger.debug(f"Executing: {' '.join(full_cmd)}")
        return subprocess.run(full_cmd, capture_output=True, text=True, check=check)

    def _get_interface(self, container_id: str, pid: int) -> str:
        try:
            interfaces = self.docker.get_container_interfaces(container_id)
            return interfaces[0] if interfaces else 'eth0'
        except Exception:
            return 'eth0'

    def setup_hierarchy(self, container_id: str) -> str:
        pid = self.docker.get_container_pid(container_id)
        interface = self._get_interface(container_id, pid)

        self._exec_in_ns(pid, ['tc', 'qdisc', 'del', 'dev', interface, 'root'], check=False)
        self._exec_in_ns(pid, ['tc', 'qdisc', 'add', 'dev', interface, 'root', 'handle', '1:', 'htb'])

        self.active_containers[container_id] = []
        logger.info(f"TC hierarchy setup in container {container_id[:12]} on {interface}")
        return interface

    def add_rule(self, container_id: str, rule: Dict[str, Any], class_id: int) -> None:
        pid = self.docker.get_container_pid(container_id)
        interface = self._get_interface(container_id, pid)
        classid = f"1:{class_id}"
        handle = f"{class_id}:"
        fwmark = class_id

        self._exec_in_ns(pid, [
            'tc', 'class', 'add', 'dev', interface,
            'parent', '1:', 'classid', classid,
            'htb', 'rate', '100mbit'
        ])

        netem_cmd = [
            'tc', 'qdisc', 'add', 'dev', interface,
            'parent', classid, 'handle', handle, 'netem'
        ]

        effects = rule.get('effects', {})
        if effects.get('latency'):
            netem_cmd.extend(['delay', effects['latency']])
        if effects.get('loss'):
            netem_cmd.extend(['loss', effects['loss']])
        if effects.get('limit'):
            netem_cmd.extend(['rate', effects['limit']])

        self._exec_in_ns(pid, netem_cmd)

        target = rule.get('target', {})
        if target and any(target.values()):
            self._add_iptables_mark(pid, interface, target, fwmark)
            filter_type = 'fw'
        else:
            filter_type = 'u32_all'

        filter_cmd = [
            'tc', 'filter', 'add', 'dev', interface,
            'parent', '1:', 'protocol', 'ip',
            'prio', '1' if filter_type == 'fw' else '2',
        ]
        if filter_type == 'fw':
            filter_cmd.extend(['handle', str(fwmark), 'fw', 'flowid', classid])
        else:
            filter_cmd.extend(['u32', 'match', 'u32', '0', '0', 'flowid', classid])

        self._exec_in_ns(pid, filter_cmd)

        if container_id not in self.active_containers:
            self.active_containers[container_id] = []
        self.active_containers[container_id].append(fwmark)

        logger.info(f"Rule added to {container_id[:12]}: target={target}, effects={effects}")

    def _add_iptables_mark(self, pid: int, interface: str, target: Dict[str, Any], fwmark: int) -> None:
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
        self._exec_in_ns(pid, iptables_cmd)

    def remove_all(self, container_id: str) -> None:
        try:
            pid = self.docker.get_container_pid(container_id)
        except (ValueError, Exception) as e:
            logger.warning(f"Cannot get PID for {container_id}: {e}")
            self.active_containers.pop(container_id, None)
            return

        interface = self._get_interface(container_id, pid)

        self._exec_in_ns(pid, ['iptables', '-t', 'mangle', '-F', 'POSTROUTING'], check=False)
        self._exec_in_ns(pid, ['tc', 'qdisc', 'del', 'dev', interface, 'root'], check=False)

        self.active_containers.pop(container_id, None)
        logger.info(f"All rules removed from container {container_id[:12]}")

    def remove_all_containers(self) -> None:
        for container_id in list(self.active_containers.keys()):
            self.remove_all(container_id)

    def get_stats(self, container_id: str) -> Dict[str, Any]:
        try:
            pid = self.docker.get_container_pid(container_id)
        except (ValueError, Exception) as e:
            return {'error': str(e)}

        interface = self._get_interface(container_id, pid)
        stats = {'container_id': container_id, 'interface': interface}

        result = self._exec_in_ns(pid, ['tc', 'qdisc', 'show', 'dev', interface], check=False)
        stats['tc_qdisc'] = result.stdout if result.returncode == 0 else result.stderr

        result = self._exec_in_ns(pid, ['tc', 'class', 'show', 'dev', interface], check=False)
        stats['tc_class'] = result.stdout if result.returncode == 0 else result.stderr

        result = self._exec_in_ns(pid, ['iptables', '-t', 'mangle', '-L', '-n', '-v'], check=False)
        stats['iptables'] = result.stdout if result.returncode == 0 else result.stderr

        return stats


if __name__ == '__main__':
    import sys

    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print("Usage: python ns_tc_manager.py <container_name_or_id> [latency]")
        print("Example: python ns_tc_manager.py redis-test 100ms")
        sys.exit(1)

    container = sys.argv[1]
    latency = sys.argv[2] if len(sys.argv) > 2 else '100ms'

    dd = DockerDiscovery()
    tc = NamespaceTCManager(dd)

    containers = dd.list_containers()
    target = next((c for c in containers if container in c['name'] or container in c['id']), None)

    if not target:
        print(f"Container '{container}' not found")
        sys.exit(1)

    print(f"Target: {target['name']} ({target['short_id']})")

    print(f"\n1. Setting up TC hierarchy...")
    tc.setup_hierarchy(target['id'])

    print(f"2. Adding latency rule ({latency})...")
    tc.add_rule(target['id'], {'effects': {'latency': latency}}, class_id=10)

    print(f"\n3. Stats:")
    stats = tc.get_stats(target['id'])
    print(f"   tc qdisc:\n{stats['tc_qdisc']}")

    print("\n4. Press Enter to remove rules...")
    input()

    tc.remove_all(target['id'])
    print("Rules removed.")
