/**
 * Logger utility for development-only logging
 * In production, logs are silenced
 */

const isDev = import.meta.env.DEV;

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function createLogger(prefix: string): Logger {
  const formatMessage = (message: string) => `[${prefix}] ${message}`;

  return {
    debug: (message: unknown, ...args: unknown[]) => {
      if (isDev && typeof message === "string") {
        console.debug(formatMessage(message), ...args);
      }
    },
    info: (message: unknown, ...args: unknown[]) => {
      if (isDev && typeof message === "string") {
        console.info(formatMessage(message), ...args);
      }
    },
    warn: (message: unknown, ...args: unknown[]) => {
      if (typeof message === "string") {
        console.warn(formatMessage(message), ...args);
      }
    },
    error: (message: unknown, ...args: unknown[]) => {
      if (typeof message === "string") {
        console.error(formatMessage(message), ...args);
      }
    },
  };
}

// Pre-configured loggers
export const logger = createLogger("App");
export const socketLogger = createLogger("Socket");
export const apiLogger = createLogger("API");
export const topologyLogger = createLogger("Topology");
