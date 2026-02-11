/**
 * Backup tools: backup jobs, manual backup execution, and job management.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerBackupTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_backup_jobs",
    description: "List all scheduled backup jobs in the cluster",
    category: "backup",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/cluster/backup");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_backup_job",
    description: "Get the configuration of a specific backup job",
    category: "backup",
    accessTier: "read-only",
    inputSchema: {
      id: z.string().describe("The backup job ID"),
    },
    handler: async (args) => {
      const data = await client.get(`/cluster/backup/${args.id}`);
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Read-execute tools ---

  registerTool(server, config, {
    name: "pve_run_backup",
    description:
      "Run an immediate backup (vzdump) of one or more VMs/containers on a node",
    category: "backup",
    accessTier: "read-execute",
    inputSchema: {
      node: z.string().describe("The node name"),
      vmid: z
        .string()
        .optional()
        .describe("Comma-separated list of VMIDs to back up (omit for all)"),
      storage: z
        .string()
        .optional()
        .describe("Target storage for the backup"),
      mode: z
        .enum(["snapshot", "suspend", "stop"])
        .optional()
        .describe("Backup mode (default: snapshot)"),
      compress: z
        .enum(["0", "gzip", "lzo", "zstd"])
        .optional()
        .describe("Compression algorithm"),
      mailnotification: z
        .enum(["always", "failure"])
        .optional()
        .describe("When to send email notification"),
      mailto: z
        .string()
        .optional()
        .describe("Email address for backup notifications"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.vmid !== undefined) body.vmid = args.vmid;
      if (args.storage !== undefined) body.storage = args.storage;
      if (args.mode !== undefined) body.mode = args.mode;
      if (args.compress !== undefined) body.compress = args.compress;
      if (args.mailnotification !== undefined)
        body.mailnotification = args.mailnotification;
      if (args.mailto !== undefined) body.mailto = args.mailto;
      const data = await client.post(`/nodes/${args.node}/vzdump`, body);
      return `Backup initiated on node ${args.node}. Task: ${data}`;
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_backup_job",
    description: "Create a new scheduled backup job",
    category: "backup",
    accessTier: "full",
    inputSchema: {
      vmid: z
        .string()
        .optional()
        .describe("Comma-separated list of VMIDs to include (omit for all)"),
      storage: z
        .string()
        .optional()
        .describe("Target storage for backups"),
      schedule: z
        .string()
        .optional()
        .describe("Backup schedule in cron-like format or PVE calendar event"),
      mode: z
        .enum(["snapshot", "suspend", "stop"])
        .optional()
        .describe("Backup mode (default: snapshot)"),
      compress: z
        .enum(["0", "gzip", "lzo", "zstd"])
        .optional()
        .describe("Compression algorithm"),
      mailnotification: z
        .enum(["always", "failure"])
        .optional()
        .describe("When to send email notification"),
      mailto: z
        .string()
        .optional()
        .describe("Email address for backup notifications"),
      enabled: z
        .boolean()
        .optional()
        .describe("Enable the backup job (default: true)"),
      node: z
        .string()
        .optional()
        .describe("Restrict to specific node"),
      pool: z
        .string()
        .optional()
        .describe("Backup all VMs in this pool"),
      maxfiles: z
        .number()
        .optional()
        .describe("Maximum number of backup files per VM (0 = unlimited)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.vmid !== undefined) body.vmid = args.vmid;
      if (args.storage !== undefined) body.storage = args.storage;
      if (args.schedule !== undefined) body.schedule = args.schedule;
      if (args.mode !== undefined) body.mode = args.mode;
      if (args.compress !== undefined) body.compress = args.compress;
      if (args.mailnotification !== undefined)
        body.mailnotification = args.mailnotification;
      if (args.mailto !== undefined) body.mailto = args.mailto;
      if (args.enabled !== undefined) body.enabled = args.enabled ? 1 : 0;
      if (args.node !== undefined) body.node = args.node;
      if (args.pool !== undefined) body.pool = args.pool;
      if (args.maxfiles !== undefined) body.maxfiles = args.maxfiles;
      await client.post("/cluster/backup", body);
      return "Backup job created successfully.";
    },
  });

  registerTool(server, config, {
    name: "pve_delete_backup_job",
    description: "Delete a scheduled backup job",
    category: "backup",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      id: z.string().describe("The backup job ID to delete"),
    },
    handler: async (args) => {
      await client.delete(`/cluster/backup/${args.id}`);
      return `Backup job '${args.id}' deleted successfully.`;
    },
  });
}
