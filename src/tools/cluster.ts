/**
 * Cluster tools: status, resources, options, and cluster-wide information.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PveClient } from "../core/client.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

export function registerClusterTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_get_cluster_status",
    title: "Get Cluster Status",
    description:
      "Get the current cluster status including node membership and quorum",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/status");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_resources",
    title: "List Cluster Resources",
    description:
      "List all cluster resources (VMs, containers, storage, nodes) with optional type filter",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
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
    title: "Get Next VMID",
    description: "Get the next available VMID in the cluster",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/nextid");
      return `Next available VMID: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_get_cluster_log",
    title: "Get Cluster Log",
    description: "Get recent cluster log entries",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
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
    title: "Get Cluster Options",
    description: "Get cluster-wide datacenter options",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/options");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_backup_info",
    title: "List Cluster Backup Info",
    description: "List guests that are not covered by any backup job",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/backup-info/not-backed-up");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_cluster_ha_status",
    title: "Get Cluster HA Status",
    description: "Get the current HA manager status",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/ha/status/current");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_cluster_replication",
    title: "List Cluster Replication",
    description: "List all replication jobs in the cluster",
    category: "cluster",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/cluster/replication");
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Read-execute tools (datacenter bulk guest actions, PVE 9.1+) ---

  registerTool(server, config, {
    name: "pve_bulk_start_guests",
    title: "Bulk Start Guests",
    description:
      "Start multiple VMs/containers cluster-wide in one bulk action (PVE 9.1+). Returns a task ID",
    category: "cluster",
    accessTier: "read-execute",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      vms: z.array(z.number()).min(1).describe("VMIDs of the guests to start"),
      timeout: z
        .number()
        .optional()
        .describe("Start timeout in seconds per guest (VMs only)"),
      max_workers: z
        .number()
        .optional()
        .describe("Maximum concurrent tasks (default: 4)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { vms: args.vms };
      if (args.timeout !== undefined) body.timeout = args.timeout;
      if (args.max_workers !== undefined)
        body["max-workers"] = args.max_workers;
      const data = await client.post("/cluster/bulk-action/guest/start", body);
      return `Bulk start initiated for ${(args.vms as number[]).length} guest(s). Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_bulk_shutdown_guests",
    title: "Bulk Shutdown Guests",
    description:
      "Gracefully shut down multiple VMs/containers cluster-wide in one bulk action (PVE 9.1+). Returns a task ID",
    category: "cluster",
    accessTier: "read-execute",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      vms: z
        .array(z.number())
        .min(1)
        .describe("VMIDs of the guests to shut down"),
      timeout: z
        .number()
        .optional()
        .describe("Shutdown timeout in seconds per guest (default: 180)"),
      force_stop: z
        .boolean()
        .optional()
        .describe(
          "Hard-stop guests that do not shut down in time (default: true)",
        ),
      max_workers: z
        .number()
        .optional()
        .describe("Maximum concurrent tasks (default: 4)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { vms: args.vms };
      if (args.timeout !== undefined) body.timeout = args.timeout;
      if (args.force_stop !== undefined)
        body["force-stop"] = args.force_stop ? 1 : 0;
      if (args.max_workers !== undefined)
        body["max-workers"] = args.max_workers;
      const data = await client.post(
        "/cluster/bulk-action/guest/shutdown",
        body,
      );
      return `Bulk shutdown initiated for ${(args.vms as number[]).length} guest(s). Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_bulk_suspend_guests",
    title: "Bulk Suspend Guests",
    description:
      "Suspend multiple VMs cluster-wide in one bulk action (PVE 9.1+). Returns a task ID",
    category: "cluster",
    accessTier: "read-execute",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      vms: z
        .array(z.number())
        .min(1)
        .describe("VMIDs of the guests to suspend"),
      to_disk: z
        .boolean()
        .optional()
        .describe("Suspend to disk; resumed on next start (default: false)"),
      statestorage: z
        .string()
        .optional()
        .describe("Storage for the VM state (requires to_disk)"),
      max_workers: z
        .number()
        .optional()
        .describe("Maximum concurrent tasks (default: 4)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { vms: args.vms };
      if (args.to_disk !== undefined) body["to-disk"] = args.to_disk ? 1 : 0;
      if (args.statestorage !== undefined)
        body.statestorage = args.statestorage;
      if (args.max_workers !== undefined)
        body["max-workers"] = args.max_workers;
      const data = await client.post(
        "/cluster/bulk-action/guest/suspend",
        body,
      );
      return `Bulk suspend initiated for ${(args.vms as number[]).length} guest(s). Task: ${data}`;
    },
  });

  registerTool(server, config, {
    name: "pve_bulk_migrate_guests",
    title: "Bulk Migrate Guests",
    description:
      "Migrate multiple VMs/containers to a target node in one bulk action (PVE 9.1+). Returns a task ID",
    category: "cluster",
    accessTier: "read-execute",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      vms: z
        .array(z.number())
        .min(1)
        .describe("VMIDs of the guests to migrate"),
      target: z.string().describe("Target node name"),
      online: z
        .boolean()
        .optional()
        .describe("Live migration for VMs, restart migration for containers"),
      with_local_disks: z
        .boolean()
        .optional()
        .describe("Enable live storage migration for local disks"),
      max_workers: z
        .number()
        .optional()
        .describe("Maximum concurrent tasks (default: 1)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        vms: args.vms,
        target: args.target,
      };
      if (args.online !== undefined) body.online = args.online ? 1 : 0;
      if (args.with_local_disks !== undefined)
        body["with-local-disks"] = args.with_local_disks ? 1 : 0;
      if (args.max_workers !== undefined)
        body["max-workers"] = args.max_workers;
      const data = await client.post(
        "/cluster/bulk-action/guest/migrate",
        body,
      );
      return `Bulk migration to '${args.target}' initiated for ${(args.vms as number[]).length} guest(s). Task: ${data}`;
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_update_cluster_options",
    title: "Update Cluster Options",
    description: "Update cluster-wide datacenter options",
    category: "cluster",
    accessTier: "full",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    inputSchema: {
      keyboard: z
        .string()
        .optional()
        .describe("Default keyboard layout for VNC"),
      language: z.string().optional().describe("Default GUI language"),
      console: z
        .enum(["applet", "vv", "html5", "xtermjs"])
        .optional()
        .describe("Default console viewer"),
      http_proxy: z.string().optional().describe("HTTP proxy configuration"),
      migration_unsecure: z
        .boolean()
        .optional()
        .describe("Allow insecure migration"),
      crs: z
        .string()
        .optional()
        .describe(
          "Cluster resource scheduling options as a property string. Sub-keys: ha=basic|static|dynamic (dynamic enables the PVE 9.2 load balancer), ha-auto-rebalance=0|1, ha-auto-rebalance-threshold=<0-100>, ha-auto-rebalance-margin=<0-100>, ha-auto-rebalance-hold-duration=<n>, ha-auto-rebalance-method=bruteforce|topsis, ha-rebalance-on-start=0|1. Example: 'ha=dynamic,ha-auto-rebalance=1'",
        ),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.keyboard !== undefined) body.keyboard = args.keyboard;
      if (args.language !== undefined) body.language = args.language;
      if (args.console !== undefined) body.console = args.console;
      if (args.http_proxy !== undefined) body.http_proxy = args.http_proxy;
      if (args.migration_unsecure !== undefined)
        body.migration_unsecure = args.migration_unsecure ? 1 : 0;
      if (args.crs !== undefined) body.crs = args.crs;
      await client.put("/cluster/options", body);
      return "Cluster options updated successfully.";
    },
  });
}
