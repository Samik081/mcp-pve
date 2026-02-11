/**
 * Cluster tools: status, resources, options, and cluster-wide information.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerClusterTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_get_cluster_status",
    description: "Get the current cluster status including node membership and quorum",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/status");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_resources",
    description:
      "List all cluster resources (VMs, containers, storage, nodes) with optional type filter",
    category: "cluster",
    accessTier: "read-only",
    inputSchema: {
      type: z
        .enum(["vm", "storage", "node", "sdn"])
        .optional()
        .describe("Filter by resource type"),
    },
    handler: async (args) => {
      let path = "/cluster/resources";
      if (args.type) path += `?type=${args.type}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_next_vmid",
    description: "Get the next available VMID in the cluster",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/nextid");
      return `Next available VMID: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_get_cluster_log",
    description: "Get recent cluster log entries",
    category: "cluster",
    accessTier: "read-only",
    inputSchema: {
      max: z
        .number()
        .optional()
        .describe("Maximum number of log entries to return"),
    },
    handler: async (args) => {
      let path = "/cluster/log";
      if (args.max !== undefined) path += `?max=${args.max}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_cluster_options",
    description: "Get cluster-wide datacenter options",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/options");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_backup_info",
    description: "List guests that are not covered by any backup job",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/backup-info/not-backed-up");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_cluster_ha_status",
    description: "Get the current HA manager status",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/ha/status/current");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_replication",
    description: "List all replication jobs in the cluster",
    category: "cluster",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/replication");
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_update_cluster_options",
    description: "Update cluster-wide datacenter options",
    category: "cluster",
    accessTier: "full",
    inputSchema: {
      keyboard: z
        .string()
        .optional()
        .describe("Default keyboard layout for VNC"),
      language: z
        .string()
        .optional()
        .describe("Default GUI language"),
      console: z
        .enum(["applet", "vv", "html5", "xtermjs"])
        .optional()
        .describe("Default console viewer"),
      http_proxy: z
        .string()
        .optional()
        .describe("HTTP proxy configuration"),
      migration_unsecure: z
        .boolean()
        .optional()
        .describe("Allow insecure migration"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.keyboard !== undefined) body.keyboard = args.keyboard;
      if (args.language !== undefined) body.language = args.language;
      if (args.console !== undefined) body.console = args.console;
      if (args.http_proxy !== undefined) body.http_proxy = args.http_proxy;
      if (args.migration_unsecure !== undefined)
        body["migration_unsecure"] = args.migration_unsecure ? 1 : 0;
      await client.put("/cluster/options", body);
      return "Cluster options updated successfully.";
    },
  });
}
