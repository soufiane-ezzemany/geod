import { StatsCard } from "@/components/stats/StatsCard"
import { Network, Activity, Layers, AlertCircle } from "lucide-react"

export default function Dashboard() {
    return (
        <div className="space-y-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
                <p className="text-muted-foreground mt-1">
                    Vue d'ensemble de votre infrastructure réseau
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Topologies actives"
                    value={3}
                    description="+1 ce mois-ci"
                    icon={Layers}
                />
                <StatsCard
                    title="Nœuds réseau"
                    value="73/80"
                    description="91.25% disponibles"
                    icon={Network}
                />
                <StatsCard
                    title="Latence moyenne"
                    value="12.5ms"
                    description="-2.3ms vs hier"
                    icon={Activity}
                />
                <StatsCard
                    title="Alertes actives"
                    value={2}
                    description="Nécessitent attention"
                    icon={AlertCircle}
                />
            </div>
        </div>
    )
}