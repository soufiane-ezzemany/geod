import subprocess
import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class TCManager:
    """
    Traffic Control Manager using iptables + tc for reliable packet filtering.

    Architecture:
    1. iptables (mangle table) marks packets based on dst_ip/port/protocol
    2. tc filter matches on fwmark and applies netem effects
    """

    def __init__(self):
        self.logger = logger
        self.active_marks: List[int] = []

    def setup_hierarchy(self, interface: str) -> None:
        """Setup HTB qdisc hierarchy for traffic control."""
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
        """
        Add a chaos engineering rule using iptables + tc.

        Args:
            interface: Network interface (e.g., 'eth0')
            rule: Rule definition with 'target' and 'effects'
            class_id: Unique identifier for this rule (used for tc class and fwmark)
        """
        classid = f"1:{class_id}"
        handle = f"{class_id}:"
        fwmark = class_id

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

        target = rule.get('target', {})
        self._add_iptables_mark(interface, target, fwmark)

        subprocess.run([
            'tc', 'filter', 'add', 'dev', interface,
            'parent', '1:', 'protocol', 'ip',
            'prio', '1', 'handle', str(fwmark), 'fw',
            'flowid', classid
        ], check=True)

        self.active_marks.append(fwmark)
        self.logger.info(f"Rule added: class {classid}, fwmark {fwmark}, target={target}, effects={effects}")

    def _add_iptables_mark(self, interface: str, target: Dict[str, Any], fwmark: int) -> None:
        """Add iptables rule in mangle table to mark packets."""
        iptables_cmd = [
            'iptables', '-t', 'mangle', '-A', 'POSTROUTING',
            '-o', interface,
        ]

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

        subprocess.run(iptables_cmd, check=True)
        self.logger.info(f"iptables rule added: {' '.join(iptables_cmd)}")

    def remove_all(self, interface: str) -> None:
        """Remove all tc rules and iptables marks."""
        subprocess.run(
            ['iptables', '-t', 'mangle', '-F', 'POSTROUTING'],
            stderr=subprocess.DEVNULL
        )

        subprocess.run(
            ['tc', 'qdisc', 'del', 'dev', interface, 'root'],
            stderr=subprocess.DEVNULL
        )

        self.active_marks.clear()
        self.logger.info(f"All TC rules and iptables marks removed from {interface}")

    def validate_rule(self, rule: Dict[str, Any]) -> bool:
        """Validate that a rule has required fields."""
        if 'target' not in rule:
            return False

        if 'effects' not in rule:
            return False

        effects = rule['effects']
        if not any(k in effects for k in ['latency', 'loss', 'limit']):
            return False

        return True

    def get_stats(self, interface: str) -> Dict[str, Any]:
        """Get statistics about active rules (for debugging)."""
        stats = {
            'tc_classes': [],
            'tc_filters': [],
            'iptables_rules': [],
            'active_marks': self.active_marks
        }

        try:
            result = subprocess.run(
                ['tc', '-s', 'class', 'show', 'dev', interface],
                capture_output=True, text=True, check=True
            )
            stats['tc_classes'] = result.stdout
        except subprocess.CalledProcessError:
            pass

        try:
            result = subprocess.run(
                ['tc', '-s', 'filter', 'show', 'dev', interface],
                capture_output=True, text=True, check=True
            )
            stats['tc_filters'] = result.stdout
        except subprocess.CalledProcessError:
            pass

        try:
            result = subprocess.run(
                ['iptables', '-t', 'mangle', '-L', 'POSTROUTING', '-v', '-n'],
                capture_output=True, text=True, check=True
            )
            stats['iptables_rules'] = result.stdout
        except subprocess.CalledProcessError:
            pass

        return stats
