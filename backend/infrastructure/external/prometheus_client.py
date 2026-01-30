"""Prometheus client for querying metrics history."""

import os
import requests
from typing import List, Dict, Any
from config.logging_config import setup_logging

logger = setup_logging()


class PrometheusClient:
    """Client for querying Prometheus API."""

    def __init__(self, base_url: str = None):
        """Initialize Prometheus client.

        Args:
            base_url: Prometheus base URL (default: from PROMETHEUS_URL env var)
        """
        self.base_url = base_url or os.environ.get('PROMETHEUS_URL', 'http://prometheus:9090')

    def query_range(self, query: str, start: str, end: str, step: str) -> List[Dict[str, Any]]:
        """Query Prometheus range API.

        Args:
            query: PromQL query string
            start: Start timestamp (seconds)
            end: End timestamp (seconds)
            step: Step interval (e.g., '15s', '1m')

        Returns:
            List of result series from Prometheus
        """
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
        """Parse step string to seconds.

        Args:
            step: Step string (e.g., '15s', '1m', '2h')

        Returns:
            Step value in seconds
        """
        if step.endswith('s'):
            return int(step[:-1])
        elif step.endswith('m'):
            return int(step[:-1]) * 60
        elif step.endswith('h'):
            return int(step[:-1]) * 3600
        return 15  # default

    @staticmethod
    def calculate_rate_window(step: str, min_seconds: int = 60, multiplier: int = 4) -> str:
        """Calculate rate window for Prometheus queries.

        Args:
            step: Step interval string
            min_seconds: Minimum window in seconds
            multiplier: Multiplier for step value

        Returns:
            Rate window string (e.g., '60s', '120s')
        """
        step_val = PrometheusClient.parse_step_to_seconds(step)
        return f"{max(min_seconds, step_val * multiplier)}s"
