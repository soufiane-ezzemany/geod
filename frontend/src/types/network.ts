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
  status?: string;
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

// --- Command Parameters ---
export interface PingParams { target: string; count?: number; }
export interface TracerouteParams { target: string; }
export interface BandwidthParams { interface?: string; limit?: string | null; latency?: string | null; loss?: string | null; }
export interface IperfServerParams { port?: number; }
export interface IperfClientParams { target: string; duration?: number; port?: number; }
export interface ToggleMonitoringParams { enabled: boolean; }

export type CommandParams = 
  | PingParams 
  | TracerouteParams 
  | BandwidthParams 
  | IperfServerParams 
  | IperfClientParams 
  | ToggleMonitoringParams
  | Record<string, unknown>;

// --- Command Results ---
export interface PingResult { output: string; target: string; count: number; }
export interface TracerouteResult { output: string; target: string; }
export interface BandwidthResult { status: string; interface: string; limit?: string; output?: string; }
export interface IperfServerResult { status: string; port: number; }
export interface IperfClientSummary { bandwidth_mbps: number; bytes_sent: number; }
export interface IperfClientResult { output: unknown; summary: IperfClientSummary; }
export interface ConnectionInfo {
    fd: number; family: string; type: string;
    local_address: string | null; remote_address: string | null;
    status: string; pid: number;
}
export interface ListConnectionsResult { connections: ConnectionInfo[]; count: number; }

export type CommandResultData = 
    | PingResult 
    | TracerouteResult 
    | BandwidthResult 
    | IperfServerResult 
    | IperfClientResult 
    | ListConnectionsResult 
    | NetworkStats 
    | SystemStats 
    | string // For simple text output or errors
    | Record<string, unknown>; // Fallback

export interface CommandResult {
  request_id?: string;
  command: string;
  status: 'success' | 'error';
  data?: CommandResultData;
  error?: string | null;
  timestamp: string;
}
