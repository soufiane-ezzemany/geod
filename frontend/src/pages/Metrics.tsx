import { StatsCard } from "@/components/stats/StatsCard";
import { useMetrics } from "@/hooks/useMetrics";
import { useMetricsHistory } from "@/hooks/useMetricsHistory";
import { formatBytes, processMetricsForChart } from "@/lib/metrics-utils";
import {
  Activity,
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

  // Use custom hook for history
  const { historyData, loading: loadingHistory } = useMetricsHistory(timeRange);

  // Determine which data to use
  const activeData = timeRange === "live" ? metrics : historyData;

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

          // Process data using utility
          const chartData = processMetricsForChart(agentMetrics);
          const latest = agentMetrics[agentMetrics.length - 1];

          // Safe access for display values
          const diskUsedGB = latest.system?.disk?.used
            ? formatBytes(latest.system.disk.used, "GB")
            : "-";
          const diskTotalGB = latest.system?.disk?.total
            ? formatBytes(latest.system.disk.total, "GB")
            : "-";
          const memUsedMB = latest.system?.memory?.used
            ? formatBytes(latest.system.memory.used, "MB")
            : "-";
          const memTotalMB = latest.system?.memory?.total
            ? formatBytes(latest.system.memory.total, "MB")
            : "-";

          return (
            <div
              key={agentId}
              className="space-y-4 border-t pt-8 first:border-t-0 first:pt-0"
            >
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">{agentId}</h2>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                  {agentMetrics.length} samples
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                  title="CPU Usage"
                  value={`${latest.system?.cpu_percent?.toFixed(1) || 0}%`}
                  description="Total Load"
                  icon={Activity}
                />
                <StatsCard
                  title="Memory Usage"
                  value={`${latest.system?.memory?.percent?.toFixed(1) || 0}%`}
                  description={`${memUsedMB} / ${memTotalMB} MB`}
                  icon={HardDrive}
                />
                <StatsCard
                  title="Disk Usage"
                  value={`${latest.system?.disk?.percent?.toFixed(1) || 0}%`}
                  description={`${diskUsedGB} / ${diskTotalGB} GB`}
                  icon={HardDrive}
                />
                <StatsCard
                  title="Network Traffic"
                  value={`${chartData[chartData.length - 1]?.throughputRecvMbps || 0} Mbps`}
                  description={`⬇ ${chartData[chartData.length - 1]?.throughputRecvMbps || 0} / ⬆ ${chartData[chartData.length - 1]?.throughputSentMbps || 0}`}
                  icon={Wifi}
                />
              </div>

              {/* Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 1. Throughput Chart */}
                <div className="p-4 border rounded-xl bg-card shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Network className="w-4 h-4" /> Throughput (Mbps)
                    </h3>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient
                            id={`colorSent-${agentId}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#8884d8"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#8884d8"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id={`colorRecv-${agentId}`}
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#82ca9d"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#82ca9d"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="name"
                          fontSize={10}
                          tickMargin={10}
                          minTickGap={30}
                        />
                        <YAxis fontSize={10} width={40} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                          labelStyle={{ color: "#666" }}
                        />
                        <Legend />
                        <Area
                          type="monotone"
                          dataKey="throughputSentMbps"
                          name="Upload (Mbps)"
                          stroke="#8884d8"
                          fillOpacity={1}
                          fill={`url(#colorSent-${agentId})`}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="throughputRecvMbps"
                          name="Download (Mbps)"
                          stroke="#82ca9d"
                          fillOpacity={1}
                          fill={`url(#colorRecv-${agentId})`}
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. System Resource Chart */}
                <div className="p-4 border rounded-xl bg-card shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4" /> System Resources (%)
                    </h3>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis
                          dataKey="name"
                          fontSize={10}
                          tickMargin={10}
                          minTickGap={30}
                        />
                        <YAxis domain={[0, 100]} fontSize={10} width={30} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cpu"
                          name="CPU %"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="mem"
                          name="Memory %"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="disk"
                          name="Disk %"
                          stroke="#eab308"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
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
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <Activity className="w-12 h-12 mb-4 opacity-20" />
          <p>No metrics data available.</p>
          <p className="text-sm">Ensure agents are connected and running.</p>
        </div>
      )}
    </div>
  );
}
