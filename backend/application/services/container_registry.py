"""Container registry for tracking discovered containers across agents."""

import logging
import re
from typing import Dict, List, Any, Optional
from threading import Lock

logger = logging.getLogger(__name__)


class ContainerRegistry:
    """Thread-safe registry for tracking containers discovered by agents."""

    def __init__(self):
        self._containers: Dict[str, List[Dict[str, Any]]] = {}
        self._lock = Lock()

    def update_containers(self, agent_hostname: str, containers: List[Dict[str, Any]]) -> None:
        with self._lock:
            self._containers[agent_hostname] = containers
            logger.info(f"Updated containers for {agent_hostname}: {len(containers)} containers")

    def remove_agent(self, agent_hostname: str) -> None:
        with self._lock:
            if agent_hostname in self._containers:
                del self._containers[agent_hostname]
                logger.info(f"Removed containers for disconnected agent {agent_hostname}")

    def get_all(self) -> Dict[str, List[Dict[str, Any]]]:
        with self._lock:
            return dict(self._containers)

    def get_by_agent(self, agent_hostname: str) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._containers.get(agent_hostname, []))

    def find_by_service(self, service_name: str) -> List[Dict[str, Any]]:
        with self._lock:
            matches = []
            for agent_hostname, containers in self._containers.items():
                for container in containers:
                    container_name = container.get('name', '')
                    if self._matches_service(container_name, service_name):
                        matches.append({
                            'agent': agent_hostname,
                            'container_id': container.get('id'),
                            'container_name': container_name,
                            'short_id': container.get('short_id'),
                            'image': container.get('image'),
                            'status': container.get('status'),
                        })
            return matches

    def _matches_service(self, container_name: str, service_name: str) -> bool:
        if container_name == service_name:
            return True

        swarm_pattern = r'^[^_]*_([^.]+)\.\d+\.'
        match = re.match(swarm_pattern, container_name)
        if match:
            extracted_service = match.group(1)
            if extracted_service == service_name:
                return True

        word_pattern = rf'(^|[_\-./]){re.escape(service_name)}([_\-./\d]|$)'
        if re.search(word_pattern, container_name):
            return True

        return False

    def clear(self) -> None:
        with self._lock:
            self._containers.clear()


def validate_chaos_rule(rule: Dict[str, Any]) -> tuple[bool, Optional[str]]:
    if not isinstance(rule, dict):
        return False, "Rule must be a dictionary"

    effects = rule.get('effects')
    if not effects:
        return False, "Rule must have 'effects' field"

    if not isinstance(effects, dict):
        return False, "'effects' must be a dictionary"

    valid_effects = {'latency', 'loss', 'limit', 'corruption', 'jitter'}
    for key in effects:
        if key not in valid_effects:
            return False, f"Unknown effect '{key}'. Valid effects: {valid_effects}"

    if 'latency' in effects:
        if not re.match(r'^\d+m?s$', str(effects['latency'])):
            return False, "Latency must be in format '100ms' or '1s'"

    if 'loss' in effects:
        if not re.match(r'^\d+(\.\d+)?%$', str(effects['loss'])):
            return False, "Loss must be in format '10%' or '5.5%'"

    if 'limit' in effects:
        if not re.match(r'^\d+(k|m|g)?bit$', str(effects['limit']).lower()):
            return False, "Limit must be in format '1mbit', '100kbit', etc."

    target = rule.get('target')
    if target:
        if not isinstance(target, dict):
            return False, "'target' must be a dictionary"

        valid_target_keys = {'dst_ip', 'dst_subnet', 'dst_port', 'protocol'}
        for key in target:
            if key not in valid_target_keys:
                return False, f"Unknown target key '{key}'. Valid keys: {valid_target_keys}"

        if 'dst_port' in target and 'protocol' not in target:
            return False, "dst_port requires protocol to be specified"

        if 'protocol' in target:
            if target['protocol'].lower() not in ('tcp', 'udp'):
                return False, "Protocol must be 'tcp' or 'udp'"

    return True, None


def validate_chaos_rules(rules: List[Dict[str, Any]]) -> tuple[bool, Optional[str]]:
    if not isinstance(rules, list):
        return False, "Rules must be a list"

    for i, rule in enumerate(rules):
        is_valid, error = validate_chaos_rule(rule)
        if not is_valid:
            return False, f"Rule {i}: {error}"

    return True, None
