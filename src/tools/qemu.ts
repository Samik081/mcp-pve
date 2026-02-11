/**
 * QEMU VM tools: list, status, config, snapshots, power actions, and lifecycle.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerQemuTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_qemu_vms",
    description: "List all QEMU virtual machines on a specific node",
    category: "qemu",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/qemu`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_qemu_status",
    description:
      "Get the current status of a QEMU VM including CPU, memory, disk, and network usage",
    category: "qemu",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/qemu/${args.vmid}/status/current`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_qemu_config",
    description: "Get the configuration of a QEMU VM",
    category: "qemu",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/qemu/${args.vmid}/config`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_qemu_rrddata",
    description:
      "Get RRD statistics (CPU, memory, disk, network) for a QEMU VM over a time period",
    category: "qemu",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      timeframe: z
        .enum(["hour", "day", "week", "month", "year"])
        .describe("Time frame for the RRD data"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/qemu/${args.vmid}/rrddata?timeframe=${args.timeframe}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_qemu_snapshots",
    description: "List all snapshots of a QEMU VM",
    category: "qemu",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/qemu/${args.vmid}/snapshot`,
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
    { action: "suspend", method: "suspend", desc: "Suspend" },
    { action: "resume", method: "resume", desc: "Resume" },
    { action: "reset", method: "reset", desc: "Reset (hard)" },
  ] as const;

  for (const { action, method, desc } of powerActions) {
    registerTool(server, config, {
      name: `pve_${action}_qemu_vm`,
      description: `${desc} a QEMU virtual machine`,
      category: "qemu",
      accessTier: "read-execute",
      inputSchema: {
        node: z.string().describe("The node name"),
        vmid: z.number().describe("The VM ID"),
      },
      handler: async (args) => {
        const data = await client.post(
          `/nodes/${args.node}/qemu/${args.vmid}/status/${method}`,
        );
        return `VM ${args.vmid} ${action} initiated on node ${args.node}. Task: ${data}`;
      },
    });
  }

  registerTool(server, config, {
    name: "pve_migrate_qemu_vm",
    description: "Migrate a QEMU VM to another node in the cluster",
    category: "qemu",
    accessTier: "read-execute",
    inputSchema: {
      node: z.string().describe("The source node name"),
      vmid: z.number().describe("The VM ID"),
      target: z.string().describe("The target node name"),
      online: z
        .boolean()
        .optional()
        .describe("Perform an online (live) migration (default: false)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { target: args.target };
      if (args.online !== undefined) body.online = args.online ? 1 : 0;
      const data = await client.post(
        `/nodes/${args.node}/qemu/${args.vmid}/migrate`,
        body,
      );
      return `VM ${args.vmid} migration to ${args.target} initiated. Task: ${data}`;
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_qemu_vm",
    description: "Create a new QEMU virtual machine",
    category: "qemu",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      name: z.string().optional().describe("VM name"),
      memory: z
        .number()
        .optional()
        .describe("Memory in MB (default: 512)"),
      cores: z
        .number()
        .optional()
        .describe("Number of CPU cores (default: 1)"),
      sockets: z
        .number()
        .optional()
        .describe("Number of CPU sockets (default: 1)"),
      ostype: z
        .string()
        .optional()
        .describe("OS type (e.g. l26, win10, other)"),
      ide2: z
        .string()
        .optional()
        .describe("IDE device config (e.g. local:iso/image.iso,media=cdrom)"),
      scsi0: z
        .string()
        .optional()
        .describe("SCSI disk config (e.g. local-lvm:32)"),
      net0: z
        .string()
        .optional()
        .describe("Network config (e.g. virtio,bridge=vmbr0)"),
      scsihw: z
        .string()
        .optional()
        .describe("SCSI controller type (e.g. virtio-scsi-pci)"),
      boot: z
        .string()
        .optional()
        .describe("Boot order (e.g. order=scsi0;ide2;net0)"),
      start: z
        .boolean()
        .optional()
        .describe("Start VM after creation"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { vmid: args.vmid };
      if (args.name !== undefined) body.name = args.name;
      if (args.memory !== undefined) body.memory = args.memory;
      if (args.cores !== undefined) body.cores = args.cores;
      if (args.sockets !== undefined) body.sockets = args.sockets;
      if (args.ostype !== undefined) body.ostype = args.ostype;
      if (args.ide2 !== undefined) body.ide2 = args.ide2;
      if (args.scsi0 !== undefined) body.scsi0 = args.scsi0;
      if (args.net0 !== undefined) body.net0 = args.net0;
      if (args.scsihw !== undefined) body.scsihw = args.scsihw;
      if (args.boot !== undefined) body.boot = args.boot;
      if (args.start !== undefined) body.start = args.start ? 1 : 0;
      const data = await client.post(`/nodes/${args.node}/qemu`, body);
      return `VM ${args.vmid} creation initiated on node ${args.node}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_qemu_vm",
    description:
      "Delete a QEMU virtual machine and all its data. The VM must be stopped first.",
    category: "qemu",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      purge: z
        .boolean()
        .optional()
        .describe("Remove from all related configurations (e.g. backup jobs, HA)"),
      "destroy-unreferenced-disks": z
        .boolean()
        .optional()
        .describe("Delete unreferenced disks owned by the VM"),
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.purge) params.set("purge", "1");
      if (args["destroy-unreferenced-disks"])
        params.set("destroy-unreferenced-disks", "1");
      const qs = params.toString();
      const path = `/nodes/${args.node}/qemu/${args.vmid}${qs ? `?${qs}` : ""}`;
      const data = await client.delete(path);
      return `VM ${args.vmid} deletion initiated on node ${args.node}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_qemu_config",
    description: "Update the configuration of a QEMU VM",
    category: "qemu",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      name: z.string().optional().describe("VM name"),
      memory: z.number().optional().describe("Memory in MB"),
      cores: z.number().optional().describe("Number of CPU cores"),
      sockets: z.number().optional().describe("Number of CPU sockets"),
      description: z.string().optional().describe("VM description"),
      onboot: z
        .boolean()
        .optional()
        .describe("Start on boot"),
      net0: z
        .string()
        .optional()
        .describe("Network device config"),
      scsi0: z
        .string()
        .optional()
        .describe("SCSI disk config"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.name !== undefined) body.name = args.name;
      if (args.memory !== undefined) body.memory = args.memory;
      if (args.cores !== undefined) body.cores = args.cores;
      if (args.sockets !== undefined) body.sockets = args.sockets;
      if (args.description !== undefined) body.description = args.description;
      if (args.onboot !== undefined) body.onboot = args.onboot ? 1 : 0;
      if (args.net0 !== undefined) body.net0 = args.net0;
      if (args.scsi0 !== undefined) body.scsi0 = args.scsi0;
      await client.put(
        `/nodes/${args.node}/qemu/${args.vmid}/config`,
        body,
      );
      return `VM ${args.vmid} configuration updated on node ${args.node}.`;
    },
  });

  registerTool(server, config, {
    name: "pve_clone_qemu_vm",
    description: "Clone a QEMU VM to create a new VM from it",
    category: "qemu",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The source node name"),
      vmid: z.number().describe("The source VM ID"),
      newid: z.number().describe("The new VM ID for the clone"),
      name: z.string().optional().describe("Name for the cloned VM"),
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
        .describe("Description for the cloned VM"),
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
      if (args.name !== undefined) body.name = args.name;
      if (args.target !== undefined) body.target = args.target;
      if (args.full !== undefined) body.full = args.full ? 1 : 0;
      if (args.description !== undefined) body.description = args.description;
      if (args.snapname !== undefined) body.snapname = args.snapname;
      if (args.storage !== undefined) body.storage = args.storage;
      const data = await client.post(
        `/nodes/${args.node}/qemu/${args.vmid}/clone`,
        body,
      );
      return `VM ${args.vmid} clone to VMID ${args.newid} initiated. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_create_qemu_snapshot",
    description: "Create a snapshot of a QEMU VM",
    category: "qemu",
    accessTier: "full",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      snapname: z.string().describe("Name for the snapshot"),
      description: z
        .string()
        .optional()
        .describe("Description for the snapshot"),
      vmstate: z
        .boolean()
        .optional()
        .describe("Include VM RAM state in snapshot"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { snapname: args.snapname };
      if (args.description !== undefined) body.description = args.description;
      if (args.vmstate !== undefined) body.vmstate = args.vmstate ? 1 : 0;
      const data = await client.post(
        `/nodes/${args.node}/qemu/${args.vmid}/snapshot`,
        body,
      );
      return `Snapshot '${args.snapname}' creation initiated for VM ${args.vmid}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_qemu_snapshot",
    description: "Delete a snapshot of a QEMU VM",
    category: "qemu",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      snapname: z.string().describe("Name of the snapshot to delete"),
    },
    handler: async (args) => {
      const data = await client.delete(
        `/nodes/${args.node}/qemu/${args.vmid}/snapshot/${args.snapname}`,
      );
      return `Snapshot '${args.snapname}' deletion initiated for VM ${args.vmid}. Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_rollback_qemu_snapshot",
    description: "Rollback a QEMU VM to a previous snapshot state",
    category: "qemu",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z.number().describe("The VM ID"),
      snapname: z.string().describe("Name of the snapshot to rollback to"),
    },
    handler: async (args) => {
      const data = await client.post(
        `/nodes/${args.node}/qemu/${args.vmid}/snapshot/${args.snapname}/rollback`,
      );
      return `Rollback to snapshot '${args.snapname}' initiated for VM ${args.vmid}. Task: ${data}`;
    },
  });
}
