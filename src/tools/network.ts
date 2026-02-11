/**
 * Network tools: list, get, and CRUD for node network interfaces.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerNetworkTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_networks",
    description: "List all network interfaces on a specific node",
    category: "network",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      type: z
        .enum(["bridge", "bond", "eth", "alias", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort", "any_bridge", "any_local_bridge"])
        .optional()
        .describe("Filter by interface type"),
    },
    handler: async (args) => {
      let path = `/nodes/${args.node}/network`;
      if (args.type) path += `?type=${args.type}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_network",
    description: "Get the configuration of a specific network interface on a node",
    category: "network",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      iface: z.string().describe("The interface name (e.g. vmbr0, eth0)"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/network/${args.iface}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_network",
    description: "Create a new network interface on a node",
    category: "network",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      iface: z.string().describe("The interface name (e.g. vmbr1)"),
      type: z
        .enum(["bridge", "bond", "eth", "alias", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort"])
        .describe("Interface type"),
      address: z
        .string()
        .optional()
        .describe("IPv4 address (CIDR notation or plain)"),
      netmask: z.string().optional().describe("IPv4 netmask"),
      gateway: z.string().optional().describe("Default gateway"),
      bridge_ports: z
        .string()
        .optional()
        .describe("Bridge ports (e.g. eno1)"),
      bridge_vlan_aware: z
        .boolean()
        .optional()
        .describe("Enable VLAN awareness on bridge"),
      autostart: z
        .boolean()
        .optional()
        .describe("Automatically start interface on boot"),
      comments: z.string().optional().describe("Comments for the interface"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        iface: args.iface,
        type: args.type,
      };
      if (args.address !== undefined) body.address = args.address;
      if (args.netmask !== undefined) body.netmask = args.netmask;
      if (args.gateway !== undefined) body.gateway = args.gateway;
      if (args.bridge_ports !== undefined) body.bridge_ports = args.bridge_ports;
      if (args.bridge_vlan_aware !== undefined)
        body.bridge_vlan_aware = args.bridge_vlan_aware ? 1 : 0;
      if (args.autostart !== undefined) body.autostart = args.autostart ? 1 : 0;
      if (args.comments !== undefined) body.comments = args.comments;
      await client.post(`/nodes/${args.node}/network`, body);
      return `Network interface '${args.iface}' created on node ${args.node}. Apply changes with a node network reload.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_network",
    description: "Update the configuration of a network interface on a node",
    category: "network",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      iface: z.string().describe("The interface name"),
      type: z
        .enum(["bridge", "bond", "eth", "alias", "vlan", "OVSBridge", "OVSBond", "OVSPort", "OVSIntPort"])
        .describe("Interface type"),
      address: z.string().optional().describe("IPv4 address"),
      netmask: z.string().optional().describe("IPv4 netmask"),
      gateway: z.string().optional().describe("Default gateway"),
      bridge_ports: z.string().optional().describe("Bridge ports"),
      bridge_vlan_aware: z
        .boolean()
        .optional()
        .describe("Enable VLAN awareness on bridge"),
      autostart: z
        .boolean()
        .optional()
        .describe("Automatically start interface on boot"),
      comments: z.string().optional().describe("Comments for the interface"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { type: args.type };
      if (args.address !== undefined) body.address = args.address;
      if (args.netmask !== undefined) body.netmask = args.netmask;
      if (args.gateway !== undefined) body.gateway = args.gateway;
      if (args.bridge_ports !== undefined) body.bridge_ports = args.bridge_ports;
      if (args.bridge_vlan_aware !== undefined)
        body.bridge_vlan_aware = args.bridge_vlan_aware ? 1 : 0;
      if (args.autostart !== undefined) body.autostart = args.autostart ? 1 : 0;
      if (args.comments !== undefined) body.comments = args.comments;
      await client.put(`/nodes/${args.node}/network/${args.iface}`, body);
      return `Network interface '${args.iface}' updated on node ${args.node}. Apply changes with a node network reload.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_network",
    description: "Delete a network interface configuration on a node",
    category: "network",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      iface: z.string().describe("The interface name to delete"),
    },
    handler: async (args) => {
      await client.delete(`/nodes/${args.node}/network/${args.iface}`);
      return `Network interface '${args.iface}' deleted on node ${args.node}. Apply changes with a node network reload.`;
    },
  });
}
