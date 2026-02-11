/**
 * LXC container tools: list, status, config, snapshots, power actions, and lifecycle.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerLxcTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_lxc_containers",
    description: "List all LXC containers on a specific node",
    category: "lxc",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/lxc`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_lxc_status",
    description:
      "Get the current status of an LXC container including CPU, memory, and disk usage",
    category: "lxc",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/lxc/${args.vmid}/status/current`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_lxc_config",
    description: "Get the configuration of an LXC container",
    category: "lxc",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/lxc/${args.vmid}/config`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_lxc_rrddata",
    description:
      "Get RRD statistics (CPU, memory, disk, network) for an LXC container over a time period",
    category: "lxc",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      timeframe: z
        .enum(["hour", "day", "week", "month", "year"])
        .describe("Time frame for the RRD data"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/lxc/${args.vmid}/rrddata?timeframe=${args.timeframe}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_lxc_snapshots",
    description: "List all snapshots of an LXC container",
    category: "lxc",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/lxc/${args.vmid}/snapshot`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Read-execute tools (power actions) ---

  const powerActions = [
    { action: "start", method: "start", desc: "Start" },
    { action: "stop", method: "stop", desc: "Stop (immediate)" },
    { action: "shutdown", method: "shutdown", desc: "Gracefully shut down" },
    { action: "reboot", method: "reboot", desc: "Reboot" },
    { action: "suspend", method: "suspend", desc: "Suspend (freeze)" },
    { action: "resume", method: "resume", desc: "Resume (unfreeze)" },
  ] as const;

  for (const { action, method, desc } of powerActions) {
    registerTool(server, config, {
      name: `pve_${action}_lxc_container`,
      description: `${desc} an LXC container`,
      category: "lxc",
      accessTier: "read-execute",
      inputSchema: {
        node: z.string().describe("The node name"),
        vmid: z.number().describe("The container ID"),
      },
      handler: async (args) => {
        const data = await client.post(
          `/nodes/${args.node}/lxc/${args.vmid}/status/${method}`,
        );
        return `Container ${args.vmid} ${action} initiated on node ${args.node}. Task: ${data}`;
      },
    });
  }

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_lxc_container",
    description: "Create a new LXC container",
    category: "lxc",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      ostemplate: z
        .string()
        .describe("OS template (e.g. local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst)"),
      hostname: z.string().optional().describe("Container hostname"),
      memory: z
        .number()
        .optional()
        .describe("Memory in MB (default: 512)"),
      swap: z
        .number()
        .optional()
        .describe("Swap size in MB (default: 512)"),
      cores: z
        .number()
        .optional()
        .describe("Number of CPU cores (default: 1)"),
      rootfs: z
        .string()
        .optional()
        .describe("Root filesystem config (e.g. local-lvm:8)"),
      net0: z
        .string()
        .optional()
        .describe("Network config (e.g. name=eth0,bridge=vmbr0,ip=dhcp)"),
      password: z
        .string()
        .optional()
        .describe("Root password for the container"),
      unprivileged: z
        .boolean()
        .optional()
        .describe("Create as unprivileged container (default: false)"),
      start: z
        .boolean()
        .optional()
        .describe("Start container after creation"),
      ssh_public_keys: z
        .string()
        .optional()
        .describe("SSH public keys to add to the container"),
      storage: z
        .string()
        .optional()
        .describe("Target storage for rootfs"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        vmid: args.vmid,
        ostemplate: args.ostemplate,
      };
      if (args.hostname !== undefined) body.hostname = args.hostname;
      if (args.memory !== undefined) body.memory = args.memory;
      if (args.swap !== undefined) body.swap = args.swap;
      if (args.cores !== undefined) body.cores = args.cores;
      if (args.rootfs !== undefined) body.rootfs = args.rootfs;
      if (args.net0 !== undefined) body.net0 = args.net0;
      if (args.password !== undefined) body.password = args.password;
      if (args.unprivileged !== undefined)
        body.unprivileged = args.unprivileged ? 1 : 0;
      if (args.start !== undefined) body.start = args.start ? 1 : 0;
      if (args.ssh_public_keys !== undefined)
        body["ssh-public-keys"] = args.ssh_public_keys;
      if (args.storage !== undefined) body.storage = args.storage;
      const data = await client.post(`/nodes/${args.node}/lxc`, body);
      return `Container ${args.vmid} creation initiated on node ${args.node}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_lxc_container",
    description:
      "Delete an LXC container and all its data. The container must be stopped first.",
    category: "lxc",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      purge: z
        .boolean()
        .optional()
        .describe("Remove from all related configurations (e.g. backup jobs, HA)"),
      force: z
        .boolean()
        .optional()
        .describe("Force destruction even if running"),
      "destroy-unreferenced-disks": z
        .boolean()
        .optional()
        .describe("Delete unreferenced disks owned by the container"),
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.purge) params.set("purge", "1");
      if (args.force) params.set("force", "1");
      if (args["destroy-unreferenced-disks"])
        params.set("destroy-unreferenced-disks", "1");
      const qs = params.toString();
      const path = `/nodes/${args.node}/lxc/${args.vmid}${qs ? `?${qs}` : ""}`;
      const data = await client.delete(path);
      return `Container ${args.vmid} deletion initiated on node ${args.node}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_lxc_config",
    description: "Update the configuration of an LXC container",
    category: "lxc",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      hostname: z.string().optional().describe("Container hostname"),
      memory: z.number().optional().describe("Memory in MB"),
      swap: z.number().optional().describe("Swap size in MB"),
      cores: z.number().optional().describe("Number of CPU cores"),
      description: z.string().optional().describe("Container description"),
      onboot: z
        .boolean()
        .optional()
        .describe("Start on boot"),
      net0: z
        .string()
        .optional()
        .describe("Network device config"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.hostname !== undefined) body.hostname = args.hostname;
      if (args.memory !== undefined) body.memory = args.memory;
      if (args.swap !== undefined) body.swap = args.swap;
      if (args.cores !== undefined) body.cores = args.cores;
      if (args.description !== undefined) body.description = args.description;
      if (args.onboot !== undefined) body.onboot = args.onboot ? 1 : 0;
      if (args.net0 !== undefined) body.net0 = args.net0;
      await client.put(
        `/nodes/${args.node}/lxc/${args.vmid}/config`,
        body,
      );
      return `Container ${args.vmid} configuration updated on node ${args.node}.`;
    },
  });

  registerTool(server, config, {
    name: "pve_clone_lxc_container",
    description: "Clone an LXC container to create a new container from it",
    category: "lxc",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The source node name"),
      vmid: z.number().describe("The source container ID"),
      newid: z.number().describe("The new container ID for the clone"),
      hostname: z.string().optional().describe("Hostname for the cloned container"),
      target: z
        .string()
        .optional()
        .describe("Target node for the clone (default: same node)"),
      full: z
        .boolean()
        .optional()
        .describe("Full clone (true) or linked clone (false)"),
      description: z
        .string()
        .optional()
        .describe("Description for the cloned container"),
      snapname: z
        .string()
        .optional()
        .describe("Snapshot name to clone from"),
      storage: z
        .string()
        .optional()
        .describe("Target storage for full clone"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { newid: args.newid };
      if (args.hostname !== undefined) body.hostname = args.hostname;
      if (args.target !== undefined) body.target = args.target;
      if (args.full !== undefined) body.full = args.full ? 1 : 0;
      if (args.description !== undefined) body.description = args.description;
      if (args.snapname !== undefined) body.snapname = args.snapname;
      if (args.storage !== undefined) body.storage = args.storage;
      const data = await client.post(
        `/nodes/${args.node}/lxc/${args.vmid}/clone`,
        body,
      );
      return `Container ${args.vmid} clone to ID ${args.newid} initiated. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_create_lxc_snapshot",
    description: "Create a snapshot of an LXC container",
    category: "lxc",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      snapname: z.string().describe("Name for the snapshot"),
      description: z
        .string()
        .optional()
        .describe("Description for the snapshot"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { snapname: args.snapname };
      if (args.description !== undefined) body.description = args.description;
      const data = await client.post(
        `/nodes/${args.node}/lxc/${args.vmid}/snapshot`,
        body,
      );
      return `Snapshot '${args.snapname}' creation initiated for container ${args.vmid}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_lxc_snapshot",
    description: "Delete a snapshot of an LXC container",
    category: "lxc",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      snapname: z.string().describe("Name of the snapshot to delete"),
    },
    handler: async (args) => {
      const data = await client.delete(
        `/nodes/${args.node}/lxc/${args.vmid}/snapshot/${args.snapname}`,
      );
      return `Snapshot '${args.snapname}' deletion initiated for container ${args.vmid}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_rollback_lxc_snapshot",
    description: "Rollback an LXC container to a previous snapshot state",
    category: "lxc",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The container ID"),
      snapname: z.string().describe("Name of the snapshot to rollback to"),
    },
    handler: async (args) => {
      const data = await client.post(
        `/nodes/${args.node}/lxc/${args.vmid}/snapshot/${args.snapname}/rollback`,
      );
      return `Rollback to snapshot '${args.snapname}' initiated for container ${args.vmid}. Task: ${data}`;
    },
  });
}
