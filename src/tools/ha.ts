/**
 * HA (High Availability) tools: CRUD for HA-managed resources.
 *
 * SID format: type:vmid (e.g. vm:100, ct:200)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerHaTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_ha_resources",
    description: "List all HA-managed resources in the cluster",
    category: "ha",
    accessTier: "read-only",
    inputSchema: {
      type: z
        .enum(["vm", "ct"])
        .optional()
        .describe("Filter by resource type"),
    },
    handler: async (args) => {
      let path = "/cluster/ha/resources";
      if (args.type) path += `?type=${args.type}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_ha_resource",
    description:
      "Get the HA configuration for a specific resource. SID format: type:vmid (e.g. vm:100)",
    category: "ha",
    accessTier: "read-only",
    inputSchema: {
      sid: z
        .string()
        .describe("The HA resource SID (e.g. vm:100, ct:200)"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/cluster/ha/resources/${encodeURIComponent(String(args.sid))}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_ha_resource",
    description:
      "Add a VM or container to HA management. SID format: type:vmid (e.g. vm:100)",
    category: "ha",
    accessTier: "full",
    inputSchema: {
      sid: z.string().describe("The resource SID (e.g. vm:100, ct:200)"),
      group: z
        .string()
        .optional()
        .describe("HA group name"),
      max_relocate: z
        .number()
        .optional()
        .describe("Maximum number of relocate attempts (default: 1)"),
      max_restart: z
        .number()
        .optional()
        .describe("Maximum number of restart attempts (default: 1)"),
      state: z
        .enum(["started", "stopped", "enabled", "disabled", "ignored"])
        .optional()
        .describe("Requested HA state (default: started)"),
      comment: z.string().optional().describe("Resource comment"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { sid: args.sid };
      if (args.group !== undefined) body.group = args.group;
      if (args.max_relocate !== undefined) body.max_relocate = args.max_relocate;
      if (args.max_restart !== undefined) body.max_restart = args.max_restart;
      if (args.state !== undefined) body.state = args.state;
      if (args.comment !== undefined) body.comment = args.comment;
      await client.post("/cluster/ha/resources", body);
      return `HA resource '${args.sid}' created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_ha_resource",
    description: "Update the HA configuration for an existing managed resource",
    category: "ha",
    accessTier: "full",
    inputSchema: {
      sid: z.string().describe("The resource SID (e.g. vm:100, ct:200)"),
      group: z.string().optional().describe("HA group name"),
      max_relocate: z
        .number()
        .optional()
        .describe("Maximum number of relocate attempts"),
      max_restart: z
        .number()
        .optional()
        .describe("Maximum number of restart attempts"),
      state: z
        .enum(["started", "stopped", "enabled", "disabled", "ignored"])
        .optional()
        .describe("Requested HA state"),
      comment: z.string().optional().describe("Resource comment"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.group !== undefined) body.group = args.group;
      if (args.max_relocate !== undefined) body.max_relocate = args.max_relocate;
      if (args.max_restart !== undefined) body.max_restart = args.max_restart;
      if (args.state !== undefined) body.state = args.state;
      if (args.comment !== undefined) body.comment = args.comment;
      await client.put(
        `/cluster/ha/resources/${encodeURIComponent(String(args.sid))}`,
        body,
      );
      return `HA resource '${args.sid}' updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_ha_resource",
    description:
      "Remove a VM or container from HA management (does not delete the VM/container itself)",
    category: "ha",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      sid: z.string().describe("The resource SID to remove (e.g. vm:100)"),
    },
    handler: async (args) => {
      await client.delete(
        `/cluster/ha/resources/${encodeURIComponent(String(args.sid))}`,
      );
      return `HA resource '${args.sid}' removed from HA management.`;
    },
  });
}
