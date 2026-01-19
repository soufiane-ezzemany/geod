import { StatsCard } from "@/components/stats/StatsCard";
import { useMetrics, type Metrics as Metric } from "@/hooks/useMetrics";
import { Activity, HardDrive, Network, Server, Wifi, AlertCircle } from "lucide-react";
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

  // Group metrics by agent_id
  const metricsByAgent: Record<string, Metric[]> = metrics.reduce(
    (acc: Record<string, Metric[]>, metric: Metric) => {
      const agentId = metric.agent_id || "unknown";
      if (!acc[agentId]) {
        acc[agentId] = [];
      }
      acc[agentId].push(metric);
      return acc;
    },
    {}
  );

  // For expanding/collapsing raw JSON
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-8 p-6 h-full flex flex-col overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System & Network Metrics</h1>
        <p className="text-muted-foreground">
          Real-time performance monitoring for all connected agents.
        </p>
      </div>
      
      {Object.keys(metricsByAgent).length > 0 ? (
        Object.entries(metricsByAgent).map(([agentId, agentMetrics]) => {
          // Sort metrics by time
          const sortedMetrics = [...agentMetrics];
          if (sortedMetrics[0] && sortedMetrics[0].timestamp) {
            sortedMetrics.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          }
          
          const latest = sortedMetrics[sortedMetrics.length - 1]; // Last item is latest after sort
          
          // Prepare data for charts
          const chartData = sortedMetrics.map((m) => ({
            name: new Date(m.timestamp).toLocaleTimeString(),
            cpu: m.system.cpu_percent,
            mem: m.system.memory.percent,
            disk: m.system.disk.percent,
            bytesSent: (m.network.bytes_sent / 1024 / 1024).toFixed(2), // MB
            bytesRecv: (m.network.bytes_recv / 1024 / 1024).toFixed(2), // MB
            packetsSent: m.network.packets_sent,
            packetsRecv: m.network.packets_recv,
            errors: m.network.errors_in + m.network.errors_out,
            drops: m.network.drop_in + m.network.drop_out,
          }));

          const diskUsedGB = (latest.system.disk.used / 1024 / 1024 / 1024).toFixed(1);
          const diskTotalGB = (latest.system.disk.total / 1024 / 1024 / 1024).toFixed(1);

          return (
            <div key={agentId} className="space-y-6 border rounded-xl p-6 bg-card shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                    <Server className="w-6 h-6 text-primary" />
                    {agentId}
                </h2>
                <div className="text-sm text-muted-foreground font-mono">
                    Last update: {new Date(latest.timestamp).toLocaleTimeString()}
                </div>
              </div>

              {/* --- System Health Section --- */}
              <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">System Health</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <StatsCard
                      title="CPU Usage"
                      value={`${latest.system.cpu_percent}%`}
                      description="Total Load"
                      icon={Activity}
                    />
                    <StatsCard
                      title="Memory Usage"
                      value={`${latest.system.memory.percent}%`}
                      description={`${(latest.system.memory.used / 1024 / 1024).toFixed(0)} MB Used`}
                      icon={Server}
                    />
                    <StatsCard
                      title="Disk Usage"
                      value={`${latest.system.disk.percent}%`}
                      description={`${diskUsedGB} / ${diskTotalGB} GB`}
                      icon={HardDrive}
                    />
                    <StatsCard
                      title="Active Connections"
                      value={latest.network.active_connections}
                      description="Open Sockets"
                      icon={Wifi}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
                      {/* CPU/Mem/Disk Graph */}
                      <div className="bg-background/50 rounded-lg p-4 border">
                          <h4 className="mb-4 text-sm font-semibold">Resource History</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" hide />
                              <YAxis domain={[0, 100]} />
                              <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', fontSize: '12px' }} />
                              <Legend />
                              <Line type="monotone" dataKey="cpu" stroke="#ef4444" strokeWidth={2} dot={false} name="CPU %" />
                              <Line type="monotone" dataKey="mem" stroke="#3b82f6" strokeWidth={2} dot={false} name="Mem %" />
                              <Line type="monotone" dataKey="disk" stroke="#eab308" strokeWidth={2} dot={false} name="Disk %" />
                            </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>

              {/* --- Network Health Section --- */}
              <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Network Interface</h3>
                  <div className="grid gap-4 md:grid-cols-3">
                     <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
                        <div className="text-sm text-blue-600 font-medium mb-1 flex items-center gap-2">
                            <Network className="w-4 h-4" /> Traffic Volume
                        </div>
                        <div className="text-2xl font-bold text-slate-800">
                            {(latest.network.bytes_sent / 1024 / 1024).toFixed(1)} <span className="text-sm font-normal text-slate-500">MB Sent</span>
                        </div>
                        <div className="text-sm text-slate-500">
                            {(latest.network.bytes_recv / 1024 / 1024).toFixed(1)} MB Recv
                        </div>
                     </div>

                     <div className="p-4 bg-emerald-50/50 rounded-lg border border-emerald-100">
                        <div className="text-sm text-emerald-600 font-medium mb-1 flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Packet Flow
                        </div>
                        <div className="text-2xl font-bold text-slate-800">
                            {latest.network.packets_sent.toLocaleString()} <span className="text-sm font-normal text-slate-500">Tx</span>
                        </div>
                        <div className="text-sm text-slate-500">
                            {latest.network.packets_recv.toLocaleString()} Rx
                        </div>
                     </div>

                     <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
                        <div className="text-sm text-red-600 font-medium mb-1 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> Errors & Drops
                        </div>
                        <div className="text-2xl font-bold text-slate-800">
                            {(latest.network.errors_in + latest.network.errors_out)} <span className="text-sm font-normal text-slate-500">Errors</span>
                        </div>
                        <div className="text-sm text-slate-500">
                            {(latest.network.drop_in + latest.network.drop_out)} Drops
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
                      {/* Bandwidth Graph */}
                      <div className="bg-background/50 rounded-lg p-4 border">
                          <h4 className="mb-4 text-sm font-semibold">Throughput (MB)</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" hide />
                              <YAxis />
                              <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', fontSize: '12px' }} />
                              <Legend />
                              <Area type="monotone" dataKey="bytesSent" stackId="1" stroke="#8884d8" fill="#8884d8" name="Tx (MB)" />
                              <Area type="monotone" dataKey="bytesRecv" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Rx (MB)" />
                            </AreaChart>
                          </ResponsiveContainer>
                      </div>

                      {/* Packets Graph */}
                      <div className="bg-background/50 rounded-lg p-4 border">
                          <h4 className="mb-4 text-sm font-semibold">Packet Rate</h4>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis dataKey="name" hide />
                              <YAxis />
                              <Tooltip contentStyle={{ backgroundColor: 'white', borderRadius: '8px', fontSize: '12px' }} />
                              <Legend />
                              <Line type="monotone" dataKey="packetsSent" stroke="#f59e0b" dot={false} name="Tx Pkts" />
                              <Line type="monotone" dataKey="packetsRecv" stroke="#10b981" dot={false} name="Rx Pkts" />
                            </LineChart>
                          </ResponsiveContainer>
                      </div>
                  </div>
              </div>

              {/* Expandable raw JSON section */}
              <div className="mt-4 pt-4 border-t">
                <button
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                  onClick={() =>
                    setExpanded((prev) => ({ ...prev, [agentId]: !prev[agentId] }))
                  }
                >
                  {expanded[agentId] ? "▼ Hide Raw Data" : "▶ Show Raw Data"}
                </button>
                {expanded[agentId] && (
                  <pre className="bg-slate-950 text-slate-50 rounded-md p-4 mt-2 text-[10px] font-mono overflow-x-auto max-h-60 shadow-inner">
                    {JSON.stringify(latest, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Server className="w-16 h-16 mb-4 opacity-20" />
            <p>Waiting for agent metrics...</p>
        </div>
      )}
    </div>
  );
}
