import { StatsCard } from "@/components/stats/StatsCard"
import TopologyGraph from "@/components/topology/TopologyGraph"
import { Activity, AlertCircle, Layers, Network } from "lucide-react"
import { useEffect, useState } from "react"
import { io } from "socket.io-client"
import type { TopologyData, TopologyLink, TopologyNode } from "@/types/network"
import { BACKEND_URL, API_ENDPOINTS } from "@/config"

export default function Dashboard() {
    const [stats, setStats] = useState({
        nodeCount: 0,
        linkCount: 0,
        avgLatency: 0,
        alertCount: 0
    });

    useEffect(() => {
        const socket = io(BACKEND_URL);

        const calculateStats = (nodes: TopologyNode[], links: TopologyLink[]) => {
            const nodeCount = nodes.length;
            const linkCount = links.length;
            
            let totalLatency = 0;
            let latencyCount = 0;
            let alerts = 0;

            links.forEach((l) => {
                if (l.latency) {
                    totalLatency += l.latency;
                    latencyCount++;
                    if (l.latency > 100) alerts++; // Alert threshold > 100ms
                }
            });

            const avgLatency = latencyCount > 0 ? (totalLatency / latencyCount).toFixed(1) : 0;

            setStats({
                nodeCount,
                linkCount,
                avgLatency: Number(avgLatency),
                alertCount: alerts
            });
        };

        // Initial fetch
        fetch(API_ENDPOINTS.topology)
            .then(res => res.json())
            .then((data: TopologyData) => {
                if (data.nodes && data.links) {
                    calculateStats(data.nodes, data.links);
                }
            });

        // Listen for updates
        socket.on('topology_update', (data: TopologyData) => {
             if (data.nodes && data.links) {
                calculateStats(data.nodes, data.links);
            }
        });

        socket.on('link_stats_update', () => {
             // Re-fetch full topology for accurate calculation or maintain local state
             // For simplicity, we re-fetch the latest state or wait for next topology push
             fetch(API_ENDPOINTS.topology)
                .then(res => res.json())
                .then((data: TopologyData) => calculateStats(data.nodes || [], data.links || []));
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    return (
        <div className="space-y-6 p-6 h-full flex flex-col">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
                <p className="text-muted-foreground mt-1">
                    Vue d'ensemble de votre infrastructure réseau
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title="Liens Actifs"
                    value={stats.linkCount}
                    description="Connexions monitorées"
                    icon={Layers}
                />
                <StatsCard
                    title="Nœuds réseau"
                    value={stats.nodeCount}
                    description="Agents connectés"
                    icon={Network}
                />
                <StatsCard
                    title="Latence moyenne"
                    value={`${stats.avgLatency}ms`}
                    description="Sur l'ensemble des liens"
                    icon={Activity}
                />
                <StatsCard
                    title="Alertes latence"
                    value={stats.alertCount}
                    description="Liens > 100ms"
                    icon={AlertCircle}
                />
            </div>

            <div className="flex-1 border rounded-xl shadow-sm bg-white overflow-hidden">
                <TopologyGraph />
            </div>
        </div>
    )
}
