"""Service factory for dependency injection."""

from infrastructure.external.prometheus_client import PrometheusClient
from infrastructure.repositories.topology_repository import TopologyRepository
from application.services.metrics_service import MetricsService
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.history_service import HistoryService
from application.services.command_handler import CommandHandler
from application.services.agent_event_handler import AgentEventHandler


class ServiceFactory:
    """Factory for creating and managing application services."""

    def __init__(self):
        self._prom_client = PrometheusClient()
        self._topology_repository = TopologyRepository()

        self._metrics_service = MetricsService()
        self._agent_registry = AgentRegistry()
        self._topology_service = TopologyService(self._topology_repository)

        self._history_service = HistoryService(self._prom_client)
        self._command_handler = CommandHandler(
            self._agent_registry,
            self._topology_service,
            self._metrics_service
        )
        self._agent_event_handler = AgentEventHandler(
            self._agent_registry,
            self._topology_service,
            self._metrics_service
        )

    @property
    def prometheus_client(self) -> PrometheusClient:
        return self._prom_client

    @property
    def metrics_service(self) -> MetricsService:
        return self._metrics_service

    @property
    def agent_registry(self) -> AgentRegistry:
        return self._agent_registry

    @property
    def topology_service(self) -> TopologyService:
        return self._topology_service

    @property
    def history_service(self) -> HistoryService:
        return self._history_service

    @property
    def command_handler(self) -> CommandHandler:
        return self._command_handler

    @property
    def agent_event_handler(self) -> AgentEventHandler:
        return self._agent_event_handler
