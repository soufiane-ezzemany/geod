import { useState, useEffect } from "react";
import { apiService, type HistoryMetric } from "@/services/api.service";
import { apiLogger } from "@/lib/logger";
import { TIME_RANGES } from "@/lib/constants";
import type { Metrics } from "@/hooks/useMetrics";

/**
 * Hook for fetching historical metrics data
 */
export function useMetricsHistory(timeRange: string) {
  const [historyData, setHistoryData] = useState<Record<string, Metrics[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (timeRange === "live") {
      setHistoryData({});
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      setError(null);

      try {
        const end = Math.floor(Date.now() / 1000);
        const config = TIME_RANGES[timeRange as keyof typeof TIME_RANGES];
        
        if (!config) {
          throw new Error(`Unknown time range: ${timeRange}`);
        }

        const start = end - config.seconds;
        const step = config.step;

        const agents = await apiService.getAgents();
        const newHistory: Record<string, Metrics[]> = {};

        for (const agent of agents) {
          const hostname = agent.hostname;
          try {
            const data = await apiService.getHistory(hostname, start, end, step);
            // Enrich with agent_id
            const enrichedData = data.map((m: HistoryMetric) => ({
              ...m,
              agent_id: hostname,
              timestamp: m.timestamp || new Date().toISOString(),
            })) as Metrics[];
            newHistory[hostname] = enrichedData;
          } catch (err) {
            apiLogger.error(`Failed to fetch history for ${hostname}`, err);
          }
        }

        setHistoryData(newHistory);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch history"));
        apiLogger.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [timeRange]);

  return { historyData, loading, error };
}
