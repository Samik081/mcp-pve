/**
 * Tool registration barrel file.
 *
 * Imports all domain tool modules and exports a single
 * registerAllTools() function that wires them into the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerNodeTools } from "./nodes.js";
import { registerQemuTools } from "./qemu.js";
import { registerLxcTools } from "./lxc.js";
import { registerStorageTools } from "./storage.js";
import { registerClusterTools } from "./cluster.js";
import { registerAccessTools } from "./access.js";
import { registerPoolTools } from "./pools.js";
import { registerNetworkTools } from "./network.js";
import { registerFirewallTools } from "./firewall.js";
import { registerBackupTools } from "./backup.js";
import { registerTaskTools } from "./tasks.js";
import { registerHaTools } from "./ha.js";

export function registerAllTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  registerNodeTools(server, client, config);
  registerQemuTools(server, client, config);
  registerLxcTools(server, client, config);
  registerStorageTools(server, client, config);
  registerClusterTools(server, client, config);
  registerAccessTools(server, client, config);
  registerPoolTools(server, client, config);
  registerNetworkTools(server, client, config);
  registerFirewallTools(server, client, config);
  registerBackupTools(server, client, config);
  registerTaskTools(server, client, config);
  registerHaTools(server, client, config);
}
