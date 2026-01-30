"""Command handler service for processing agent command results."""

from typing import Dict, Any, Optional
from config.logging_config import setup_logging
from infrastructure.parsers.ping_parser import parse_ping_output
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.metrics_service import MetricsService

logger = setup_logging()


class CommandHandler:
    """Service for handling command results from agents."""

    def __init__(
        self,
        agent_registry: AgentRegistry,
        topology_service: TopologyService,
        metrics_service: MetricsService
    ):
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
        agent = self._agent_registry.get_by_sid(sid)
        if not agent:
            return None

        source_hostname = agent.hostname

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
        target_ip = result_data.get('target')

        target_hostname = self._resolve_target_hostname(
            params.get('target_hostname'),
            target_ip
        )

        if not target_hostname:
            return None

        output = result_data.get('output', '')
        latency, packet_loss = parse_ping_output(output)

        logger.info(
            f"Link Update: {source_hostname} -> {target_hostname} : "
            f"{latency}ms, {packet_loss}% loss"
        )

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
        if param_hostname:
            return param_hostname

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
        stats_update = {'latency': latency, 'packet_loss': packet_loss}
        self._topology_service.update_link_stats(source, target, stats_update)

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
        return str(request_id).startswith('monitor_')
