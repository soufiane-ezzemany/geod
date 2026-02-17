"""Agent event handler service for managing agent lifecycle events."""

from datetime import datetime
from typing import Dict, Any, Optional
from config.logging_config import setup_logging
from domain.models.agent import Agent
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.metrics_service import MetricsService

logger = setup_logging()


class AgentEventHandler:
    """Service for handling agent lifecycle events."""

    def __init__(
        self,
        agent_registry: AgentRegistry,
        topology_service: TopologyService,
        metrics_service: MetricsService
    ):
        self._agent_registry = agent_registry
        self._topology_service = topology_service
        self._metrics_service = metrics_service

    def handle_registration(
        self,
        sid: str,
        registration_data: Dict[str, Any]
    ) -> Agent:
        hostname = registration_data.get('hostname', 'unknown')

        agent = Agent(
            sid=sid,
            hostname=hostname,
            ip_address=registration_data.get('ip_address'),
            os=registration_data.get('os'),
            connected_at=datetime.now(),
            last_heartbeat=datetime.now()
        )

        self._agent_registry.register(agent)

        try:
            self._topology_service.register_agent(
                hostname,
                {
                    'ip': registration_data.get('ip_address'),
                    'type': 'agent',
                    'status': 'online'
                }
            )
            logger.info(f"Agent registered: {hostname} ({sid})")
        except Exception as e:
            logger.error(f"Error in agent registration: {e}")

        return agent

    def handle_disconnection(self, sid: str) -> Optional[Agent]:
        agent = self._agent_registry.unregister(sid)

        if agent:
            hostname = agent.hostname
            self._topology_service.add_node(hostname, data={'status': 'offline'})
            logger.info(f"Agent disconnected: {hostname} ({sid})")

        return agent

    def handle_heartbeat(self, sid: str) -> bool:
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
        agent = self._agent_registry.get_by_sid(sid)
        if not agent:
            return None

        agent.update_heartbeat()
        hostname = agent.hostname

        try:
            self._metrics_service.update_system_metrics(hostname, stats_data['system'])
            self._metrics_service.update_network_metrics(hostname, stats_data['network'])
        except Exception as e:
            logger.error(f"Error updating metrics for {hostname}: {e}")

        topo_stats = self._topology_service.get_node_average_stats(hostname)
        stats_data['network']['latency_avg'] = topo_stats['latency']
        stats_data['network']['packet_loss_avg'] = topo_stats['packet_loss']

        return {
            'hostname': hostname,
            'stats': stats_data,
            'timestamp': datetime.now().isoformat()
        }

    def get_topology_snapshot(self) -> Dict[str, Any]:
        return self._topology_service.get_topology_json()
