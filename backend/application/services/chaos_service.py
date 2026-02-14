"""Service for managing chaos operations across agents."""

import time
import logging
from typing import Dict, List, Any, Optional, Callable

from application.services.agent_registry import AgentRegistry
from application.services.container_registry import ContainerRegistry, validate_chaos_rules

logger = logging.getLogger(__name__)


class ChaosService:

    def __init__(
        self,
        agent_registry: AgentRegistry,
        container_registry: ContainerRegistry,
        emit_fn: Callable
    ):
        self._agent_registry = agent_registry
        self._container_registry = container_registry
        self._emit = emit_fn

    def _get_agent_sid(self, hostname: str) -> Optional[str]:
        return self._agent_registry.get_sid_by_hostname(hostname)

    def _send_command(self, sid: str, command: str, params: Dict[str, Any], request_id: str) -> None:
        self._emit('execute_command', {
            'command': command,
            'params': params,
            'request_id': request_id
        }, room=sid)

    def apply_vm_chaos(self, hostname: str, rules: List[Dict], interface: Optional[str] = None, mode: str = 'replace') -> Dict[str, Any]:
        sid = self._get_agent_sid(hostname)
        if not sid:
            return {'error': 'Agent not found', 'status_code': 404}

        self._send_command(sid, 'chaos_control', {
            'rules': rules,
            'interface': interface,
            'mode': mode
        }, f"chaos_{int(time.time())}")

        return {
            'status': 'sent',
            'hostname': hostname,
            'rules_count': len(rules)
        }

    def clear_vm_chaos(self, hostname: str) -> Dict[str, Any]:
        sid = self._get_agent_sid(hostname)
        if not sid:
            return {'error': 'Agent not found', 'status_code': 404}

        self._send_command(sid, 'chaos_control', {
            'rules': []
        }, f"chaos_clear_{int(time.time())}")

        return {'status': 'cleared', 'hostname': hostname}

    def apply_container_chaos(self, hostname: str, container_id: str, rules: List[Dict], mode: str = 'replace') -> Dict[str, Any]:
        if rules:
            is_valid, error = validate_chaos_rules(rules)
            if not is_valid:
                return {'error': f'Invalid rules: {error}', 'status_code': 400}

        sid = self._get_agent_sid(hostname)
        if not sid:
            return {'error': 'Agent not found', 'status_code': 404}

        self._send_command(sid, 'external_chaos_control', {
            'container_id': container_id,
            'rules': rules,
            'mode': mode
        }, f"ext_chaos_{int(time.time())}")

        return {
            'status': 'sent',
            'agent': hostname,
            'container_id': container_id,
            'rules_count': len(rules)
        }

    def clear_container_chaos(self, hostname: str, container_id: str) -> Dict[str, Any]:
        sid = self._get_agent_sid(hostname)
        if not sid:
            return {'error': 'Agent not found', 'status_code': 404}

        self._send_command(sid, 'external_chaos_control', {
            'container_id': container_id,
            'rules': []
        }, f"ext_chaos_clear_{int(time.time())}")

        return {
            'status': 'cleared',
            'agent': hostname,
            'container_id': container_id
        }

    def apply_service_chaos(self, service_name: str, rules: List[Dict], mode: str = 'replace') -> Dict[str, Any]:
        if not rules:
            return {'error': 'rules required', 'status_code': 400}

        is_valid, error = validate_chaos_rules(rules)
        if not is_valid:
            return {'error': f'Invalid rules: {error}', 'status_code': 400}

        matching_containers = self._container_registry.find_by_service(service_name)
        if not matching_containers:
            return {
                'error': f'No containers found for service "{service_name}"',
                'hint': 'Call GET /api/services to see available services, or POST /api/discover first',
                'status_code': 404
            }

        results = []
        for match in matching_containers:
            agent_hostname = match['agent']
            container_id = match['container_id']
            sid = self._get_agent_sid(agent_hostname)

            if sid:
                self._send_command(sid, 'external_chaos_control', {
                    'container_id': container_id,
                    'rules': rules,
                    'mode': mode
                }, f"svc_chaos_{service_name}_{int(time.time())}")

                results.append({
                    'agent': agent_hostname,
                    'container_id': container_id,
                    'container_name': match['container_name'],
                    'status': 'sent'
                })
            else:
                results.append({
                    'agent': agent_hostname,
                    'container_id': container_id,
                    'container_name': match['container_name'],
                    'status': 'agent_disconnected'
                })

        return {
            'service': service_name,
            'containers_affected': len([r for r in results if r['status'] == 'sent']),
            'results': results
        }

    def clear_service_chaos(self, service_name: str) -> Dict[str, Any]:
        matching_containers = self._container_registry.find_by_service(service_name)
        if not matching_containers:
            return {
                'error': f'No containers found for service "{service_name}"',
                'status_code': 404
            }

        results = []
        for match in matching_containers:
            agent_hostname = match['agent']
            container_id = match['container_id']
            sid = self._get_agent_sid(agent_hostname)

            if sid:
                self._send_command(sid, 'external_chaos_control', {
                    'container_id': container_id,
                    'rules': []
                }, f"svc_chaos_clear_{service_name}_{int(time.time())}")

                results.append({
                    'agent': agent_hostname,
                    'container_id': container_id,
                    'container_name': match['container_name'],
                    'status': 'cleared'
                })

        return {
            'service': service_name,
            'containers_cleared': len(results),
            'results': results
        }

    def trigger_discovery(self) -> Dict[str, Any]:
        agents = self._agent_registry.get_all()
        if not agents:
            return {'error': 'No agents connected', 'status_code': 404}

        for agent in agents:
            sid = self._get_agent_sid(agent.hostname)
            if sid:
                self._send_command(sid, 'discover_containers', {}, f"discover_{agent.hostname}_{int(time.time())}")

        return {
            'status': 'discovery_triggered',
            'agents': len(agents)
        }
