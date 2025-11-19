import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// Types for metrics (simplified for now)
export interface NetworkStats {
  bytes_sent: number;
  bytes_recv: number;
  packets_sent: number;
  packets_recv: number;
  errors_in: number;
  errors_out: number;
  drop_in: number;
  drop_out: number;
  active_connections: number;
  timestamp: string;
}
export interface SystemStats {
  cpu_percent: number;
  memory: {
    total: number;
    available: number;
    percent: number;
    used: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percent: number;
  };
  timestamp: string;
}
export interface Metrics {
  agent_id: string;
  network: NetworkStats;
  system: SystemStats;
  timestamp: string;
}

interface MetricsContextType {
  metrics: Metrics[];
}

const MetricsContext = createContext<MetricsContextType>({ metrics: [] });

export function useMetrics() {
  return useContext(MetricsContext);
}

export function MetricsProvider({ children }: { children: React.ReactNode }) {
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // TODO: Make backend URL configurable
    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.on("network_stats_update", (data) => {
      setMetrics((prev) => [
        {
          agent_id: data.agent_id,
          network: data.stats.network,
          system: data.stats.system,
          timestamp: data.timestamp,
        },
        ...prev.slice(0, 19), // keep last 20
      ]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <MetricsContext.Provider value={{ metrics }}>{children}</MetricsContext.Provider>;
}
