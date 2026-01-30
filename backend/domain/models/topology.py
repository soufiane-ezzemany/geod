"""Topology domain models."""

from dataclasses import dataclass


@dataclass
class Node:
    """Network node entity.

    Attributes:
        id: Unique node identifier (typically hostname)
        ip: IP address of the node
        type: Node type (e.g., 'agent', 'router')
        status: Node status (e.g., 'online', 'offline')
    """

    id: str
    ip: str
    type: str = 'agent'
    status: str = 'online'


@dataclass
class Link:
    """Network link entity.

    Attributes:
        source: Source node identifier
        target: Target node identifier
        latency: Link latency in milliseconds
        packet_loss: Packet loss percentage
        monitoring: Whether this link is being monitored
        type: Link type (e.g., 'auto', 'manual')
    """

    source: str
    target: str
    latency: float = -1.0
    packet_loss: int = 0
    monitoring: bool = True
    type: str = 'auto'
