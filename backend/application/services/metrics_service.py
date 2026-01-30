"""Metrics service for managing Prometheus metrics."""

from prometheus_client import Gauge


class MetricsService:
    """Service for managing Prometheus metrics."""

    def __init__(self):
        self.cpu_usage = Gauge('geod_cpu_usage_percent', 'CPU Usage Percent', ['hostname'])
        self.memory_usage = Gauge('geod_memory_usage_percent', 'Memory Usage Percent', ['hostname'])
        self.memory_used = Gauge('geod_memory_used_bytes', 'Memory Used Bytes', ['hostname'])
        self.memory_total = Gauge('geod_memory_total_bytes', 'Memory Total Bytes', ['hostname'])
        self.disk_usage = Gauge('geod_disk_usage_percent', 'Disk Usage Percent', ['hostname'])
        self.disk_used = Gauge('geod_disk_used_bytes', 'Disk Used Bytes', ['hostname'])
        self.disk_total = Gauge('geod_disk_total_bytes', 'Disk Total Bytes', ['hostname'])

        self.bytes_sent = Gauge('geod_network_bytes_sent_total', 'Network Bytes Sent Total', ['hostname'])
        self.bytes_recv = Gauge('geod_network_bytes_recv_total', 'Network Bytes Recv Total', ['hostname'])
        self.packets_sent = Gauge('geod_network_packets_sent_total', 'Network Packets Sent Total', ['hostname'])
        self.packets_recv = Gauge('geod_network_packets_recv_total', 'Network Packets Recv Total', ['hostname'])
        self.errors_in = Gauge('geod_network_errors_in_total', 'Network Errors In Total', ['hostname'])
        self.errors_out = Gauge('geod_network_errors_out_total', 'Network Errors Out Total', ['hostname'])
        self.drops_in = Gauge('geod_network_drops_in_total', 'Network Drops In Total', ['hostname'])
        self.drops_out = Gauge('geod_network_drops_out_total', 'Network Drops Out Total', ['hostname'])
        self.active_connections = Gauge('geod_network_active_connections', 'Network Active Connections', ['hostname'])

        self.latency_link = Gauge('geod_network_latency_ms', 'Network Latency MS', ['source', 'target'])
        self.packet_loss_link = Gauge('geod_network_packet_loss_percent', 'Network Packet Loss Percent', ['source', 'target'])
        self.latency_avg = Gauge('geod_network_latency_avg_ms', 'Network Latency Average MS', ['hostname'])
        self.packet_loss_avg = Gauge('geod_network_packet_loss_avg_percent', 'Network Packet Loss Average Percent', ['hostname'])

    def update_system_metrics(self, hostname: str, system_data: dict) -> None:
        self.cpu_usage.labels(hostname=hostname).set(system_data['cpu_percent'])

        memory = system_data['memory']
        self.memory_usage.labels(hostname=hostname).set(memory['percent'])
        self.memory_used.labels(hostname=hostname).set(memory['used'])
        self.memory_total.labels(hostname=hostname).set(memory['total'])

        disk = system_data['disk']
        self.disk_usage.labels(hostname=hostname).set(disk['percent'])
        self.disk_used.labels(hostname=hostname).set(disk['used'])
        self.disk_total.labels(hostname=hostname).set(disk['total'])

    def update_network_metrics(self, hostname: str, network_data: dict) -> None:
        self.bytes_sent.labels(hostname=hostname).set(network_data['bytes_sent'])
        self.bytes_recv.labels(hostname=hostname).set(network_data['bytes_recv'])
        self.packets_sent.labels(hostname=hostname).set(network_data['packets_sent'])
        self.packets_recv.labels(hostname=hostname).set(network_data['packets_recv'])
        self.errors_in.labels(hostname=hostname).set(network_data['errors_in'])
        self.errors_out.labels(hostname=hostname).set(network_data['errors_out'])
        self.drops_in.labels(hostname=hostname).set(network_data['drop_in'])
        self.drops_out.labels(hostname=hostname).set(network_data['drop_out'])
        self.active_connections.labels(hostname=hostname).set(network_data['active_connections'])

    def update_link_metrics(self, source: str, target: str, latency: float, packet_loss: int) -> None:
        self.latency_link.labels(source=source, target=target).set(latency)
        self.packet_loss_link.labels(source=source, target=target).set(packet_loss)

    def update_average_metrics(self, hostname: str, latency_avg: float, packet_loss_avg: float) -> None:
        self.latency_avg.labels(hostname=hostname).set(latency_avg)
        self.packet_loss_avg.labels(hostname=hostname).set(packet_loss_avg)
