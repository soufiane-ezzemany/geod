"""Command handler service for processing agent command results.

Handles command results from agents, particularly ping results
for network topology link monitoring.
"""

from typing import Dict, Any, Optional, Tuple
from config.logging_config import setup_logging
from infrastructure.parsers.ping_parser import parse_ping_output
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.metrics_service import MetricsService

logger = setup_logging()


class CommandHandler:
    """Service for handling command results from agents.

    Processes command results, updates topology and metrics based
    on the command type and results.
    """

    def __init__(
        self,
        agent_registry: AgentRegistry,
        topology_service: TopologyService,
        metrics_service: MetricsService
    ):
        """Initialize the command handler.

        Args:
            agent_registry: Agent registry service
            topology_service: Topology service
            metrics_service: Metrics service
        """
        self._agent_registry = agent_registry
        self._topology_service = topology_service
        self._metrics_service = metrics_service

    def handle_command_result(
        self,
        sid: str,
        command: str,
        result_data: Dict[str, Any],
        params: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Handle a command result from an agent.

        Args:
            sid: Socket ID of the agent
            command: Command type (e.g., 'ping')
            result_data: Result data from the command
            params: Optional command parameters

        Returns:
            Dictionary with update information or None if no update
        """
        agent = self._agent_registry.get_by_sid(sid)
        if not agent:
            return None

        source_hostname = agent.hostname

        # Route to specific handler based on command type
        if command == 'ping':
            return self._handle_ping_result(
                source_hostname,
                result_data,
                params or {}
            )

        return None

    def _handle_ping_result(
        self,
        source_hostname: str,
        result_data: Dict[str, Any],
        params: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Handle ping command result.

        Args:
            source_hostname: Source agent hostname
            result_data: Ping result data
            params: Ping command parameters

        Returns:
            Dictionary with link update information or None
        """
        target_ip = result_data.get('target')

        # Resolve target hostname
        target_hostname = self._resolve_target_hostname(
            params.get('target_hostname'),
            target_ip
        )

        if not target_hostname:
            return None

        # Parse ping output
        output = result_data.get('output', '')
        latency, packet_loss = parse_ping_output(output)

        logger.info(
            f"Link Update: {source_hostname} -> {target_hostname} : "
            f"{latency}ms, {packet_loss}% loss"
        )

        # Update topology and metrics if we have valid data
        if latency > 0 or packet_loss > 0:
            return self._update_link_stats(
                source_hostname,
                target_hostname,
                latency,
                packet_loss
            )

        return None

    def _resolve_target_hostname(
        self,
        param_hostname: Optional[str],
        target_ip: Optional[str]
    ) -> Optional[str]:
        """Resolve target hostname from params or IP lookup.

        Args:
            param_hostname: Hostname from command parameters
            target_ip: Target IP address for fallback lookup

        Returns:
            Target hostname or None if not resolved
        """
        # Primary method: Use hostname from params
        if param_hostname:
            return param_hostname

        # Fallback: Reverse lookup from IP
        if target_ip:
            for agent in self._agent_registry.get_all():
                if agent.ip_address == target_ip:
                    return agent.hostname

        return None

    def _update_link_stats(
        self,
        source: str,
        target: str,
        latency: float,
        packet_loss: int
    ) -> Dict[str, Any]:
        """Update link statistics in topology and metrics.

        Args:
            source: Source hostname
            target: Target hostname
            latency: Link latency in milliseconds
            packet_loss: Packet loss percentage

        Returns:
            Dictionary with update information for broadcasting
        """
        # Update topology
        stats_update = {'latency': latency, 'packet_loss': packet_loss}
        self._topology_service.update_link_stats(source, target, stats_update)

        # Update Prometheus metrics
        try:
            self._metrics_service.update_link_metrics(
                source, target, latency, packet_loss
            )
            avgs = self._topology_service.get_node_average_stats(source)
            self._metrics_service.update_average_metrics(
                source, avgs['latency'], avgs['packet_loss']
            )
        except Exception as e:
            logger.error(f"Error updating latency metrics: {e}")

        return {
            'source': source,
            'target': target,
            'latency': latency,
            'packet_loss': packet_loss
        }

    @staticmethod
    def is_monitoring_request(request_id: str) -> bool:
        """Check if a request is a background monitoring request.

        Args:
            request_id: Request identifier

        Returns:
            True if this is a monitoring request, False otherwise
        """
        return str(request_id).startswith('monitor_')
