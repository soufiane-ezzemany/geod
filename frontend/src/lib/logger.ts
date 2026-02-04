/**
 * Logger utility
 * Provides consistent logging with environment awareness
 * Only logs in development mode by default
 */

interface LoggerOptions {
  /** Prefix for all log messages */
  prefix?: string;
  /** Force logging even in production */
  forceLog?: boolean;
}

const isDev = import.meta.env.DEV;

/**
 * Create a logger instance with optional prefix
 */
export function createLogger(options: LoggerOptions = {}) {
  const { prefix = "", forceLog = false } = options;

  const shouldLog = isDev || forceLog;
  const formatMessage = (message: string) =>
    prefix ? `[${prefix}] ${message}` : message;

  return {
    debug: (message: string, ...args: unknown[]) => {
      if (shouldLog) {
        console.debug(formatMessage(message), ...args);
      }
    },
    info: (message: string, ...args: unknown[]) => {
      if (shouldLog) {
        console.info(formatMessage(message), ...args);
      }
    },
    warn: (message: string, ...args: unknown[]) => {
      if (shouldLog) {
        console.warn(formatMessage(message), ...args);
      }
    },
    error: (message: string, ...args: unknown[]) => {
      // Always log errors
      console.error(formatMessage(message), ...args);
    },
  };
}

// Pre-configured loggers for common use cases
export const logger = createLogger();
export const socketLogger = createLogger({ prefix: "Socket" });
export const apiLogger = createLogger({ prefix: "API" });
