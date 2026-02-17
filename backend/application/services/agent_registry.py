"""Agent registry service for managing connected agents."""

import logging
from typing import Dict, List, Optional
from domain.models.agent import Agent

logger = logging.getLogger(__name__)


class AgentRegistry:
    """Manages connected agents with bidirectional SID<->hostname mappings."""

    def __init__(self):
        self._hostname_to_sid: Dict[str, str] = {}
        self._sid_to_agent: Dict[str, Agent] = {}

    def register(self, agent: Agent) -> None:
        # Check if this hostname already has a registration with a different SID
        old_sid = self._hostname_to_sid.get(agent.hostname)
        if old_sid and old_sid != agent.sid:
            # Remove the stale SID entry to prevent duplicates
            self._sid_to_agent.pop(old_sid, None)
            logger.info(f"Cleaned up stale session for {agent.hostname}: old_sid={old_sid}, new_sid={agent.sid}")

        # Register the new agent with its SID
        self._sid_to_agent[agent.sid] = agent
        self._hostname_to_sid[agent.hostname] = agent.sid

    def unregister(self, sid: str) -> Optional[Agent]:
        if sid not in self._sid_to_agent:
            return None

        agent = self._sid_to_agent.pop(sid)
        if agent.hostname in self._hostname_to_sid:
            del self._hostname_to_sid[agent.hostname]

        return agent

    def get_by_sid(self, sid: str) -> Optional[Agent]:
        return self._sid_to_agent.get(sid)

    def get_by_hostname(self, hostname: str) -> Optional[Agent]:
        sid = self._hostname_to_sid.get(hostname)
        if sid:
            return self._sid_to_agent.get(sid)
        return None

    def get_sid_by_hostname(self, hostname: str) -> Optional[str]:
        return self._hostname_to_sid.get(hostname)

    def get_all(self) -> List[Agent]:
        return list(self._sid_to_agent.values())

    def get_all_hostnames(self) -> List[str]:
        return list(self._hostname_to_sid.keys())

    def has_agent(self, sid: str) -> bool:
        return sid in self._sid_to_agent

    def has_hostname(self, hostname: str) -> bool:
        return hostname in self._hostname_to_sid
