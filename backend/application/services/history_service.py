"""History service for querying historical metrics data.

Handles Prometheus queries for historical metrics and formats
the data for frontend consumption.
"""

from datetime import datetime
from typing import List, Dict, Any, Callable, Optional
from infrastructure.external.prometheus_client import PrometheusClient


class HistoryService:
    """Service for retrieving historical metrics data.

    Orchestrates Prometheus queries and formats results into
    a unified time-series structure.
    """

    def __init__(self, prometheus_client: Optional[PrometheusClient] = None):
        """Initialize the history service.

        Args:
            prometheus_client: Optional Prometheus client (creates new if not provided)
        """
        self._prom_client = prometheus_client or PrometheusClient()

    def get_agent_history(
        self,
        hostname: str,
        start: str,
        end: str,
        step: str = '15s'
    ) -> List[Dict[str, Any]]:
        """Get historical metrics for an agent.

        Args:
            hostname: Agent hostname
            start: Start timestamp (seconds)
            end: End timestamp (seconds)
            step: Query resolution (e.g., '15s', '1m')

        Returns:
            List of time-series data points sorted by timestamp
        """
        # Calculate rate window for counter metrics
        rate_window = self._prom_client.calculate_rate_window(step)

        # Query all metrics from Prometheus
        metrics_data = self._query_all_metrics(hostname, start, end, step, rate_window)

        # Format and merge into unified time-series
        history = self._build_history_timeline(metrics_data)

        # Sort by timestamp
        return sorted(history.values(), key=lambda x: x['timestamp'])

    def _query_all_metrics(
        self,
        hostname: str,
        start: str,
        end: str,
        step: str,
        rate_window: str
    ) -> Dict[str, Any]:
        """Query all metrics from Prometheus.

        Args:
            hostname: Agent hostname
            start: Start timestamp
            end: End timestamp
            step: Query resolution
            rate_window: Rate calculation window

        Returns:
            Dictionary mapping metric names to their data
        """
        return {
            # System metrics
            'cpu': self._prom_client.query_range(
                f'geod_cpu_usage_percent{{hostname="{hostname}"}}',
                start, end, step
            ),
            'mem_percent': self._prom_client.query_range(
                f'geod_memory_usage_percent{{hostname="{hostname}"}}',
                start, end, step
            ),
            'mem_used': self._prom_client.query_range(
                f'geod_memory_used_bytes{{hostname="{hostname}"}}',
                start, end, step
            ),
            'mem_total': self._prom_client.query_range(
                f'geod_memory_total_bytes{{hostname="{hostname}"}}',
                start, end, step
            ),
            'disk_percent': self._prom_client.query_range(
                f'geod_disk_usage_percent{{hostname="{hostname}"}}',
                start, end, step
            ),
            'disk_used': self._prom_client.query_range(
                f'geod_disk_used_bytes{{hostname="{hostname}"}}',
                start, end, step
            ),
            'disk_total': self._prom_client.query_range(
                f'geod_disk_total_bytes{{hostname="{hostname}"}}',
                start, end, step
            ),

            # Network throughput (converted to Mbps)
            'net_sent': self._prom_client.query_range(
                f'rate(geod_network_bytes_sent_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000',
                start, end, step
            ),
            'net_recv': self._prom_client.query_range(
                f'rate(geod_network_bytes_recv_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000',
                start, end, step
            ),

            # Network packets (PPS)
            'pkts_sent': self._prom_client.query_range(
                f'rate(geod_network_packets_sent_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'pkts_recv': self._prom_client.query_range(
                f'rate(geod_network_packets_recv_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),

            # Network latency and loss (averaged over time)
            'latency': self._prom_client.query_range(
                f'avg_over_time(geod_network_latency_avg_ms{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'loss': self._prom_client.query_range(
                f'avg_over_time(geod_network_packet_loss_avg_percent{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),

            # Network errors and drops (rates)
            'err_in': self._prom_client.query_range(
                f'rate(geod_network_errors_in_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'err_out': self._prom_client.query_range(
                f'rate(geod_network_errors_out_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'drop_in': self._prom_client.query_range(
                f'rate(geod_network_drops_in_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'drop_out': self._prom_client.query_range(
                f'rate(geod_network_drops_out_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),

            # Network connections
            'active_conn': self._prom_client.query_range(
                f'geod_network_active_connections{{hostname="{hostname}"}}',
                start, end, step
            ),
        }

    def _build_history_timeline(self, metrics_data: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
        """Build unified timeline from individual metric series.

        Args:
            metrics_data: Dictionary of metric names to their data

        Returns:
            Dictionary mapping timestamps to data points
        """
        history: Dict[int, Dict[str, Any]] = {}

        # Define mapping of metrics to their location in the output structure
        metric_mappings = [
            ('cpu', 'system', 'cpu_percent', float),
            ('mem_percent', 'system', 'memory.percent', float),
            ('mem_used', 'system', 'memory.used', float),
            ('mem_total', 'system', 'memory.total', float),
            ('disk_percent', 'system', 'disk.percent', float),
            ('disk_used', 'system', 'disk.used', float),
            ('disk_total', 'system', 'disk.total', float),
            ('net_sent', 'network', 'throughput_sent_mbps', float),
            ('net_recv', 'network', 'throughput_recv_mbps', float),
            ('pkts_sent', 'network', 'pps_sent', float),
            ('pkts_recv', 'network', 'pps_recv', float),
            ('err_in', 'network', 'errors_in_rate', float),
            ('err_out', 'network', 'errors_out_rate', float),
            ('drop_in', 'network', 'drop_in_rate', float),
            ('drop_out', 'network', 'drop_out_rate', float),
            ('active_conn', 'network', 'active_connections', int),
            ('latency', 'network', 'latency_avg', float),
            ('loss', 'network', 'packet_loss_avg', float),
        ]

        # Process each metric
        for metric_key, category, subkey, cast_type in metric_mappings:
            series_data = metrics_data.get(metric_key)
            self._process_series(history, series_data, category, subkey, cast_type)

        return history

    def _process_series(
        self,
        history: Dict[int, Dict[str, Any]],
        series_data: Any,
        category: str,
        subkey: str,
        cast: Callable = float
    ) -> None:
        """Process a single metric series and add to history timeline.

        Args:
            history: History timeline dictionary to update
            series_data: Prometheus series data
            category: Category ('system' or 'network')
            subkey: Metric key (e.g., 'cpu_percent', 'memory.percent')
            cast: Type casting function (float or int)
        """
        if not series_data:
            return

        values = series_data[0].get('values', [])
        for timestamp, value in values:
            timestamp_int = int(timestamp)

            # Initialize timestamp entry if not exists
            if timestamp_int not in history:
                history[timestamp_int] = {
                    'timestamp': datetime.fromtimestamp(timestamp_int).isoformat(),
                    'system': {'memory': {}, 'disk': {}},
                    'network': {}
                }

            target = history[timestamp_int]

            # Place value in correct location
            if category == 'system':
                if subkey == 'cpu_percent':
                    target['system']['cpu_percent'] = cast(value)
                elif subkey.startswith('memory.'):
                    key = subkey.split('.')[1]
                    target['system']['memory'][key] = cast(value)
                elif subkey.startswith('disk.'):
                    key = subkey.split('.')[1]
                    target['system']['disk'][key] = cast(value)
            elif category == 'network':
                target['network'][subkey] = cast(value)
