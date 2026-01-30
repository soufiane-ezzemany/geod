"""Agent domain model."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class Agent:
    """Monitoring agent entity.

    Attributes:
        sid: Socket ID (unique session identifier)
        hostname: Agent hostname (stable identifier)
        ip_address: Agent IP address
        os: Operating system information
        connected_at: Timestamp when agent connected
        last_heartbeat: Timestamp of last heartbeat received
    """

    sid: str
    hostname: str
    ip_address: str
    os: str
    connected_at: datetime
    last_heartbeat: datetime

    def update_heartbeat(self) -> None:
        """Update the last heartbeat timestamp to current time."""
        self.last_heartbeat = datetime.now()

    def to_dict(self) -> dict:
        """Convert agent to dictionary representation."""
        return {
            'sid': self.sid,
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'os': self.os,
            'connected_at': self.connected_at.isoformat(),
            'last_heartbeat': self.last_heartbeat.isoformat(),
        }
