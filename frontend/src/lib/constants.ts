/**
 * Application constants
 * Centralized location for all magic numbers and configuration values
 */

// Metrics configuration
export const METRICS = {
  /** Maximum number of metrics to keep per agent */
  MAX_PER_AGENT: 100,
  /** Interval for metrics polling in milliseconds */
  POLL_INTERVAL_MS: 5000,
} as const;

// Topology configuration
export const TOPOLOGY = {
  /** Default node spacing in pixels */
  NODE_SPACING_X: 250,
  NODE_SPACING_Y: 100,
  /** Initial node position offset */
  INITIAL_OFFSET_X: 100,
  INITIAL_OFFSET_Y: 100,
} as const;

// Link color thresholds
export const LINK_THRESHOLDS = {
  /** Latency threshold for green status (ms) */
  LATENCY_GOOD: 20,
  /** Latency threshold for yellow status (ms) */
  LATENCY_WARNING: 100,
  /** Packet loss threshold for orange status (%) */
  PACKET_LOSS_WARNING: 0,
  /** Packet loss threshold for red status (%) */
  PACKET_LOSS_CRITICAL: 50,
} as const;

// UI configuration
export const UI = {
  /** Default page size for lists */
  DEFAULT_PAGE_SIZE: 20,
  /** Toast notification duration in milliseconds */
  TOAST_DURATION_MS: 3000,
  /** Debounce delay for search inputs in milliseconds */
  SEARCH_DEBOUNCE_MS: 300,
} as const;
