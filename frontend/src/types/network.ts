export interface NetworkInterfaceAddress {
  family: string;
  address: string;
  netmask: string;
}

export interface NetworkInterfaceStats {
  is_up: boolean;
  speed: number;
  mtu: number;
  addresses: NetworkInterfaceAddress[];
}

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
  interfaces: Record<string, NetworkInterfaceStats>;
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

export interface AgentStats {
  network: NetworkStats;
  system: SystemStats;
}

export interface TopologyNode {
  id: string;
  ip?: string;
  type?: string;
  // React Flow specific properties usually added by the library, 
  // but from backend we receive these basic fields.
  [key: string]: unknown; 
}

export interface TopologyLink {
  source: string;
  target: string;
  latency?: number;
  last_updated?: string;
  monitoring?: boolean;
  [key: string]: unknown;
}

export interface TopologyData {
  directed: boolean;
  multigraph: boolean;
  graph: Record<string, unknown>;
  nodes: TopologyNode[];
  links: TopologyLink[];
}

export interface CommandResult {
  request_id?: string;
  command: string;
  status: 'success' | 'error';
  data?: unknown;
  error?: string | null;
  timestamp: string;
}

export interface CommandResultUpdate {
  hostname: string;
  result: CommandResult;
}

export interface NetworkStatsUpdate {
  hostname: string;
  stats: AgentStats;
  timestamp: string;
}

export interface LinkStatsUpdate {
  source: string;
  target: string;
  latency: number;
}
