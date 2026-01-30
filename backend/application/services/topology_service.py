"""Topology service for managing network topology.

Encapsulates topology graph management, node/link operations,
and statistics calculations.
"""

import threading
from datetime import datetime
from typing import Dict, List, Any, Optional
import networkx as nx


class TopologyService:
    """Service for managing network topology graph.

    Provides thread-safe operations for managing nodes, links,
    and calculating network statistics.
    """

    def __init__(self):
        """Initialize the topology service."""
        self._graph = nx.DiGraph()
        self._lock = threading.Lock()

    def add_node(self, node_id: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Add or update a node in the topology.

        Args:
            node_id: Unique node identifier
            data: Optional node attributes
        """
        with self._lock:
            self._graph.add_node(node_id, **(data or {}))

    def add_link(self, source: str, target: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Add a link between two nodes.

        Args:
            source: Source node identifier
            target: Target node identifier
            data: Optional link attributes
        """
        with self._lock:
            self._graph.add_edge(source, target, **(data or {}))

    def update_link_stats(self, source: str, target: str, stats: Dict[str, Any]) -> None:
        """Update statistics for a link.

        Args:
            source: Source node identifier
            target: Target node identifier
            stats: Statistics to update (latency, packet_loss, etc.)
        """
        with self._lock:
            if self._graph.has_edge(source, target):
                # Update existing edge data with new stats
                for key, value in stats.items():
                    self._graph[source][target][key] = value
                self._graph[source][target]['last_updated'] = datetime.now().isoformat()
            else:
                # Create if it doesn't exist (dynamic discovery)
                self._graph.add_edge(
                    source,
                    target,
                    **stats,
                    last_updated=datetime.now().isoformat()
                )

    def get_topology_json(self) -> Dict[str, Any]:
        """Get topology as JSON-serializable dictionary.

        Returns:
            Dictionary with 'nodes' and 'links' keys
        """
        with self._lock:
            return nx.node_link_data(self._graph)

    def load_from_dict(self, data: Dict[str, Any]) -> None:
        """Load topology from dictionary.

        Args:
            data: Topology data in node-link format
        """
        with self._lock:
            self._graph = nx.node_link_graph(data)

    def get_node_average_stats(self, node_id: str) -> Dict[str, float]:
        """Calculate average statistics for a node's outgoing links.

        Args:
            node_id: Node identifier

        Returns:
            Dictionary with 'latency' and 'packet_loss' averages
        """
        with self._lock:
            if not self._graph.has_node(node_id):
                return {'latency': 0, 'packet_loss': 0}

            # Get all outgoing edges
            edges = self._graph.out_edges(node_id, data=True)
            if not edges:
                return {'latency': 0, 'packet_loss': 0}

            total_latency = 0
            total_loss = 0
            count = 0

            for _, _, edge_data in edges:
                # Only count links that have stats
                if 'latency' in edge_data:
                    latency = edge_data.get('latency', -1)
                    packet_loss = edge_data.get('packet_loss', 0)
                    if latency >= 0:  # Valid latency
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
        """Get all node identifiers.

        Returns:
            List of node IDs
        """
        with self._lock:
            return list(self._graph.nodes())

    def get_all_agent_nodes(self) -> List[str]:
        """Get all agent node identifiers.

        Returns:
            List of agent node IDs (nodes with type='agent')
        """
        with self._lock:
            return [
                node_id
                for node_id, data in self._graph.nodes(data=True)
                if data.get('type') == 'agent'
            ]

    def auto_connect_agent(self, hostname: str, agent_data: Dict[str, Any]) -> None:
        """Auto-connect a new agent to existing agents in full mesh topology.

        Args:
            hostname: New agent hostname
            agent_data: Agent node data (ip, type, status)
        """
        # Add the new agent node
        self.add_node(hostname, data=agent_data)

        # Get existing agent nodes
        current_topo = self.get_topology_json()
        existing_nodes = [
            n['id']
            for n in current_topo.get('nodes', [])
            if n['id'] != hostname and n.get('type') == 'agent'
        ]

        # Create bidirectional links to all existing agents
        for other_node in existing_nodes:
            self.add_link(hostname, other_node, {'monitoring': True, 'type': 'auto'})
            self.add_link(other_node, hostname, {'monitoring': True, 'type': 'auto'})
