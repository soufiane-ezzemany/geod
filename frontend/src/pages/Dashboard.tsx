import { StatsCard } from "@/components/stats/StatsCard";
import TopologyGraph from "@/components/topology/TopologyGraph";
import { useSocket } from "@/context/socket-context";
import { apiService } from "@/services/api.service";
import type { TopologyData, TopologyLink, TopologyNode } from "@/types/network";
import { Activity, AlertCircle, Layers, Network } from "lucide-react";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { socket } = useSocket();
  const [stats, setStats] = useState({
    nodeCount: 0,
    linkCount: 0,
    avgLatency: 0,
    alertCount: 0,
  });

  useEffect(() => {
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

      const avgLatency =
        latencyCount > 0 ? (totalLatency / latencyCount).toFixed(1) : 0;

      setStats({
        nodeCount,
        linkCount,
        avgLatency: Number(avgLatency),
        alertCount: alerts,
      });
    };

    // Initial fetch using API service
    apiService
      .getTopology()
      .then((data) => {
        if (data.nodes && data.links) {
          calculateStats(data.nodes, data.links);
        }
      })
      .catch((err) => console.error("Failed to fetch topology:", err));

    if (!socket) return;

    // Listen for updates
    const handleTopologyUpdate = (data: TopologyData) => {
      if (data.nodes && data.links) {
        calculateStats(data.nodes, data.links);
      }
    };

    socket.on("topology_update", handleTopologyUpdate);

    return () => {
      socket.off("topology_update", handleTopologyUpdate);
    };
  }, [socket]);

  return (
    <div className="space-y-6 p-6 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your network infrastructure
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Links"
          value={stats.linkCount}
          description="Monitored connections"
          icon={Layers}
        />
        <StatsCard
          title="Network Nodes"
          value={stats.nodeCount}
          description="Connected agents"
          icon={Network}
        />
        <StatsCard
          title="Avg Latency"
          value={`${stats.avgLatency}ms`}
          description="Across all links"
          icon={Activity}
        />
        <StatsCard
          title="Latency Alerts"
          value={stats.alertCount}
          description="Links > 100ms"
          icon={AlertCircle}
        />
      </div>

      <div className="flex-1 border rounded-xl shadow-sm bg-white overflow-hidden">
        <TopologyGraph />
      </div>
    </div>
  );
}
