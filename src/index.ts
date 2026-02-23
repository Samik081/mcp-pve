#!/usr/bin/env node

/**
 * Proxmox VE MCP Server entry point.
 *
 * Startup sequence:
 * 1. Load and validate configuration
 * 2. Disable TLS verification if configured (for self-signed certs)
 * 3. Create client and validate PVE connectivity
 * 4. Create MCP server, register tools, start stdio transport
 */

import { loadConfig } from "./core/config.js";
import { createClient, validateConnection } from "./core/client.js";
import { createServer, startServer } from "./core/server.js";
import { registerAllTools } from "./tools/index.js";
import { logger } from "./core/logger.js";

// Process lifecycle handlers -- catch uncaught errors to stderr
// to prevent them from corrupting the stdout JSON-RPC stream.
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection:", reason);
  process.exit(1);
});

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Disable TLS verification for self-signed certificates
  if (!config.verifySsl) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    logger.warn(
      "TLS certificate verification disabled (PVE_VERIFY_SSL=false). " +
        "This is insecure and should only be used with self-signed certificates.",
    );
  }

  const client = createClient(config);
  await validateConnection(client);

  logger.info(`Access tier: ${config.accessTier}`);

  const server = createServer();
  registerAllTools(server, client, config);
  await startServer(server, config);
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
