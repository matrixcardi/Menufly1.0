/**
 * Production-safe logger utility
 * Only logs to console in development mode to prevent information leakage
 */
export const logger = {
  error: (message: string, error?: unknown) => {
    if (import.meta.env.DEV) {
      console.error(message, error);
    }
    // In production, errors are silently handled
    // Consider adding a server-side logging service like Sentry here
  },
  warn: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.warn(message, data);
    }
  },
  info: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.info(message, data);
    }
  },
  log: (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
      console.log(message, data);
    }
  },
};
