"""Topology service for managing network topology."""

import logging
from datetime import datetime
from typing import Dict, List, Any, Optional
from infrastructure.repositories.topology_repository import TopologyRepository

logger = logging.getLogger(__name__)


class TopologyService:
    """Service for managing network topology graph."""

    def __init__(self, repository: Optional[TopologyRepository] = None):
        self._repository = repository or TopologyRepository()
        # Stored topology link definitions (source of truth for which edges exist)
        self._topology_config: List[Dict[str, Any]] = []

    def add_node(self, node_id: str, data: Optional[Dict[str, Any]] = None) -> None:
        self._repository.add_node(node_id, data)

    def add_link(self, source: str, target: str, data: Optional[Dict[str, Any]] = None) -> None:
        self._repository.add_edge(source, target, data)

    def remove_all_edges(self) -> None:
        """Remove all edges from the graph while preserving nodes."""
        self._repository.clear_edges()

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

    def get_topology_config(self) -> List[Dict[str, Any]]:
        """Return the current topology link definitions."""
        return self._topology_config

    def register_agent(self, hostname: str, agent_data: Dict[str, Any]) -> None:
        """Register an agent as a node WITHOUT creating any edges.
        Edges are only created based on the topology config."""
        self.add_node(hostname, data=agent_data)
        # If we have a topology config, rebuild edges for this new agent
        if self._topology_config:
            self._apply_links_for_agent(hostname)

    def load_topology_config(self, links: List[Dict[str, Any]]) -> None:
        """Load a new topology configuration and rebuild all edges.
        
        Args:
            links: List of link definitions, each with 'src', 'dst', 
                   and optional 'delay', 'rate', 'symmetric' fields.
        """
        self._topology_config = links
        self.rebuild_topology_edges()

    def rebuild_topology_edges(self) -> None:
        """Clear all edges and recreate them based on the topology config
        and currently registered agents."""
        self.remove_all_edges()
        registered_agents = set(self.get_all_agent_nodes())

        for link_def in self._topology_config:
            src = link_def.get('src', '')
            dst = link_def.get('dst', '')

            # Only create edge if both agents are registered
            if src in registered_agents and dst in registered_agents:
                edge_data = {
                    'monitoring': True,
                    'type': 'configured',
                    'delay': link_def.get('delay', '0ms'),
                    'rate': link_def.get('rate', '1gbit'),
                }
                self.add_link(src, dst, edge_data)

                # If symmetric (default True), add reverse edge too
                if link_def.get('symmetric', True):
                    self.add_link(dst, src, edge_data)

        logger.info(
            f"Rebuilt topology: {len(self._topology_config)} definitions, "
            f"{len(registered_agents)} registered agents"
        )

    def _apply_links_for_agent(self, hostname: str) -> None:
        """Apply topology links for a specific newly registered agent."""
        registered_agents = set(self.get_all_agent_nodes())

        for link_def in self._topology_config:
            src = link_def.get('src', '')
            dst = link_def.get('dst', '')

            # Only create edge if this agent is involved AND the other end is registered
            if src == hostname and dst in registered_agents:
                edge_data = {
                    'monitoring': True,
                    'type': 'configured',
                    'delay': link_def.get('delay', '0ms'),
                    'rate': link_def.get('rate', '1gbit'),
                }
                self.add_link(src, dst, edge_data)
                if link_def.get('symmetric', True):
                    self.add_link(dst, src, edge_data)
            elif dst == hostname and src in registered_agents:
                edge_data = {
                    'monitoring': True,
                    'type': 'configured',
                    'delay': link_def.get('delay', '0ms'),
                    'rate': link_def.get('rate', '1gbit'),
                }
                self.add_link(src, dst, edge_data)
                if link_def.get('symmetric', True):
                    self.add_link(dst, src, edge_data)
