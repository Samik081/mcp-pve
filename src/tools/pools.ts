/**
 * Pool tools: CRUD for resource pools.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerPoolTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_pools",
    description: "List all resource pools in the cluster",
    category: "pools",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/pools");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_pool",
    description:
      "Get detailed information about a resource pool including its members",
    category: "pools",
    accessTier: "read-only",
    inputSchema: {
      poolid: z.string().describe("The pool ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/pools/${encodeURIComponent(String(args.poolid))}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_pool",
    description: "Create a new resource pool",
    category: "pools",
    accessTier: "full",
    inputSchema: {
      poolid: z.string().describe("The pool ID"),
      comment: z.string().optional().describe("Pool comment/description"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { poolid: args.poolid };
      if (args.comment !== undefined) body.comment = args.comment;
      await client.post("/pools", body);
      return `Pool '${args.poolid}' created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_pool",
    description:
      "Update a resource pool — add or remove VMs/containers and storage from the pool",
    category: "pools",
    accessTier: "full",
    inputSchema: {
      poolid: z.string().describe("The pool ID"),
      comment: z.string().optional().describe("Pool comment/description"),
      vms: z
        .string()
        .optional()
        .describe("Comma-separated list of VMIDs to add/remove"),
      storage: z
        .string()
        .optional()
        .describe("Comma-separated list of storage IDs to add/remove"),
      delete: z
        .boolean()
        .optional()
        .describe("Remove specified VMs/storage from pool instead of adding"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.vms !== undefined) body.vms = args.vms;
      if (args.storage !== undefined) body.storage = args.storage;
      if (args.delete !== undefined) body.delete = args.delete ? 1 : 0;
      await client.put(
        `/pools/${encodeURIComponent(String(args.poolid))}`,
        body,
      );
      return `Pool '${args.poolid}' updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_pool",
    description: "Delete a resource pool (pool must be empty)",
    category: "pools",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      poolid: z.string().describe("The pool ID to delete"),
    },
    handler: async (args) => {
      await client.delete(
        `/pools/${encodeURIComponent(String(args.poolid))}`,
      );
      return `Pool '${args.poolid}' deleted successfully.`;
    },
  });
}
