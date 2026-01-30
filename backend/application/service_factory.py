"""Service factory for dependency injection.

Centralizes service creation and dependency management
following the Dependency Inversion Principle.
"""

from infrastructure.external.prometheus_client import PrometheusClient
from infrastructure.repositories.topology_repository import TopologyRepository
from application.services.metrics_service import MetricsService
from application.services.agent_registry import AgentRegistry
from application.services.topology_service import TopologyService
from application.services.history_service import HistoryService
from application.services.command_handler import CommandHandler
from application.services.agent_event_handler import AgentEventHandler


class ServiceFactory:
    """Factory for creating and managing application services.

    Implements dependency injection to manage service lifecycle
    and dependencies.
    """

    def __init__(self):
        """Initialize the service factory and create all services."""
        # Infrastructure layer
        self._prom_client = PrometheusClient()
        self._topology_repository = TopologyRepository()

        # Application layer - Core services
        self._metrics_service = MetricsService()
        self._agent_registry = AgentRegistry()
        self._topology_service = TopologyService(self._topology_repository)

        # Application layer - Orchestration services
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
        """Get Prometheus client instance."""
        return self._prom_client

    @property
    def metrics_service(self) -> MetricsService:
        """Get metrics service instance."""
        return self._metrics_service

    @property
    def agent_registry(self) -> AgentRegistry:
        """Get agent registry instance."""
        return self._agent_registry

    @property
    def topology_service(self) -> TopologyService:
        """Get topology service instance."""
        return self._topology_service

    @property
    def history_service(self) -> HistoryService:
        """Get history service instance."""
        return self._history_service

    @property
    def command_handler(self) -> CommandHandler:
        """Get command handler instance."""
        return self._command_handler

    @property
    def agent_event_handler(self) -> AgentEventHandler:
        """Get agent event handler instance."""
        return self._agent_event_handler
