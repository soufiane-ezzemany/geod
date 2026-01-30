"""Topology service for managing network topology."""

from datetime import datetime
from typing import Dict, List, Any, Optional
from infrastructure.repositories.topology_repository import TopologyRepository


class TopologyService:
    """Service for managing network topology graph."""

    def __init__(self, repository: Optional[TopologyRepository] = None):
        self._repository = repository or TopologyRepository()

    def add_node(self, node_id: str, data: Optional[Dict[str, Any]] = None) -> None:
        self._repository.add_node(node_id, data)

    def add_link(self, source: str, target: str, data: Optional[Dict[str, Any]] = None) -> None:
        self._repository.add_edge(source, target, data)

    def update_link_stats(self, source: str, target: str, stats: Dict[str, Any]) -> None:
        stats_with_timestamp = {
            **stats,
            'last_updated': datetime.now().isoformat()
        }
        self._repository.update_edge_attributes(source, target, stats_with_timestamp)

    def get_topology_json(self) -> Dict[str, Any]:
        return self._repository.to_dict()

    def load_from_dict(self, data: Dict[str, Any]) -> None:
        self._repository.from_dict(data)

    def get_node_average_stats(self, node_id: str) -> Dict[str, float]:
        """Calculate average latency and packet loss for a node's outgoing links."""
        edges = self._repository.get_outgoing_edges(node_id)
        if not edges:
            return {'latency': 0, 'packet_loss': 0}

        total_latency = 0
        total_loss = 0
        count = 0

        for _, _, edge_data in edges:
            if 'latency' in edge_data:
                latency = edge_data.get('latency', -1)
                packet_loss = edge_data.get('packet_loss', 0)
                if latency >= 0:
                    total_latency += latency
                    total_loss += packet_loss
                    count += 1

        if count == 0:
            return {'latency': 0, 'packet_loss': 0}

        return {
            'latency': round(total_latency / count, 2),
            'packet_loss': round(total_loss / count, 2)
        }

    def get_all_nodes(self) -> List[str]:
        return self._repository.get_all_nodes()

    def get_all_agent_nodes(self) -> List[str]:
        return self._repository.get_nodes_by_type('agent')

    def auto_connect_agent(self, hostname: str, agent_data: Dict[str, Any]) -> None:
        """Create full-mesh topology by connecting new agent to all existing agents."""
        self.add_node(hostname, data=agent_data)

        existing_nodes = [
            node for node in self.get_all_agent_nodes()
            if node != hostname
        ]

        for other_node in existing_nodes:
            self.add_link(hostname, other_node, {'monitoring': True, 'type': 'auto'})
            self.add_link(other_node, hostname, {'monitoring': True, 'type': 'auto'})
