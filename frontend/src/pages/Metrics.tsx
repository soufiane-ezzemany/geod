import { StatsCard } from "@/components/stats/StatsCard";
import type { Metrics as RawMetric } from "@/hooks/useMetrics";
import { useMetrics } from "@/hooks/useMetrics";
import { Activity, HardDrive, Server } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Use RawMetric imported from the metrics hook for consistent typing

export default function Metrics() {
  const { metrics } = useMetrics();

  // Group metrics by agent_id
  const metricsByAgent: Record<string, RawMetric[]> = metrics.reduce<Record<string, RawMetric[]>>(
    (acc, metric) => {
      const agentId = metric.agent_id || "unknown";
      if (!acc[agentId]) {
        acc[agentId] = [];
      }
      acc[agentId].push(metric);
      return acc;
    },
    {} as Record<string, RawMetric[]>
  );

  // For expanding/collapsing raw JSON
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6 p-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métriques</h1>
        <p className="text-muted-foreground">
          Surveillance réseau temps réel par agent, avec graphiques et détails enrichis
        </p>
      </div>
      {Object.keys(metricsByAgent).length > 0 ? (
        Object.entries(metricsByAgent).map(([agentId, agentMetrics]) => {
          // Sort metrics by time if available (timestamp is string from backend)
          const sortedMetrics = [...agentMetrics];
          // If metrics have a timestamp, sort by it descending (convert to number)
          if (sortedMetrics[0] && sortedMetrics[0].timestamp) {
            sortedMetrics.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
          }
          const latest = sortedMetrics[0];
          // Prepare data for charts (reverse for time order)
          const chartData = [...sortedMetrics].reverse().map((m, idx) => ({
            name: idx + 1,
            cpu: m.system.cpu_percent,
            mem: m.system.memory.percent,
            memUsed: m.system.memory.used / 1024 / 1024,
            bytesSent: m.network.bytes_sent / 1024 / 1024,
            bytesRecv: m.network.bytes_recv / 1024 / 1024,
          }));
          return (
            <div key={agentId} className="space-y-6 border rounded-lg p-4 bg-background shadow">
              <h2 className="text-xl font-semibold mb-2">Agent: {agentId}</h2>
              {latest ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <StatsCard
                      title="CPU (%)"
                      value={latest.system.cpu_percent}
                      description={"Utilisation CPU"}
                      icon={Activity}
                    />
                    <StatsCard
                      title="Mémoire (%)"
                      value={latest.system.memory.percent}
                      description={`Utilisé: ${(latest.system.memory.used / 1024 / 1024).toFixed(
                        1
                      )} MB`}
                      icon={Server}
                    />
                    <StatsCard
                      title="Réseau (envoyé)"
                      value={
                        chartData.length > 0
                          ? chartData[chartData.length - 1].bytesSent.toFixed(2) + " MB"
                          : "-"
                      }
                      description={`Reçu: ${
                        chartData.length > 0
                          ? chartData[chartData.length - 1].bytesRecv.toFixed(2)
                          : "-"
                      } MB`}
                      icon={HardDrive}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                    {/* CPU Usage Graph */}
                    <div className="bg-card rounded p-3 shadow">
                      <h3 className="font-medium mb-2">CPU (%)</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="cpu" stroke="#8884d8" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Memory Usage Graph */}
                    <div className="bg-card rounded p-3 shadow">
                      <h3 className="font-medium mb-2">Mémoire (%)</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide />
                          <YAxis domain={[0, 100]} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="mem" stroke="#82ca9d" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="text-xs text-muted-foreground mt-1">
                        Utilisé:{" "}
                        {chartData.length > 0
                          ? chartData[chartData.length - 1].memUsed.toFixed(1)
                          : "-"}{" "}
                        MB
                      </div>
                    </div>
                    {/* Network Usage Graph */}
                    <div className="bg-card rounded p-3 shadow">
                      <h3 className="font-medium mb-2">Réseau (MB)</h3>
                      <ResponsiveContainer width="100%" height={180}>
                        <LineChart
                          data={chartData}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" hide />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="bytesSent"
                            stroke="#ffc658"
                            dot={false}
                            name="Envoyé"
                          />
                          <Line
                            type="monotone"
                            dataKey="bytesRecv"
                            stroke="#8884d8"
                            dot={false}
                            name="Reçu"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  {/* Expandable raw JSON section */}
                  <div className="mt-4">
                    <button
                      className="text-xs underline text-primary"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [agentId]: !prev[agentId] }))
                      }
                    >
                      {expanded[agentId]
                        ? "Masquer les détails bruts"
                        : "Afficher les détails bruts"}
                    </button>
                    {expanded[agentId] && (
                      <pre className="bg-muted rounded p-2 mt-2 text-xs overflow-x-auto">
                        {JSON.stringify(latest, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">Aucune donnée reçue pour cet agent.</div>
              )}
            </div>
          );
        })
      ) : (
        <div className="text-muted-foreground">Aucune donnée reçue.</div>
      )}
    </div>
  );
}
