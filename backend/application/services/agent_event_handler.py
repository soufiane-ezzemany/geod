"""Agent event handler service for managing agent lifecycle events.

Handles agent registration, disconnection, heartbeats, and stats updates.
"""

from datetime import datetime
from typing import Dict, Any, Optional, List
from config.logging_config import setup_logging
from domain.models.agent import Agent
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.metrics_service import MetricsService

logger = setup_logging()


class AgentEventHandler:
    """Service for handling agent lifecycle events.

    Orchestrates agent registration, disconnection, heartbeats,
    and network statistics updates.
    """

    def __init__(
        self,
        agent_registry: AgentRegistry,
        topology_service: TopologyService,
        metrics_service: MetricsService
    ):
        """Initialize the agent event handler.

        Args:
            agent_registry: Agent registry service
            topology_service: Topology service
            metrics_service: Metrics service
        """
        self._agent_registry = agent_registry
        self._topology_service = topology_service
        self._metrics_service = metrics_service

    def handle_registration(
        self,
        sid: str,
        registration_data: Dict[str, Any]
    ) -> Agent:
        """Handle agent registration.

        Args:
            sid: Socket ID
            registration_data: Agent registration data

        Returns:
            Registered Agent instance
        """
        hostname = registration_data.get('hostname', 'unknown')

        # Create agent instance
        agent = Agent(
            sid=sid,
            hostname=hostname,
            ip_address=registration_data.get('ip_address'),
            os=registration_data.get('os'),
            connected_at=datetime.now(),
            last_heartbeat=datetime.now()
        )

        # Register agent
        self._agent_registry.register(agent)

        # Auto-connect to all existing agents (Full Mesh)
        try:
            self._topology_service.auto_connect_agent(
                hostname,
                {
                    'ip': registration_data.get('ip_address'),
                    'type': 'agent',
                    'status': 'online'
                }
            )

            # Log connections
            existing_nodes = [
                n for n in self._topology_service.get_all_agent_nodes()
                if n != hostname
            ]
            for other_node in existing_nodes:
                logger.info(f"Auto-connected {hostname} <-> {other_node}")
        except Exception as e:
            logger.error(f"Error in auto-connection logic: {e}")

        logger.info(f"Agent registered: {hostname} ({sid})")
        return agent

    def handle_disconnection(self, sid: str) -> Optional[Agent]:
        """Handle agent disconnection.

        Args:
            sid: Socket ID

        Returns:
            Disconnected Agent instance or None if not found
        """
        agent = self._agent_registry.unregister(sid)

        if agent:
            hostname = agent.hostname
            # Mark as offline in topology
            self._topology_service.add_node(hostname, data={'status': 'offline'})
            logger.info(f"Agent disconnected: {hostname} ({sid})")

        return agent

    def handle_heartbeat(self, sid: str) -> bool:
        """Handle agent heartbeat.

        Args:
            sid: Socket ID

        Returns:
            True if heartbeat was processed, False if agent not found
        """
        agent = self._agent_registry.get_by_sid(sid)
        if agent:
            agent.update_heartbeat()
            return True
        return False

    def handle_network_stats(
        self,
        sid: str,
        stats_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Handle network statistics update.

        Args:
            sid: Socket ID
            stats_data: Network statistics data

        Returns:
            Enriched stats data for broadcasting or None if agent not found
        """
        agent = self._agent_registry.get_by_sid(sid)
        if not agent:
            return None

        # Treat stats as a heartbeat (agent is alive)
        agent.update_heartbeat()

        hostname = agent.hostname

        # Update Prometheus Metrics
        try:
            self._metrics_service.update_system_metrics(hostname, stats_data['system'])
            self._metrics_service.update_network_metrics(hostname, stats_data['network'])
        except Exception as e:
            logger.error(f"Error updating metrics for {hostname}: {e}")

        # Inject topology stats (latency/loss)
        topo_stats = self._topology_service.get_node_average_stats(hostname)
        stats_data['network']['latency_avg'] = topo_stats['latency']
        stats_data['network']['packet_loss_avg'] = topo_stats['packet_loss']

        return {
            'hostname': hostname,
            'stats': stats_data,
            'timestamp': datetime.now().isoformat()
        }

    def get_topology_snapshot(self) -> Dict[str, Any]:
        """Get current topology snapshot.

        Returns:
            Topology data in JSON format
        """
        return self._topology_service.get_topology_json()
