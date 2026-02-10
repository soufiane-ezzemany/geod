import { StatsCard } from "@/components/stats/StatsCard";
import TopologyGraph from "@/components/topology/TopologyGraph";
import { Activity, AlertCircle, Layers, Network } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { TopologyData, TopologyLink, TopologyNode } from "@/types/network";
import { BACKEND_URL, API_ENDPOINTS } from "@/config";

export default function Dashboard() {
  const [stats, setStats] = useState({
    nodeCount: 0,
    linkCount: 0,
    avgLatency: 0,
    alertCount: 0,
  });

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

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

    // Initial fetch
    fetch(API_ENDPOINTS.topology)
      .then((res) => res.json())
      .then((data: TopologyData) => {
        if (data.nodes && data.links) {
          calculateStats(data.nodes, data.links);
        }
      });

    // Listen for updates
    socket.on("topology_update", (data: TopologyData) => {
      if (data.nodes && data.links) {
        calculateStats(data.nodes, data.links);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div className="space-y-3 p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your network infrastructure
          </p>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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

      <div className="flex-1 min-h-0 border rounded-xl shadow-sm bg-white overflow-hidden">
        <TopologyGraph />
      </div>
    </div>
  );
}
