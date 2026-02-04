import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { BACKEND_URL } from "@/config";
import type { AgentStats } from "@/types/network";

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
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on("network_stats_update", (data) => {
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
              [agentId]: [...currentAgentMetrics, newMetric].slice(-100) // Keep last 100 per agent
          };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <MetricsContext.Provider value={{ metrics }}>{children}</MetricsContext.Provider>;
}
