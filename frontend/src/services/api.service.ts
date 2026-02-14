import { BACKEND_URL } from "@/config";
import type { AgentInfo, TopologyData, ChaosRule, CommandParams } from "@/types/network";

/**
 * Generic API response structure
 */
export interface ApiResponse {
  status?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
}

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

  /**
   * Apply network latency
   */
  async applyLatency(
    target: string,
    latency: string,
    jitter?: string,
    targetType: "host" | "container" | "service" = "host",
    hostForContainer?: string
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}/api/actions/network/latency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        latency,
        jitter,
        target_type: targetType,
        host_for_container: hostForContainer,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to apply latency: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Apply network packet loss
   */
  async applyLoss(
    target: string,
    loss: string,
    targetType: "host" | "container" | "service" = "host",
    hostForContainer?: string
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}/api/actions/network/loss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        loss,
        target_type: targetType,
        host_for_container: hostForContainer,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to apply loss: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Clear all network rules
   */
  async clearChaos(
    target: string,
    targetType: "host" | "container" | "service" = "host",
    hostForContainer?: string
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}/api/actions/network/clear`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target,
        target_type: targetType,
        host_for_container: hostForContainer,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to clear chaos: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Apply generic chaos configuration
   */
  async applyChaosConfig(
    hostname: string,
    rules: ChaosRule[],
    interfaceName?: string,
    mode: "replace" | "append" = "replace"
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}/api/chaos/host/${encodeURIComponent(hostname)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules,
        interface: interfaceName,
        mode,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to apply chaos config: ${res.statusText}`);
    }
    return res.json();
  }

  /**
   * Execute a generic command on a target agent.
   */
  async executeCommand(
    targetHostname: string,
    command: string,
    params: CommandParams = {}
  ): Promise<ApiResponse> {
    const res = await fetch(`${this.baseUrl}/api/commands/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_hostname: targetHostname,
        command: command,
        params: params,
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `Failed to execute command: ${res.statusText}`);
    }
    return res.json();
  }
}

// Singleton instance
export const apiService = new ApiService();
