"""Prometheus client for querying metrics history."""

import os
import requests
from typing import List, Dict, Any
from config.logging_config import setup_logging

logger = setup_logging()


class PrometheusClient:
    """Client for querying Prometheus API."""

    def __init__(self, base_url: str = None):
        self.base_url = base_url or os.environ.get('PROMETHEUS_URL', 'http://prometheus:9090')

    def query_range(self, query: str, start: str, end: str, step: str) -> List[Dict[str, Any]]:
        try:
            url = f'{self.base_url}/api/v1/query_range'
            response = requests.get(url, params={
                'query': query,
                'start': start,
                'end': end,
                'step': step
            })
            if response.status_code == 200:
                return response.json().get('data', {}).get('result', [])
            return []
        except Exception as e:
            logger.error(f"Prometheus query error: {e}")
            return []

    @staticmethod
    def parse_step_to_seconds(step: str) -> int:
        if step.endswith('s'):
            return int(step[:-1])
        elif step.endswith('m'):
            return int(step[:-1]) * 60
        elif step.endswith('h'):
            return int(step[:-1]) * 3600
        return 15

    @staticmethod
    def calculate_rate_window(step: str, min_seconds: int = 60, multiplier: int = 4) -> str:
        """Calculate appropriate rate window for counter metrics."""
        step_val = PrometheusClient.parse_step_to_seconds(step)
        return f"{max(min_seconds, step_val * multiplier)}s"
