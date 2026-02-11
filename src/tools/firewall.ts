/**
 * Firewall tools: cluster-level firewall options, rules, aliases, and IP sets.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerFirewallTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_get_firewall_options",
    description: "Get the cluster-level firewall options",
    category: "firewall",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/firewall/options");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_firewall_rules",
    description: "List all cluster-level firewall rules",
    category: "firewall",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/firewall/rules");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_firewall_aliases",
    description: "List all cluster-level firewall aliases (named IP/CIDR entries)",
    category: "firewall",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/firewall/aliases");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_firewall_ipsets",
    description: "List all cluster-level firewall IP sets",
    category: "firewall",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/firewall/ipset");
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_update_firewall_options",
    description: "Update the cluster-level firewall options (e.g. enable/disable firewall)",
    category: "firewall",
    accessTier: "full",
    inputSchema: {
      enable: z
        .boolean()
        .optional()
        .describe("Enable or disable the cluster firewall"),
      policy_in: z
        .enum(["ACCEPT", "REJECT", "DROP"])
        .optional()
        .describe("Default input policy"),
      policy_out: z
        .enum(["ACCEPT", "REJECT", "DROP"])
        .optional()
        .describe("Default output policy"),
      log_ratelimit: z
        .string()
        .optional()
        .describe("Log rate limit (e.g. 'enable=1,rate=1/second,burst=5')"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.enable !== undefined) body.enable = args.enable ? 1 : 0;
      if (args.policy_in !== undefined) body.policy_in = args.policy_in;
      if (args.policy_out !== undefined) body.policy_out = args.policy_out;
      if (args.log_ratelimit !== undefined)
        body.log_ratelimit = args.log_ratelimit;
      await client.put("/cluster/firewall/options", body);
      return "Cluster firewall options updated successfully.";
    },
  });

  registerTool(server, config, {
    name: "pve_create_firewall_rule",
    description: "Create a new cluster-level firewall rule",
    category: "firewall",
    accessTier: "full",
    inputSchema: {
      action: z
        .enum(["ACCEPT", "DROP", "REJECT"])
        .describe("Rule action"),
      type: z.enum(["in", "out", "group"]).describe("Rule type (direction)"),
      enable: z
        .boolean()
        .optional()
        .describe("Enable the rule (default: true)"),
      source: z
        .string()
        .optional()
        .describe("Source address/CIDR or alias"),
      dest: z
        .string()
        .optional()
        .describe("Destination address/CIDR or alias"),
      proto: z
        .string()
        .optional()
        .describe("Protocol (e.g. tcp, udp, icmp)"),
      dport: z
        .string()
        .optional()
        .describe("Destination port or port range"),
      sport: z
        .string()
        .optional()
        .describe("Source port or port range"),
      comment: z.string().optional().describe("Rule comment"),
      pos: z
        .number()
        .optional()
        .describe("Position in the rule list (0-based)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        action: args.action,
        type: args.type,
      };
      if (args.enable !== undefined) body.enable = args.enable ? 1 : 0;
      if (args.source !== undefined) body.source = args.source;
      if (args.dest !== undefined) body.dest = args.dest;
      if (args.proto !== undefined) body.proto = args.proto;
      if (args.dport !== undefined) body.dport = args.dport;
      if (args.sport !== undefined) body.sport = args.sport;
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.pos !== undefined) body.pos = args.pos;
      await client.post("/cluster/firewall/rules", body);
      return "Cluster firewall rule created successfully.";
    },
  });

  registerTool(server, config, {
    name: "pve_update_firewall_rule",
    description: "Update an existing cluster-level firewall rule by position",
    category: "firewall",
    accessTier: "full",
    inputSchema: {
      pos: z.number().describe("Rule position (0-based index)"),
      action: z
        .enum(["ACCEPT", "DROP", "REJECT"])
        .optional()
        .describe("Rule action"),
      enable: z
        .boolean()
        .optional()
        .describe("Enable or disable the rule"),
      source: z.string().optional().describe("Source address/CIDR or alias"),
      dest: z
        .string()
        .optional()
        .describe("Destination address/CIDR or alias"),
      proto: z.string().optional().describe("Protocol"),
      dport: z
        .string()
        .optional()
        .describe("Destination port or port range"),
      sport: z.string().optional().describe("Source port or port range"),
      comment: z.string().optional().describe("Rule comment"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.action !== undefined) body.action = args.action;
      if (args.enable !== undefined) body.enable = args.enable ? 1 : 0;
      if (args.source !== undefined) body.source = args.source;
      if (args.dest !== undefined) body.dest = args.dest;
      if (args.proto !== undefined) body.proto = args.proto;
      if (args.dport !== undefined) body.dport = args.dport;
      if (args.sport !== undefined) body.sport = args.sport;
      if (args.comment !== undefined) body.comment = args.comment;
      await client.put(`/cluster/firewall/rules/${args.pos}`, body);
      return `Cluster firewall rule at position ${args.pos} updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_firewall_rule",
    description: "Delete a cluster-level firewall rule by position",
    category: "firewall",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      pos: z.number().describe("Rule position (0-based index) to delete"),
    },
    handler: async (args) => {
      await client.delete(`/cluster/firewall/rules/${args.pos}`);
      return `Cluster firewall rule at position ${args.pos} deleted successfully.`;
    },
  });
}
