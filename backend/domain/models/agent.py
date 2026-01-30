"""Agent domain model."""

from dataclasses import dataclass
from datetime import datetime


@dataclass
class Agent:
    """Monitoring agent entity."""

    sid: str
    hostname: str
    ip_address: str
    os: str
    connected_at: datetime
    last_heartbeat: datetime

    def update_heartbeat(self) -> None:
        self.last_heartbeat = datetime.now()

    def to_dict(self) -> dict:
        return {
            'sid': self.sid,
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'os': self.os,
            'connected_at': self.connected_at.isoformat(),
            'last_heartbeat': self.last_heartbeat.isoformat(),
        }
