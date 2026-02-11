/**
 * Stderr-only logging utility.
 *
 * ALL output uses console.error() to write to stderr exclusively.
 * This prevents contamination of stdout, which is reserved for
 * MCP JSON-RPC messages over the stdio transport.
 *
 * NEVER use console.log() anywhere in this project.
 */

const PREFIX = "[mcp-pve]";

export const logger = {
  info: (...args: unknown[]): void => {
    console.error(PREFIX, "INFO", ...args);
  },
  warn: (...args: unknown[]): void => {
    console.error(PREFIX, "WARN", ...args);
  },
  error: (...args: unknown[]): void => {
    console.error(PREFIX, "ERROR", ...args);
  },
  debug: (...args: unknown[]): void => {
    if (process.env.DEBUG) {
      console.error(PREFIX, "DEBUG", ...args);
    }
  },
};
