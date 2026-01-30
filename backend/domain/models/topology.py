"""Topology domain models."""

from dataclasses import dataclass


@dataclass
class Node:
    """Network node entity."""

    id: str
    ip: str
    type: str = 'agent'
    status: str = 'online'


@dataclass
class Link:
    """Network link entity."""

    source: str
    target: str
    latency: float = -1.0
    packet_loss: int = 0
    monitoring: bool = True
    type: str = 'auto'
