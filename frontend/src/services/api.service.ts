import { BACKEND_URL } from "@/config";
import type { AgentInfo, TopologyData } from "@/types/network";

/**
 * History data point
 */
export interface HistoryMetric {
  network: {
    bytes_sent: number;
    bytes_recv: number;
    packets_sent: number;
    packets_recv: number;
    throughput_sent_mbps?: number;
    throughput_recv_mbps?: number;
    pps_sent?: number;
    pps_recv?: number;
  };
  system: {
    cpu_percent: number;
    memory: { percent: number; used: number };
    disk: { percent: number; used: number; total: number };
  };
  timestamp: string;
}

/**
 * Centralized API service for all backend calls
 */
class ApiService {
  private readonly baseUrl = BACKEND_URL;

  /**
   * Fetch current network topology
   */
  async getTopology(): Promise<TopologyData> {
    const res = await fetch(`${this.baseUrl}/api/topology`);
    if (!res.ok) {
      throw new Error(`Failed to fetch topology: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Fetch list of connected agents
   */
  async getAgents(): Promise<AgentInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/agents`);
    if (!res.ok) {
      throw new Error(`Failed to fetch agents: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Fetch historical metrics for an agent
   */
  async getHistory(
    hostname: string,
    start: number,
    end: number,
    step: string
  ): Promise<HistoryMetric[]> {
    const url = `${this.baseUrl}/api/history?hostname=${encodeURIComponent(hostname)}&start=${start}&end=${end}&step=${step}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch history: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}

// Singleton instance
export const apiService = new ApiService();
