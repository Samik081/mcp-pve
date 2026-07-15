/**
 * HA (High Availability) tools: CRUD for HA-managed resources.
 *
 * SID format: type:vmid (e.g. vm:100, ct:200)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PveClient } from "../core/client.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

export function registerHaTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_ha_resources",
    title: "List HA Resources",
    description: "List all HA-managed resources in the cluster",
    category: "ha",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      type: z.enum(["vm", "ct"]).optional().describe("Filter by resource type"),
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
    title: "Get HA Resource",
    description:
      "Get the HA configuration for a specific resource. SID format: type:vmid (e.g. vm:100)",
    category: "ha",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      sid: z.string().describe("The HA resource SID (e.g. vm:100, ct:200)"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/cluster/ha/resources/${encodeURIComponent(String(args.sid))}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_ha_rules",
    title: "List HA Rules",
    description:
      "List HA rules (node-affinity and resource-affinity). HA rules replace the deprecated HA groups (PVE 9+)",
    category: "ha",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      type: z
        .enum(["node-affinity", "resource-affinity"])
        .optional()
        .describe("Filter by rule type"),
      resource: z
        .string()
        .optional()
        .describe("Only rules affecting this resource (e.g. vm:100)"),
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.type) params.set("type", String(args.type));
      if (args.resource) params.set("resource", String(args.resource));
      const qs = params.toString();
      const data = await client.get(`/cluster/ha/rules${qs ? `?${qs}` : ""}`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_ha_rule",
    title: "Get HA Rule",
    description: "Get the configuration of a specific HA rule",
    category: "ha",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      rule: z.string().describe("The HA rule identifier"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/cluster/ha/rules/${encodeURIComponent(String(args.rule))}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_ha_resource",
    title: "Create HA Resource",
    description:
      "Add a VM or container to HA management. SID format: type:vmid (e.g. vm:100). Requires Sys.Console privilege on PVE 9.2+",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    inputSchema: {
      sid: z.string().describe("The resource SID (e.g. vm:100, ct:200)"),
      group: z.string().optional().describe("HA group name"),
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
      if (args.max_relocate !== undefined)
        body.max_relocate = args.max_relocate;
      if (args.max_restart !== undefined) body.max_restart = args.max_restart;
      if (args.state !== undefined) body.state = args.state;
      if (args.comment !== undefined) body.comment = args.comment;
      await client.post("/cluster/ha/resources", body);
      return `HA resource '${args.sid}' created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_ha_resource",
    title: "Update HA Resource",
    description: "Update the HA configuration for an existing managed resource",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
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
      if (args.max_relocate !== undefined)
        body.max_relocate = args.max_relocate;
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
    title: "Delete HA Resource",
    description:
      "Remove a VM or container from HA management (does not delete the VM/container itself)",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
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

  registerTool(server, config, {
    name: "pve_create_ha_rule",
    title: "Create HA Rule",
    description:
      "Create an HA rule (node-affinity: pin resources to nodes; resource-affinity: keep resources together or apart). Requires Sys.Console. Resources format: comma-separated IDs (e.g. vm:100,ct:200)",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    inputSchema: {
      rule: z.string().describe("Unique HA rule identifier"),
      type: z
        .enum(["node-affinity", "resource-affinity"])
        .describe("HA rule type"),
      resources: z
        .string()
        .describe("Comma-separated HA resource IDs (e.g. vm:100,ct:200)"),
      affinity: z
        .enum(["positive", "negative"])
        .optional()
        .describe(
          "resource-affinity only: keep resources together (positive) or apart (negative)",
        ),
      nodes: z
        .string()
        .optional()
        .describe(
          "node-affinity only: comma-separated nodes with optional priority (e.g. node1:2,node2)",
        ),
      strict: z
        .boolean()
        .optional()
        .describe("node-affinity only: strict rule (default: false)"),
      disable: z.boolean().optional().describe("Create the rule disabled"),
      comment: z.string().optional().describe("Rule description"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        rule: args.rule,
        type: args.type,
        resources: args.resources,
      };
      if (args.affinity !== undefined) body.affinity = args.affinity;
      if (args.nodes !== undefined) body.nodes = args.nodes;
      if (args.strict !== undefined) body.strict = args.strict ? 1 : 0;
      if (args.disable !== undefined) body.disable = args.disable ? 1 : 0;
      if (args.comment !== undefined) body.comment = args.comment;
      await client.post("/cluster/ha/rules", body);
      return `HA rule '${args.rule}' created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_ha_rule",
    title: "Update HA Rule",
    description:
      "Update an existing HA rule. Requires Sys.Console. Use delete_settings to unset options",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      rule: z.string().describe("The HA rule identifier"),
      resources: z
        .string()
        .optional()
        .describe("Comma-separated HA resource IDs (e.g. vm:100,ct:200)"),
      affinity: z
        .enum(["positive", "negative"])
        .optional()
        .describe(
          "resource-affinity only: keep resources together (positive) or apart (negative)",
        ),
      nodes: z
        .string()
        .optional()
        .describe(
          "node-affinity only: comma-separated nodes with optional priority",
        ),
      strict: z
        .boolean()
        .optional()
        .describe("node-affinity only: strict rule"),
      disable: z.boolean().optional().describe("Disable the rule"),
      comment: z.string().optional().describe("Rule description"),
      delete_settings: z
        .string()
        .optional()
        .describe("Comma-separated list of settings to unset"),
      digest: z
        .string()
        .optional()
        .describe("Prevent changes if config digest differs"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.resources !== undefined) body.resources = args.resources;
      if (args.affinity !== undefined) body.affinity = args.affinity;
      if (args.nodes !== undefined) body.nodes = args.nodes;
      if (args.strict !== undefined) body.strict = args.strict ? 1 : 0;
      if (args.disable !== undefined) body.disable = args.disable ? 1 : 0;
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.delete_settings !== undefined)
        body.delete = args.delete_settings;
      if (args.digest !== undefined) body.digest = args.digest;
      await client.put(
        `/cluster/ha/rules/${encodeURIComponent(String(args.rule))}`,
        body,
      );
      return `HA rule '${args.rule}' updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_ha_rule",
    title: "Delete HA Rule",
    description: "Delete an HA rule. Requires Sys.Console",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      rule: z.string().describe("The HA rule identifier to delete"),
    },
    handler: async (args) => {
      await client.delete(
        `/cluster/ha/rules/${encodeURIComponent(String(args.rule))}`,
      );
      return `HA rule '${args.rule}' deleted.`;
    },
  });

  registerTool(server, config, {
    name: "pve_disarm_ha",
    title: "Disarm HA Stack",
    description:
      "Disarm the HA stack cluster-wide for maintenance (releases node watchdogs, PVE 9.2+). resource_mode 'freeze': queue state changes until re-armed; 'ignore': HA ignores resources entirely. Requires Sys.Console privilege",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      resource_mode: z
        .enum(["freeze", "ignore"])
        .describe("How HA-managed resources are handled while disarmed"),
    },
    handler: async (args) => {
      await client.post("/cluster/ha/status/disarm-ha", {
        "resource-mode": args.resource_mode,
      });
      return `HA stack disarmed (resource mode: ${args.resource_mode}).`;
    },
  });

  registerTool(server, config, {
    name: "pve_arm_ha",
    title: "Arm HA Stack",
    description:
      "Re-arm the HA stack cluster-wide after maintenance (PVE 9.2+). Requires Sys.Console privilege",
    category: "ha",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    handler: async () => {
      await client.post("/cluster/ha/status/arm-ha");
      return "HA stack armed.";
    },
  });
}
