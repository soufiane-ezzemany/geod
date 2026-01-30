"""Ping command output parser.

Parses ping output from different operating systems (Linux, Mac, Windows).
"""

import re
from typing import Tuple


def parse_ping_output(output: str) -> Tuple[float, int]:
    """Parse ping command output to extract latency and packet loss.

    Supports both Linux/Mac/Unix and Windows ping output formats.

    Args:
        output: Raw ping command output string

    Returns:
        Tuple of (latency_ms, packet_loss_percent)
        - latency_ms: -1 if not found, otherwise latency in milliseconds
        - packet_loss_percent: 0 if not found, otherwise percentage (0-100)

    Examples:
        >>> parse_ping_output("time=12.3 ms")
        (12.3, 0)
        >>> parse_ping_output("Average = 15ms ... (0% loss)")
        (15.0, 0)
    """
    latency = -1.0
    packet_loss = 0

    # Parse Latency
    # Linux/Mac/Unix: time=12.3 ms or time=12.3
    linux_match = re.search(r'time=([\d.]+)', output)
    if linux_match:
        try:
            latency = float(linux_match.group(1))
        except ValueError:
            pass
    else:
        # Windows: Average = 12ms or Average=12ms
        win_match = re.search(r'Average\s*=\s*(\d+)', output)
        if win_match:
            try:
                latency = float(win_match.group(1))
            except ValueError:
                pass

    # Parse Packet Loss
    # Linux/Mac: 0% packet loss
    loss_match = re.search(r'(\d+)% packet loss', output)
    if loss_match:
        try:
            packet_loss = int(loss_match.group(1))
        except ValueError:
            pass
    else:
        # Windows: (0% loss)
        win_loss_match = re.search(r'\((\d+)% loss\)', output)
        if win_loss_match:
            try:
                packet_loss = int(win_loss_match.group(1))
            except ValueError:
                pass

    return latency, packet_loss
