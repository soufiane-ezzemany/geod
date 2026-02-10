"""Topology repository using NetworkX as storage backend."""

import threading
from typing import Dict, List, Any, Optional, Tuple
import networkx as nx


class TopologyRepository:
    """Thread-safe repository for network topology graph storage."""

    def __init__(self):
        self._graph = nx.DiGraph()
        self._lock = threading.Lock()

    def add_node(self, node_id: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        with self._lock:
            self._graph.add_node(node_id, **(attributes or {}))

    def get_node(self, node_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._graph.has_node(node_id):
                return dict(self._graph.nodes[node_id])
            return None

    def has_node(self, node_id: str) -> bool:
        with self._lock:
            return self._graph.has_node(node_id)

    def get_all_nodes(self) -> List[str]:
        with self._lock:
            return list(self._graph.nodes())

    def get_nodes_by_type(self, node_type: str) -> List[str]:
        with self._lock:
            return [
                node_id
                for node_id, data in self._graph.nodes(data=True)
                if data.get('type') == node_type
            ]

    def add_edge(self, source: str, target: str, attributes: Optional[Dict[str, Any]] = None) -> None:
        with self._lock:
            self._graph.add_edge(source, target, **(attributes or {}))

    def has_edge(self, source: str, target: str) -> bool:
        with self._lock:
            return self._graph.has_edge(source, target)

    def update_edge_attributes(self, source: str, target: str, attributes: Dict[str, Any]) -> None:
        with self._lock:
            if self._graph.has_edge(source, target):
                for key, value in attributes.items():
                    self._graph[source][target][key] = value
            else:
                self._graph.add_edge(source, target, **attributes)

    def get_edge_attributes(self, source: str, target: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            if self._graph.has_edge(source, target):
                return dict(self._graph[source][target])
            return None

    def get_outgoing_edges(self, node_id: str) -> List[Tuple[str, str, Dict[str, Any]]]:
        with self._lock:
            if not self._graph.has_node(node_id):
                return []
            return [
                (source, target, dict(data))
                for source, target, data in self._graph.out_edges(node_id, data=True)
            ]

    def to_dict(self) -> Dict[str, Any]:
        with self._lock:
            return nx.node_link_data(self._graph, edges="links")

    def from_dict(self, data: Dict[str, Any]) -> None:
        with self._lock:
            self._graph = nx.node_link_graph(data, edges="links")

    def clear(self) -> None:
        with self._lock:
            self._graph.clear()
