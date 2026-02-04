import { StatsCard } from "@/components/stats/StatsCard";
import { useMetrics } from "@/hooks/useMetrics";
import { useMetricsHistory } from "@/hooks/useMetricsHistory";
import {
  Activity,
  AlertCircle,
  Clock,
  HardDrive,
  Network,
  Server,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function Metrics() {
  const { metrics } = useMetrics();
  const [timeRange, setTimeRange] = useState("live");

  const { historyData, loading: loadingHistory } = useMetricsHistory(timeRange);

  // Use metrics directly (it is already grouped by agent)
  const metricsByAgent = metrics;

  const activeData = timeRange === "live" ? metricsByAgent : historyData;

  return (
    <div className="space-y-8 p-6 h-full flex flex-col overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            System & Network Metrics
          </h1>
          <p className="text-muted-foreground">
            {timeRange === "live"
              ? "Real-time performance monitoring."
              : "Historical performance data."}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
          <Clock className="w-4 h-4 ml-2 text-muted-foreground" />
          <select
            className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer p-2 outline-none"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="live">Live (Real-time)</option>
            <option value="15m">Last 15 Minutes</option>
            <option value="1h">Last 1 Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
        </div>
      </div>

      {loadingHistory && (
        <div className="p-8 text-center text-muted-foreground">
          Loading historical data...
        </div>
      )}

      {!loadingHistory && Object.keys(activeData).length > 0 ? (
        Object.entries(activeData).map(([agentId, agentMetrics]) => {
          if (!agentMetrics || agentMetrics.length === 0) return null;

          // Sort metrics by time
          const sortedMetrics = [...agentMetrics];
          if (sortedMetrics[0] && sortedMetrics[0].timestamp) {
            sortedMetrics.sort(
              (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime(),
            );
          }

          const latest = sortedMetrics[sortedMetrics.length - 1]; // Last item is latest after sort

          // Calculate Rates for Charts (Delta / Time) or use pre-calculated
          const chartData = sortedMetrics
            .map((m, i, arr) => {
              // If backend provided pre-calculated rates (History Mode), use them
              if (m.network?.throughput_sent_mbps !== undefined) {
                return {
                  name: new Date(m.timestamp).toLocaleTimeString(),
                  cpu: m.system?.cpu_percent || 0,
                  mem: m.system?.memory?.percent || 0,
                  disk: m.system?.disk?.percent || 0,
                  throughputSentMbps: parseFloat(
                    (m.network.throughput_sent_mbps || 0).toFixed(2),
                  ),
                  throughputRecvMbps: parseFloat(
                    (m.network.throughput_recv_mbps || 0).toFixed(2),
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
                  (new Date(m.timestamp).getTime() -
                    new Date(prev.timestamp).getTime()) /
                  1000;

                if (timeDiff > 0) {
                  // Bytes -> Bits -> Megabits / Seconds
                  const deltaBytesSent =
                    (m.network?.bytes_sent || 0) -
                    (prev.network?.bytes_sent || 0);
                  const deltaBytesRecv =
                    (m.network?.bytes_recv || 0) -
                    (prev.network?.bytes_recv || 0);

                  // Handle counter resets (restarts)
                  if (deltaBytesSent >= 0)
                    throughputSentMbps =
                      (deltaBytesSent * 8) / (1024 * 1024) / timeDiff;
                  if (deltaBytesRecv >= 0)
                    throughputRecvMbps =
                      (deltaBytesRecv * 8) / (1024 * 1024) / timeDiff;

                  const deltaPktsSent =
                    (m.network?.packets_sent || 0) -
                    (prev.network?.packets_sent || 0);
                  const deltaPktsRecv =
                    (m.network?.packets_recv || 0) -
                    (prev.network?.packets_recv || 0);

                  if (deltaPktsSent >= 0) ppsSent = deltaPktsSent / timeDiff;
                  if (deltaPktsRecv >= 0) ppsRecv = deltaPktsRecv / timeDiff;
                }
              }

              return {
                name: new Date(m.timestamp).toLocaleTimeString(),
                cpu: m.system?.cpu_percent || 0,
                mem: m.system?.memory?.percent || 0,
                disk: m.system?.disk?.percent || 0,
                // Rates
                throughputSentMbps: parseFloat(throughputSentMbps.toFixed(2)),
                throughputRecvMbps: parseFloat(throughputRecvMbps.toFixed(2)),
                ppsSent: Math.round(ppsSent),
                ppsRecv: Math.round(ppsRecv),
              };
            })
            .slice(1); // Remove first element as it has no rate (0)

          // Safe access for display values
          const diskUsedGB = latest.system?.disk?.used
            ? (latest.system.disk.used / 1024 / 1024 / 1024).toFixed(1)
            : "-";
          const diskTotalGB = latest.system?.disk?.total
            ? (latest.system.disk.total / 1024 / 1024 / 1024).toFixed(1)
            : "-";
          const memUsedMB = latest.system?.memory?.used
            ? (latest.system.memory.used / 1024 / 1024).toFixed(0)
            : "-";

          return (
            <div
              key={agentId}
              className="space-y-6 border rounded-xl p-6 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <Server className="w-6 h-6 text-primary" />
                  {agentId}
                </h2>
                <div className="text-sm text-muted-foreground font-mono">
                  {timeRange === "live" ? "Live" : "History"} | Last data:{" "}
                  {new Date(latest.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* --- System Health Section --- */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  System Health
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left: 2x2 Grid of Cards */}
                  <div className="grid grid-cols-2 gap-4 lg:col-span-1">
                    <StatsCard
                      title="CPU Usage"
                      value={`${latest.system?.cpu_percent || 0}%`}
                      description="Total Load"
                      icon={Activity}
                    />
                    <StatsCard
                      title="Memory Usage"
                      value={`${latest.system?.memory?.percent || 0}%`}
                      description={`${memUsedMB} MB Used`}
                      icon={Server}
                    />
                    <StatsCard
                      title="Disk Usage"
                      value={`${latest.system?.disk?.percent || 0}%`}
                      description={`${diskUsedGB} / ${diskTotalGB} GB`}
                      icon={HardDrive}
                    />
                    <StatsCard
                      title="Active Connections"
                      value={latest.network?.active_connections || 0}
                      description="Open Sockets"
                      icon={Wifi}
                    />
                  </div>

                  {/* Right: Graph */}
                  <div className="lg:col-span-2 h-full min-h-[300px]">
                    <div className="bg-background/50 rounded-lg p-4 border h-full">
                      <h4 className="mb-4 text-sm font-semibold">
                        Resource History
                      </h4>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis dataKey="name" hide />
                          <YAxis domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "white",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="cpu"
                            stroke="#ef4444"
                            strokeWidth={2}
                            dot={false}
                            name="CPU %"
                          />
                          <Line
                            type="monotone"
                            dataKey="mem"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            name="Mem %"
                          />
                          <Line
                            type="monotone"
                            dataKey="disk"
                            stroke="#eab308"
                            strokeWidth={2}
                            dot={false}
                            name="Disk %"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Network Health Section --- */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Network Interface
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                    <div className="text-sm text-blue-600 font-medium mb-1 flex items-center gap-2">
                      <Network className="w-4 h-4" /> Traffic Volume
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {(
                        (latest.network?.bytes_sent || 0) /
                        1024 /
                        1024
                      ).toFixed(1)}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        MB Sent
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {(
                        (latest.network?.bytes_recv || 0) /
                        1024 /
                        1024
                      ).toFixed(1)}{" "}
                      MB Recv
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                    <div className="text-sm text-emerald-600 font-medium mb-1 flex items-center gap-2">
                      <Activity className="w-4 h-4" /> Packet Flow
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {(latest.network?.packets_sent || 0).toLocaleString()}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        Tx
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {(latest.network?.packets_recv || 0).toLocaleString()} Rx
                    </div>
                  </div>

                  <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
                    <div className="text-sm text-red-600 font-medium mb-1 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" /> Errors & Drops
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {(latest.network?.errors_in || 0) +
                        (latest.network?.errors_out || 0)}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        Errors
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {(latest.network?.drop_in || 0) +
                        (latest.network?.drop_out || 0)}{" "}
                      Drops
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-100">
                    <div className="text-sm text-amber-600 font-medium mb-1 flex items-center gap-2">
                      <Wifi className="w-4 h-4" /> Latency & Loss
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      {latest.network?.latency_avg != null
                        ? latest.network.latency_avg.toFixed(1)
                        : "-"}{" "}
                      <span className="text-sm font-normal text-slate-500">
                        ms Avg
                      </span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {latest.network?.packet_loss_avg != null
                        ? latest.network.packet_loss_avg.toFixed(1)
                        : "0"}
                      % Loss
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
                  {/* Bandwidth Graph */}
                  <div className="bg-background/50 rounded-lg p-4 border">
                    <h4 className="mb-4 text-sm font-semibold">
                      Throughput (Mbps)
                    </h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="throughputSentMbps"
                          stackId="1"
                          stroke="#8884d8"
                          fill="#8884d8"
                          name="Tx (Mbps)"
                        />
                        <Area
                          type="monotone"
                          dataKey="throughputRecvMbps"
                          stackId="1"
                          stroke="#82ca9d"
                          fill="#82ca9d"
                          name="Rx (Mbps)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Packets Graph */}
                  <div className="bg-background/50 rounded-lg p-4 border">
                    <h4 className="mb-4 text-sm font-semibold">
                      Packet Rate (PPS)
                    </h4>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" hide />
                        <YAxis />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="ppsSent"
                          stroke="#f59e0b"
                          dot={false}
                          name="Tx PPS"
                        />
                        <Line
                          type="monotone"
                          dataKey="ppsRecv"
                          stroke="#10b981"
                          dot={false}
                          name="Rx PPS"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
          <Server className="w-16 h-16 mb-4 opacity-20" />
          <p>
            {timeRange === "live"
              ? "Waiting for agent metrics..."
              : "No historical data found for the selected period."}
          </p>
        </div>
      )}
    </div>
  );
}
