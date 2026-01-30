"""History service for querying historical metrics data."""

from datetime import datetime
from typing import List, Dict, Any, Callable, Optional
from infrastructure.external.prometheus_client import PrometheusClient


class HistoryService:
    """Service for retrieving historical metrics from Prometheus."""

    def __init__(self, prometheus_client: Optional[PrometheusClient] = None):
        self._prom_client = prometheus_client or PrometheusClient()

    def get_agent_history(
        self,
        hostname: str,
        start: str,
        end: str,
        step: str = '15s'
    ) -> List[Dict[str, Any]]:
        rate_window = self._prom_client.calculate_rate_window(step)
        metrics_data = self._query_all_metrics(hostname, start, end, step, rate_window)
        history = self._build_history_timeline(metrics_data)
        return sorted(history.values(), key=lambda x: x['timestamp'])

    def _query_all_metrics(
        self,
        hostname: str,
        start: str,
        end: str,
        step: str,
        rate_window: str
    ) -> Dict[str, Any]:
        return {
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
            'net_sent': self._prom_client.query_range(
                f'rate(geod_network_bytes_sent_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000',
                start, end, step
            ),
            'net_recv': self._prom_client.query_range(
                f'rate(geod_network_bytes_recv_total{{hostname="{hostname}"}}[{rate_window}]) * 8 / 1000000',
                start, end, step
            ),
            'pkts_sent': self._prom_client.query_range(
                f'rate(geod_network_packets_sent_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'pkts_recv': self._prom_client.query_range(
                f'rate(geod_network_packets_recv_total{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'latency': self._prom_client.query_range(
                f'avg_over_time(geod_network_latency_avg_ms{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
            'loss': self._prom_client.query_range(
                f'avg_over_time(geod_network_packet_loss_avg_percent{{hostname="{hostname}"}}[{rate_window}])',
                start, end, step
            ),
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
            'active_conn': self._prom_client.query_range(
                f'geod_network_active_connections{{hostname="{hostname}"}}',
                start, end, step
            ),
        }

    def _build_history_timeline(self, metrics_data: Dict[str, Any]) -> Dict[int, Dict[str, Any]]:
        history: Dict[int, Dict[str, Any]] = {}
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
        if not series_data:
            return

        values = series_data[0].get('values', [])
        for timestamp, value in values:
            timestamp_int = int(timestamp)

            if timestamp_int not in history:
                history[timestamp_int] = {
                    'timestamp': datetime.fromtimestamp(timestamp_int).isoformat(),
                    'system': {'memory': {}, 'disk': {}},
                    'network': {}
                }

            target = history[timestamp_int]
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
