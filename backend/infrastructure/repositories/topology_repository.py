"""Topology repository using NetworkX as storage backend.

Provides an abstraction layer over NetworkX graph operations,
isolating the graph implementation details from the application layer.
"""

import threading
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import networkx as nx


class TopologyRepository:
    """Repository for managing topology graph storage.

    Uses NetworkX DiGraph as the underlying storage mechanism,
    with thread-safe operations.
    """

    def __init__(self):
        """Initialize the topology repository."""
        self._graph = nx.DiGraph()
        self._lock = threading.Lock()

    def add_node(self, node_id: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Add or update a node in the graph.

        Args:
            node_id: Unique node identifier
            attributes: Optional node attributes
        """
        with self._lock:
            self._graph.add_node(node_id, **(attributes or {}))

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        """Get node attributes.

        Args:
            node_id: Node identifier

        Returns:
            Node attributes dictionary or None if not found
        """
        with self._lock:
            if self._graph.has_node(node_id):
                return dict(self._graph.nodes[node_id])
            return None

    def has_node(self, node_id: str) -> bool:
        """Check if node exists.

        Args:
            node_id: Node identifier

        Returns:
            True if node exists, False otherwise
        """
        with self._lock:
            return self._graph.has_node(node_id)

    def get_all_nodes(self) -> List[str]:
        """Get all node identifiers.

        Returns:
            List of node IDs
        """
        with self._lock:
            return list(self._graph.nodes())

    def get_nodes_by_type(self, node_type: str) -> List[str]:
        """Get all nodes of a specific type.

        Args:
            node_type: Type of nodes to retrieve

        Returns:
            List of node IDs matching the type
        """
        with self._lock:
            return [
                node_id
                for node_id, data in self._graph.nodes(data=True)
                if data.get('type') == node_type
            ]

    def add_edge(self, source: str, target: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        """Add an edge between two nodes.

        Args:
            source: Source node identifier
            target: Target node identifier
            attributes: Optional edge attributes
        """
        with self._lock:
            self._graph.add_edge(source, target, **(attributes or {}))

    def has_edge(self, source: str, target: str) -> bool:
        """Check if edge exists.

        Args:
            source: Source node identifier
            target: Target node identifier

        Returns:
            True if edge exists, False otherwise
        """
        with self._lock:
            return self._graph.has_edge(source, target)

    def update_edge_attributes(self, source: str, target: str, attributes: Dict[str, Any]) -> None:
        """Update edge attributes.

        Args:
            source: Source node identifier
            target: Target node identifier
            attributes: Attributes to update
        """
        with self._lock:
            if self._graph.has_edge(source, target):
                for key, value in attributes.items():
                    self._graph[source][target][key] = value
            else:
                # Create edge if it doesn't exist
                self._graph.add_edge(source, target, **attributes)

    def get_edge_attributes(self, source: str, target: str) -> Optional[Dict[str, Any]]:
        """Get edge attributes.

        Args:
            source: Source node identifier
            target: Target node identifier

        Returns:
            Edge attributes dictionary or None if not found
        """
        with self._lock:
            if self._graph.has_edge(source, target):
                return dict(self._graph[source][target])
            return None

    def get_outgoing_edges(self, node_id: str) -> List[Tuple[str, str, Dict[str, Any]]]:
        """Get all outgoing edges from a node.

        Args:
            node_id: Node identifier

        Returns:
            List of tuples (source, target, attributes)
        """
        with self._lock:
            if not self._graph.has_node(node_id):
                return []
            return [
                (source, target, dict(data))
                for source, target, data in self._graph.out_edges(node_id, data=True)
            ]

    def to_dict(self) -> Dict[str, Any]:
        """Export graph to dictionary format.

        Returns:
            Graph data in node-link format
        """
        with self._lock:
            return nx.node_link_data(self._graph)

    def from_dict(self, data: Dict[str, Any]) -> None:
        """Import graph from dictionary format.

        Args:
            data: Graph data in node-link format
        """
        with self._lock:
            self._graph = nx.node_link_graph(data)

    def clear(self) -> None:
        """Clear all nodes and edges from the graph."""
        with self._lock:
            self._graph.clear()
