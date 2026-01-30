import subprocess
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class TCManager:
    def __init__(self):
        self.logger = logger

    def setup_hierarchy(self, interface: str) -> None:
        subprocess.run(
            ['tc', 'qdisc', 'del', 'dev', interface, 'root'],
            stderr=subprocess.DEVNULL
        )

        subprocess.run(
            ['tc', 'qdisc', 'add', 'dev', interface, 'root', 'handle', '1:', 'htb'],
            check=True
        )

        self.logger.info(f"TC hierarchy setup on {interface}")

    def add_rule(self, interface: str, rule: Dict[str, Any], class_id: int) -> None:
        classid = f"1:{class_id}"
        handle = f"{class_id}:"

        subprocess.run([
            'tc', 'class', 'add', 'dev', interface,
            'parent', '1:', 'classid', classid,
            'htb', 'rate', '100mbit'
        ], check=True)

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

        subprocess.run(netem_cmd, check=True)

        filter_cmd = [
            'tc', 'filter', 'add', 'dev', interface,
            'protocol', 'ip', 'parent', '1:0',
            'prio', str(class_id), 'u32'
        ]

        target = rule.get('target', {})

        if target.get('dst_ip'):
            filter_cmd.extend(['match', 'ip', 'dst', target['dst_ip']])

        if target.get('dst_subnet'):
            filter_cmd.extend(['match', 'ip', 'dst', target['dst_subnet']])

        if target.get('dst_port'):
            port = target['dst_port']
            filter_cmd.extend(['match', 'ip', 'dport', str(port), '0xffff'])

        if target.get('protocol'):
            proto = target['protocol']
            proto_num = 6 if proto == 'tcp' else 17
            filter_cmd.extend(['match', 'ip', 'protocol', str(proto_num), '0xff'])

        filter_cmd.extend(['flowid', classid])

        subprocess.run(filter_cmd, check=True)

        self.logger.info(f"Rule added: class {classid}, target={target}, effects={effects}")

    def remove_all(self, interface: str) -> None:
        subprocess.run(
            ['tc', 'qdisc', 'del', 'dev', interface, 'root'],
            stderr=subprocess.DEVNULL
        )
        self.logger.info(f"All TC rules removed from {interface}")

    def validate_rule(self, rule: Dict[str, Any]) -> bool:
        if 'target' not in rule:
            return False

        if 'effects' not in rule:
            return False

        effects = rule['effects']
        if not any(k in effects for k in ['latency', 'loss', 'limit']):
            return False

        return True
