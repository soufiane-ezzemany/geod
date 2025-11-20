import { StatsCard } from "@/components/stats/StatsCard";
import { useMetrics } from "@/hooks/useMetrics";
import { Activity, HardDrive, Server } from "lucide-react";

interface Metric {
  agent_id: string;
  system: {
    cpu_percent: number;
    memory: {
      percent: number;
      used: number;
    };
  };
  network: {
    bytes_sent: number;
    bytes_recv: number;
  };
}

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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métriques</h1>
        <p className="text-muted-foreground">Surveillance réseau temps réel par agent</p>
      </div>
      {Object.keys(metricsByAgent).length > 0 ? (
        Object.entries(metricsByAgent).map(([agentId, agentMetrics]) => {
          const latest = agentMetrics[0];
          return (
            <div key={agentId} className="space-y-4">
              <h2 className="text-xl font-semibold">Agent: {agentId}</h2>
              {latest ? (
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
                    value={(latest.network.bytes_sent / 1024 / 1024).toFixed(2) + " MB"}
                    description={`Reçu: ${(latest.network.bytes_recv / 1024 / 1024).toFixed(2)} MB`}
                    icon={HardDrive}
                  />
                </div>
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
