"""Agent registry service for managing connected agents.

Centralizes agent lifecycle management and mappings between
Socket IDs and hostnames.
"""

from typing import Dict, List, Optional
from domain.models.agent import Agent


class AgentRegistry:
    """Service for managing connected monitoring agents.

    Maintains bidirectional mappings between socket IDs and hostnames,
    and provides methods for agent lifecycle management.
    """

    def __init__(self):
        """Initialize the agent registry."""
        self._hostname_to_sid: Dict[str, str] = {}
        self._sid_to_agent: Dict[str, Agent] = {}

    def register(self, agent: Agent) -> None:
        """Register a new agent.

        Args:
            agent: Agent instance to register
        """
        self._sid_to_agent[agent.sid] = agent
        self._hostname_to_sid[agent.hostname] = agent.sid

    def unregister(self, sid: str) -> Optional[Agent]:
        """Unregister an agent by socket ID.

        Args:
            sid: Socket ID of the agent to unregister

        Returns:
            The unregistered Agent instance, or None if not found
        """
        if sid not in self._sid_to_agent:
            return None

        agent = self._sid_to_agent.pop(sid)
        if agent.hostname in self._hostname_to_sid:
            del self._hostname_to_sid[agent.hostname]

        return agent

    def get_by_sid(self, sid: str) -> Optional[Agent]:
        """Get agent by socket ID.

        Args:
            sid: Socket ID to lookup

        Returns:
            Agent instance or None if not found
        """
        return self._sid_to_agent.get(sid)

    def get_by_hostname(self, hostname: str) -> Optional[Agent]:
        """Get agent by hostname.

        Args:
            hostname: Hostname to lookup

        Returns:
            Agent instance or None if not found
        """
        sid = self._hostname_to_sid.get(hostname)
        if sid:
            return self._sid_to_agent.get(sid)
        return None

    def get_sid_by_hostname(self, hostname: str) -> Optional[str]:
        """Get socket ID by hostname.

        Args:
            hostname: Hostname to lookup

        Returns:
            Socket ID or None if not found
        """
        return self._hostname_to_sid.get(hostname)

    def get_all(self) -> List[Agent]:
        """Get all registered agents.

        Returns:
            List of all Agent instances
        """
        return list(self._sid_to_agent.values())

    def get_all_hostnames(self) -> List[str]:
        """Get all registered hostnames.

        Returns:
            List of all registered hostnames
        """
        return list(self._hostname_to_sid.keys())

    def has_agent(self, sid: str) -> bool:
        """Check if an agent is registered by socket ID.

        Args:
            sid: Socket ID to check

        Returns:
            True if agent is registered, False otherwise
        """
        return sid in self._sid_to_agent

    def has_hostname(self, hostname: str) -> bool:
        """Check if a hostname is registered.

        Args:
            hostname: Hostname to check

        Returns:
            True if hostname is registered, False otherwise
        """
        return hostname in self._hostname_to_sid
