import { useState, useEffect } from "react";
import { apiService } from "@/services/api.service";
import type { Metrics } from "@/hooks/useMetrics";

interface TimeRangeConfig {
  start: number;
  end: number;
  step: string;
}

/**
 * Calculate time range parameters based on range selection
 */
function getTimeRangeConfig(timeRange: string): TimeRangeConfig {
  const end = Math.floor(Date.now() / 1000);
  let start = end;
  let step = "15s";

  switch (timeRange) {
    case "15m":
      start = end - 15 * 60;
      break;
    case "1h":
      start = end - 60 * 60;
      break;
    case "6h":
      start = end - 6 * 60 * 60;
      step = "1m";
      break;
    case "24h":
      start = end - 24 * 60 * 60;
      step = "5m";
      break;
    case "7d":
      start = end - 7 * 24 * 60 * 60;
      step = "30m";
      break;
  }

  return { start, end, step };
}

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
        const { start, end, step } = getTimeRangeConfig(timeRange);
        const agents = await apiService.getAgents();

        const newHistory: Record<string, Metrics[]> = {};

        for (const agent of agents) {
          const hostname = agent.hostname;
          try {
            const data = await apiService.getHistory(hostname, start, end, step);
            // Cast to Metrics[] - history data has compatible structure
            const enrichedData = data.map((m) => ({
              ...m,
              agent_id: hostname,
            })) as Metrics[];
            newHistory[hostname] = enrichedData;
          } catch (err) {
            console.error(`Failed to fetch history for ${hostname}`, err);
          }
        }

        setHistoryData(newHistory);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to fetch history"));
        console.error("Failed to fetch history", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [timeRange]);

  return { historyData, loading, error };
}
