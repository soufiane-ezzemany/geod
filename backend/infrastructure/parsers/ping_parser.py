"""Ping command output parser.

Parses ping output from different operating systems (Linux, Mac, Windows).
"""

import re
from typing import Tuple


def parse_ping_output(output: str) -> Tuple[float, int]:
    """Parse ping output to extract latency and packet loss.

    Supports Linux/Mac/Unix and Windows formats.
    Returns (-1.0, 0) if parsing fails.
    """
    latency = -1.0
    packet_loss = 0

    linux_match = re.search(r'time=([\d.]+)', output)
    if linux_match:
        try:
            latency = float(linux_match.group(1))
        except ValueError:
            pass
    else:
        win_match = re.search(r'Average\s*=\s*(\d+)', output)
        if win_match:
            try:
                latency = float(win_match.group(1))
            except ValueError:
                pass

    loss_match = re.search(r'(\d+)% packet loss', output)
    if loss_match:
        try:
            packet_loss = int(loss_match.group(1))
        except ValueError:
            pass
    else:
        win_loss_match = re.search(r'\((\d+)% loss\)', output)
        if win_loss_match:
            try:
                packet_loss = int(win_loss_match.group(1))
            except ValueError:
                pass

    return latency, packet_loss
