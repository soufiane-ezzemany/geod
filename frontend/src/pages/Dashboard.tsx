import { StatsCard } from "@/components/stats/StatsCard";
import TopologyGraph from "@/components/topology/TopologyGraph";
import { Activity, AlertCircle, Layers, Network } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import type { TopologyData, TopologyLink, LinkStatsUpdate } from "@/types/network";
import { API_ENDPOINTS } from "@/config";
import { useSocket } from "@/context/socket-context";

export default function Dashboard() {
  const { socket } = useSocket();
  const [topology, setTopology] = useState<{
    nodes: unknown[];
    links: TopologyLink[];
  }>({ nodes: [], links: [] });

  // Calculate stats whenever topology changes
  const stats = useMemo(() => {
    const nodeCount = topology.nodes.length;
    const linkCount = topology.links.length;

    let totalLatency = 0;
    let latencyCount = 0;
    let alerts = 0;

    topology.links.forEach((l) => {
      if (l.latency !== undefined) {
        totalLatency += l.latency;
        latencyCount++;
        if (l.latency > 100) alerts++; // Alert threshold > 100ms
      }
    });

    const avgLatency =
      latencyCount > 0 ? (totalLatency / latencyCount).toFixed(1) : 0;

    return {
      nodeCount,
      linkCount,
      avgLatency: Number(avgLatency),
      alertCount: alerts,
    };
  }, [topology]);

  useEffect(() => {
    // Initial fetch
    fetch(API_ENDPOINTS.topology)
      .then((res) => res.json())
      .then((data: TopologyData) => {
        if (data.nodes && data.links) {
          setTopology({ nodes: data.nodes, links: data.links });
        }
      });

    if (!socket) return;

    // Handle full topology update
    const handleTopologyUpdate = (data: TopologyData) => {
      if (data.nodes && data.links) {
        setTopology({ nodes: data.nodes, links: data.links });
      }
    };

    // Handle single link stat update
    const handleLinkStatsUpdate = (data: LinkStatsUpdate) => {
      setTopology((prev) => {
        const newLinks = prev.links.map((link) => {
          if (link.source === data.source && link.target === data.target) {
            return { ...link, latency: data.latency, packet_loss: data.packet_loss };
          }
          return link;
        });
        return { ...prev, links: newLinks };
      });
    };

    socket.on("topology_update", handleTopologyUpdate);
    socket.on("link_stats_update", handleLinkStatsUpdate);

    return () => {
      socket.off("topology_update", handleTopologyUpdate);
      socket.off("link_stats_update", handleLinkStatsUpdate);
    };
  }, [socket]);

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
