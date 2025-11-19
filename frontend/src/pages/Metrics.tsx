import { StatsCard } from "@/components/stats/StatsCard";
import { useMetrics } from "@/hooks/useMetrics";
import { Activity, HardDrive, Server } from "lucide-react";

export default function Metrics() {
  const { metrics } = useMetrics();
  const latest = metrics[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Métriques</h1>
        <p className="text-muted-foreground">Surveillance réseau temps réel</p>
      </div>
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
            description={`Utilisé: ${(latest.system.memory.used / 1024 / 1024).toFixed(1)} MB`}
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
        <div className="text-muted-foreground">Aucune donnée reçue.</div>
      )}
    </div>
  );
}
