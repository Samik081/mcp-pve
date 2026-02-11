/**
 * Task tools: list, status, log, and management of PVE background tasks.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerTaskTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_tasks",
    description:
      "List recent tasks on a node with optional filters for status, source, and VMID",
    category: "tasks",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      start: z
        .number()
        .optional()
        .describe("Start index (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max number of tasks to return (default: 50)"),
      vmid: z
        .number()
        .optional()
        .describe("Filter by VMID"),
      typefilter: z
        .string()
        .optional()
        .describe("Filter by task type (e.g. qmstart, vzdump)"),
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.start !== undefined) params.set("start", String(args.start));
      if (args.limit !== undefined) params.set("limit", String(args.limit));
      if (args.vmid !== undefined) params.set("vmid", String(args.vmid));
      if (args.typefilter !== undefined) params.set("typefilter", String(args.typefilter));
      const qs = params.toString();
      const path = `/nodes/${args.node}/tasks${qs ? `?${qs}` : ""}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_task_status",
    description: "Get the status of a specific task by its UPID",
    category: "tasks",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      upid: z.string().describe("The task UPID"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/nodes/${args.node}/tasks/${encodeURIComponent(String(args.upid))}/status`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_task_log",
    description: "Get the log output of a specific task by its UPID",
    category: "tasks",
    accessTier: "read-only",
    inputSchema: {
      node: z.string().describe("The node name"),
      upid: z.string().describe("The task UPID"),
      start: z
        .number()
        .optional()
        .describe("Start line number (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max number of log lines to return (default: 50)"),
    },
    handler: async (args) => {
      const params = new URLSearchParams();
      if (args.start !== undefined) params.set("start", String(args.start));
      if (args.limit !== undefined) params.set("limit", String(args.limit));
      const qs = params.toString();
      const path = `/nodes/${args.node}/tasks/${encodeURIComponent(String(args.upid))}/log${qs ? `?${qs}` : ""}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Read-execute tools ---

  registerTool(server, config, {
    name: "pve_stop_task",
    description: "Stop a running task by its UPID",
    category: "tasks",
    accessTier: "read-execute",
    inputSchema: {
      node: z.string().describe("The node name"),
      upid: z.string().describe("The task UPID to stop"),
    },
    handler: async (args) => {
      await client.delete(
        `/nodes/${args.node}/tasks/${encodeURIComponent(String(args.upid))}`,
      );
      return `Task ${args.upid} stop requested on node ${args.node}.`;
    },
  });
}
