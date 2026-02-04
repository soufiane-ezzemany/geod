import { createContext, useContext, useEffect, useState } from "react";
import { useSocket } from "@/context/socket-context";
import type { AgentStats } from "@/types/network";
import { METRICS } from "@/lib/constants";

export interface Metrics extends AgentStats {
  agent_id: string;
  timestamp: string;
}

interface MetricsContextType {
  metrics: Record<string, Metrics[]>;
}

const MetricsContext = createContext<MetricsContextType>({ metrics: {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useMetrics() {
  return useContext(MetricsContext);
}

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<Record<string, Metrics[]>>({});
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNetworkStats = (data: {
      hostname: string;
      stats: AgentStats;
      timestamp: string;
    }) => {
      setMetrics((prev) => {
        const agentId = data.hostname;
        const newMetric = {
          agent_id: agentId,
          network: data.stats.network,
          system: data.stats.system,
          timestamp: data.timestamp,
        };

        const currentAgentMetrics = prev[agentId] || [];
        return {
          ...prev,
          [agentId]: [...currentAgentMetrics, newMetric].slice(
            -METRICS.MAX_PER_AGENT,
          ),
        };
      });
    };

    socket.on("network_stats_update", handleNetworkStats);

    return () => {
      socket.off("network_stats_update", handleNetworkStats);
    };
  }, [socket]);

  return (
    <MetricsContext.Provider value={{ metrics }}>
      {children}
    </MetricsContext.Provider>
  );
}
