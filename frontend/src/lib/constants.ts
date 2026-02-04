/**
 * Centralized constants for the application
 */

// Metrics configuration
export const METRICS = {
  MAX_PER_AGENT: 100, // Maximum metrics to keep per agent
  REFRESH_INTERVAL: 5000, // Refresh interval in ms
} as const;

// Time range configurations for history queries
export const TIME_RANGES = {
  "15m": { seconds: 15 * 60, step: "15s" },
  "1h": { seconds: 60 * 60, step: "15s" },
  "6h": { seconds: 6 * 60 * 60, step: "1m" },
  "24h": { seconds: 24 * 60 * 60, step: "5m" },
  "7d": { seconds: 7 * 24 * 60 * 60, step: "30m" },
} as const;

// Topology link color thresholds
export const LINK_THRESHOLDS = {
  LATENCY: {
    GOOD: 20, // ms - green
    WARNING: 100, // ms - yellow, above is red
  },
  PACKET_LOSS: {
    WARNING: 1, // % - orange
    CRITICAL: 50, // % - red
  },
} as const;

// Link colors
export const LINK_COLORS = {
  GREEN: "#22c55e",
  YELLOW: "#eab308",
  ORANGE: "#f97316",
  RED: "#ef4444",
  GRAY: "#64748b",
  LIGHT_GRAY: "#cbd5e1",
} as const;

// Topology layout
export const TOPOLOGY = {
  NODE_SPACING_X: 250,
  NODE_SPACING_Y: 100,
  NODE_START_X: 100,
  NODE_START_Y: 100,
} as const;

// UI constants
export const UI = {
  DEFAULT_IPERF_PORT: 5201,
  DEFAULT_IPERF_DURATION: 10,
  DEFAULT_PING_COUNT: 4,
} as const;
