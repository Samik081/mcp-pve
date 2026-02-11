/**
 * Storage tools: list, status, content, and CRUD for PVE storage backends.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerStorageTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_storage",
    description: "List all configured storage backends in the cluster",
    category: "storage",
    accessTier: "read-only",
    inputSchema: {
      type: z
        .string()
        .optional()
        .describe("Filter by storage type (e.g. dir, lvm, nfs, zfspool, cephfs)"),
    },
    handler: async (args) => {
      let path = "/storage";
      if (args.type) path += `?type=${args.type}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_storage_config",
    description: "Get the configuration of a specific storage backend",
    category: "storage",
    accessTier: "read-only",
    inputSchema: {
      storage: z.string().describe("The storage ID"),
    },
    handler: async (args) => {
      const data = await client.get(`/storage/${args.storage}`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_storage",
    description: "List available storage on a specific node with usage information",
    category: "storage",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      content: z
        .string()
        .optional()
        .describe("Filter by content type (e.g. images, rootdir, iso, vztmpl, backup)"),
    },
    handler: async (args) => {
      let path = `/nodes/${args.node}/storage`;
      if (args.content) path += `?content=${args.content}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_storage_status",
    description: "Get the status and usage of a specific storage on a node",
    category: "storage",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      storage: z.string().describe("The storage ID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/storage/${args.storage}/status`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_storage_content",
    description:
      "List the content (disk images, ISOs, templates, backups) of a specific storage on a node",
    category: "storage",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      storage: z.string().describe("The storage ID"),
      content: z
        .string()
        .optional()
        .describe("Filter by content type (e.g. images, iso, vztmpl, backup, rootdir)"),
    },
    handler: async (args) => {
      let path = `/nodes/${args.node}/storage/${args.storage}/content`;
      if (args.content) path += `?content=${args.content}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_storage",
    description: "Create a new storage backend in the cluster",
    category: "storage",
    accessTier: "full",
    inputSchema: {
      storage: z.string().describe("The storage ID"),
      type: z
        .string()
        .describe("Storage type (e.g. dir, lvm, nfs, zfspool, cifs, cephfs, rbd)"),
      content: z
        .string()
        .optional()
        .describe("Allowed content types, comma-separated (e.g. images,rootdir,iso)"),
      path: z
        .string()
        .optional()
        .describe("Filesystem path (for dir, nfs types)"),
      server: z
        .string()
        .optional()
        .describe("Server address (for nfs, cifs, cephfs types)"),
      export: z
        .string()
        .optional()
        .describe("NFS export path"),
      vgname: z
        .string()
        .optional()
        .describe("LVM volume group name"),
      pool: z
        .string()
        .optional()
        .describe("ZFS/Ceph pool name"),
      nodes: z
        .string()
        .optional()
        .describe("Comma-separated list of nodes where storage is available"),
      shared: z
        .boolean()
        .optional()
        .describe("Whether the storage is shared across nodes"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        storage: args.storage,
        type: args.type,
      };
      if (args.content !== undefined) body.content = args.content;
      if (args.path !== undefined) body.path = args.path;
      if (args.server !== undefined) body.server = args.server;
      if (args.export !== undefined) body.export = args.export;
      if (args.vgname !== undefined) body.vgname = args.vgname;
      if (args.pool !== undefined) body.pool = args.pool;
      if (args.nodes !== undefined) body.nodes = args.nodes;
      if (args.shared !== undefined) body.shared = args.shared ? 1 : 0;
      await client.post("/storage", body);
      return `Storage '${args.storage}' (type: ${args.type}) created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_storage",
    description: "Update the configuration of an existing storage backend",
    category: "storage",
    accessTier: "full",
    inputSchema: {
      storage: z.string().describe("The storage ID"),
      content: z
        .string()
        .optional()
        .describe("Allowed content types, comma-separated"),
      nodes: z
        .string()
        .optional()
        .describe("Comma-separated list of nodes where storage is available"),
      shared: z
        .boolean()
        .optional()
        .describe("Whether the storage is shared across nodes"),
      disable: z
        .boolean()
        .optional()
        .describe("Disable the storage"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.content !== undefined) body.content = args.content;
      if (args.nodes !== undefined) body.nodes = args.nodes;
      if (args.shared !== undefined) body.shared = args.shared ? 1 : 0;
      if (args.disable !== undefined) body.disable = args.disable ? 1 : 0;
      await client.put(`/storage/${args.storage}`, body);
      return `Storage '${args.storage}' updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_storage",
    description: "Delete a storage backend configuration from the cluster",
    category: "storage",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      storage: z.string().describe("The storage ID to delete"),
    },
    handler: async (args) => {
      await client.delete(`/storage/${args.storage}`);
      return `Storage '${args.storage}' deleted successfully.`;
    },
  });
}
