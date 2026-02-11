/**
 * Node tools: status, info, services, and management for PVE cluster nodes.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerNodeTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_nodes",
    description: "List all nodes in the Proxmox VE cluster",
    category: "nodes",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/nodes");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_status",
    description:
      "Get detailed status of a specific node including CPU, memory, uptime, and load",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/status`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_version",
    description: "Get the PVE version information for a specific node",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/version`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_dns",
    description: "Get DNS settings for a specific node",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/dns`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_time",
    description: "Get time and timezone information for a specific node",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/time`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_syslog",
    description: "Get system log entries from a specific node",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      start: z
        .number()
        .optional()
        .describe("Start line number (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max number of log entries to return (default: 50)"),
    },
    handler: async (args) => {
      let path = `/nodes/${args.node}/syslog`;
      const params = new URLSearchParams();
      if (args.start !== undefined) params.set("start", String(args.start));
      if (args.limit !== undefined) params.set("limit", String(args.limit));
      const qs = params.toString();
      if (qs) path += `?${qs}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_services",
    description:
      "List all system services and their status on a specific node",
    category: "nodes",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/services`);
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Read-execute tools ---

  registerTool(server, config, {
    name: "pve_manage_node_service",
    description:
      "Start, stop, restart, or reload a system service on a specific node",
    category: "nodes",
    accessTier: "read-execute",
    inputSchema: {
      node: z.string().describe("The node name"),
      service: z.string().describe("The service name (e.g. pveproxy, pvedaemon)"),
      command: z
        .enum(["start", "stop", "restart", "reload"])
        .describe("The action to perform on the service"),
    },
    handler: async (args) => {
      const data = await client.post(
        `/nodes/${args.node}/services/${args.service}/${args.command}`,
      );
      return `Service ${args.service} ${args.command} initiated on node ${args.node}. Task: ${data}`;
    },
  });
}
