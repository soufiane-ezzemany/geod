import type { Metrics } from "@/hooks/useMetrics";

export interface ChartDataPoint {
  name: string;
  cpu: number;
  mem: number;
  disk: number;
  throughputSentMbps: number;
  throughputRecvMbps: number;
  ppsSent: number;
  ppsRecv: number;
}

/**
 * Process raw metrics into chart-ready data with calculated rates
 */
export function processMetricsForChart(metrics: Metrics[]): ChartDataPoint[] {
  if (!metrics || metrics.length === 0) return [];

  // Sort by timestamp
  const sortedMetrics = [...metrics].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return sortedMetrics
    .map((m, i, arr) => {
      // If backend provided pre-calculated rates (History Mode), use them
      if (m.network?.throughput_sent_mbps !== undefined) {
        return {
          name: new Date(m.timestamp).toLocaleTimeString(),
          cpu: m.system?.cpu_percent || 0,
          mem: m.system?.memory?.percent || 0,
          disk: m.system?.disk?.percent || 0,
          throughputSentMbps: parseFloat(
            (m.network.throughput_sent_mbps || 0).toFixed(2)
          ),
          throughputRecvMbps: parseFloat(
            (m.network.throughput_recv_mbps || 0).toFixed(2)
          ),
          ppsSent: Math.round(m.network.pps_sent || 0),
          ppsRecv: Math.round(m.network.pps_recv || 0),
        };
      }

      // Fallback: Calculate from diff (Live Mode)
      let throughputSentMbps = 0;
      let throughputRecvMbps = 0;
      let ppsSent = 0;
      let ppsRecv = 0;

      if (i > 0) {
        const prev = arr[i - 1];
        const timeDiff =
          (new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
          1000;

        if (timeDiff > 0) {
          // Bytes -> Bits -> Megabits / Seconds
          const deltaBytesSent =
            (m.network?.bytes_sent || 0) - (prev.network?.bytes_sent || 0);
          const deltaBytesRecv =
            (m.network?.bytes_recv || 0) - (prev.network?.bytes_recv || 0);

          if (deltaBytesSent >= 0)
            throughputSentMbps = (deltaBytesSent * 8) / (1024 * 1024) / timeDiff;
          if (deltaBytesRecv >= 0)
            throughputRecvMbps = (deltaBytesRecv * 8) / (1024 * 1024) / timeDiff;

          const deltaPktsSent =
            (m.network?.packets_sent || 0) - (prev.network?.packets_sent || 0);
          const deltaPktsRecv =
            (m.network?.packets_recv || 0) - (prev.network?.packets_recv || 0);

          if (deltaPktsSent >= 0) ppsSent = deltaPktsSent / timeDiff;
          if (deltaPktsRecv >= 0) ppsRecv = deltaPktsRecv / timeDiff;
        }
      }

      return {
        name: new Date(m.timestamp).toLocaleTimeString(),
        cpu: m.system?.cpu_percent || 0,
        mem: m.system?.memory?.percent || 0,
        disk: m.system?.disk?.percent || 0,
        throughputSentMbps: parseFloat(throughputSentMbps.toFixed(2)),
        throughputRecvMbps: parseFloat(throughputRecvMbps.toFixed(2)),
        ppsSent: Math.round(ppsSent),
        ppsRecv: Math.round(ppsRecv),
      };
    })
    .slice(1); // Remove first element as it has no rate
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, unit: "GB" | "MB" = "GB"): string {
  if (!bytes) return "-";
  if (unit === "GB") return (bytes / 1024 / 1024 / 1024).toFixed(1);
  return (bytes / 1024 / 1024).toFixed(0);
}
