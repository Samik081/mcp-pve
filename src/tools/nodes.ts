/**
 * Node tools: status, info, services, and management for PVE cluster nodes.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PveClient } from "../core/client.js";
import { getRrdData, rrdDescription, rrdInputSchema } from "../core/rrd.js";
import { registerTool } from "../core/tools.js";
import type { AppConfig } from "../types/index.js";

/** Appends the defined params as a query string; booleans become 1/0. */
function withQuery(path: string, params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(
      key,
      typeof value === "boolean" ? (value ? "1" : "0") : String(value),
    );
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Journal responses mix entries with cursor and host marker elements. */
function isJournalEntry(element: unknown): boolean {
  if (typeof element === "string") return !/^s=[0-9a-f]+;i=/.test(element);
  return !(element as { ty?: unknown } | null)?.ty;
}

/** Keeps the version fields of PVE package objects, dropping descriptions. */
function slimPackages(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  return data.map((pkg) => {
    const slim: Record<string, unknown> = {};
    for (const key of [
      "Package",
      "OldVersion",
      "Version",
      "RunningKernel",
      "ManagerVersion",
    ]) {
      if (pkg?.[key] !== undefined) slim[key] = pkg[key];
    }
    if (pkg?.CurrentState && pkg.CurrentState !== "Installed")
      slim.CurrentState = pkg.CurrentState;
    return slim;
  });
}

export function registerNodeTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_nodes",
    title: "List Nodes",
    description: "List all nodes in the Proxmox VE cluster",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    handler: async () => {
      const data = await client.get("/nodes");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_status",
    title: "Get Node Status",
    description:
      "Get detailed status of a specific node including CPU, memory, uptime, and load",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/status`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_rrddata",
    title: "Get Node RRD Data",
    description: rrdDescription(
      "a node itself (host-level, not per guest)",
      "CPU, IO wait, load average, memory, swap, root filesystem, network, pressure",
    ),
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      ...rrdInputSchema,
    },
    handler: async (args) => getRrdData(client, `/nodes/${args.node}`, args),
  });

  registerTool(server, config, {
    name: "pve_get_node_version",
    title: "Get Node Version",
    description: "Get the PVE version information for a specific node",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/version`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_dns",
    title: "Get Node DNS",
    description: "Get DNS settings for a specific node",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/dns`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_time",
    title: "Get Node Time",
    description: "Get time and timezone information for a specific node",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/time`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_syslog",
    title: "Get Node Syslog",
    description: "Get system log entries from a specific node",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      start: z.number().optional().describe("Start line number (default: 0)"),
      limit: z
        .number()
        .optional()
        .describe("Max number of log entries to return (default: 50)"),
    },
    handler: async (args) => {
      let path = `/nodes/${args.node}/syslog`;
      const params = new URLSearchParams();
      if (args.start !== undefined) params.set("start", String(args.start));
      if (args.limit !== undefined) params.set("limit", String(args.limit));
      const qs = params.toString();
      if (qs) path += `?${qs}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_services",
    title: "List Node Services",
    description: "List all system services and their status on a specific node",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/services`);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_journal",
    title: "Get Node Journal",
    description:
      "Read a node's systemd journal (last 50 entries by default). The priority, service, unit, kernel and structured filters need a recent PVE 9.x",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      since: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Entries since this UNIX epoch (not with startcursor)"),
      until: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Entries until this UNIX epoch (not with endcursor)"),
      lastentries: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe(
          "Last N entries (not with since/until/cursors; default 50 when none are given)",
        ),
      startcursor: z
        .string()
        .optional()
        .describe("Start after this journal cursor (not with since)"),
      endcursor: z
        .string()
        .optional()
        .describe("End before this journal cursor (not with until)"),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          "Max entries returned for since/until/cursor queries, newest kept (default 200)",
        ),
      // Checked with refine() rather than regex()/max(): the patterns and
      // maxLength would end up in the published JSON schema, and some MCP
      // clients then drop the whole schema for this tool.
      priority: z
        .string()
        .refine((v) => /^[0-7](\.\.[0-7])?$/.test(v), {
          message: "Expected a level 0-7 or a 'LOW..HIGH' range",
        })
        .optional()
        .describe(
          "Syslog priority as a string: a level '0' (emerg) to '7' (debug) selecting it and everything more severe, or a 'LOW..HIGH' range (e.g. '3' for errors and worse)",
        ),
      service: z
        .string()
        .refine(
          (v) => v.length <= 128 && /^[A-Za-z0-9_.@:*?![\]/-]+$/.test(v),
          {
            message:
              "Expected a syslog identifier glob of at most 128 characters",
          },
        )
        .optional()
        .describe("Syslog identifier glob, e.g. 'pve*' or 'postfix/*'"),
      unit: z
        .string()
        .refine((v) => v.length <= 256 && /^[A-Za-z0-9_.@:-]+$/.test(v), {
          message: "Expected a systemd unit name of at most 256 characters",
        })
        .optional()
        .describe("Systemd unit (the .service suffix is implied)"),
      kernel: z.boolean().optional().describe("Only kernel messages"),
      structured: z
        .boolean()
        .optional()
        .describe(
          "Return one JSON object per entry (timestamp, identifier, message, priority, ...) instead of text lines",
        ),
    },
    handler: async (args) => {
      const hasRange =
        args.since !== undefined ||
        args.until !== undefined ||
        args.startcursor !== undefined ||
        args.endcursor !== undefined;
      // PVE answers these combinations with an empty body, not an error.
      if (args.lastentries !== undefined && hasRange)
        throw new Error(
          "lastentries cannot be combined with since, until, startcursor or endcursor",
        );
      if (args.since !== undefined && args.startcursor !== undefined)
        throw new Error("since cannot be combined with startcursor");
      if (args.until !== undefined && args.endcursor !== undefined)
        throw new Error("until cannot be combined with endcursor");

      const data = await client.get(
        withQuery(`/nodes/${args.node}/journal`, {
          since: args.since,
          until: args.until,
          lastentries: args.lastentries ?? (hasRange ? undefined : 50),
          startcursor: args.startcursor,
          endcursor: args.endcursor,
          priority: args.priority,
          service: args.service,
          unit: args.unit,
          kernel: args.kernel,
          structured: args.structured,
        }),
      );

      // PVE has no entry limit for range queries, so cap them here. The
      // response ends with the end cursor, which is kept.
      const limit = (args.limit as number | undefined) ?? 200;
      if (hasRange && Array.isArray(data)) {
        const total = data.filter(isJournalEntry).length;
        if (total > limit)
          return `Truncated to the newest ${limit} of ${total} entries; narrow the range or raise limit\n${JSON.stringify(data.slice(-(limit + 1)))}`;
      }
      return JSON.stringify(data);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_disks",
    title: "List Node Disks",
    description:
      "List a node's local disks with model, serial, size, usage, wearout and SMART health",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      "include-partitions": z
        .boolean()
        .optional()
        .describe("Also include partitions"),
      skipsmart: z.boolean().optional().describe("Skip SMART health checks"),
      type: z
        .enum(["unused", "journal_disks"])
        .optional()
        .describe("Only list disks of this type"),
    },
    handler: async (args) => {
      const data = await client.get(
        withQuery(`/nodes/${args.node}/disks/list`, {
          "include-partitions": args["include-partitions"],
          skipsmart: args.skipsmart,
          type: args.type,
        }),
      );
      return JSON.stringify(data);
    },
  });

  registerTool(server, config, {
    name: "pve_get_node_disk_smart",
    title: "Get Node Disk SMART",
    description: "Get SMART health and attributes of a node's disk",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      disk: z
        .string()
        .regex(
          /^\/dev\/[a-zA-Z0-9/]+$/,
          "Expected a device path like /dev/sda (the devpath from pve_list_node_disks, not a by-id link)",
        )
        .describe(
          "Device path: devpath from pve_list_node_disks (e.g. /dev/sda), not a by-id link",
        ),
      healthonly: z
        .boolean()
        .optional()
        .describe("Return only the health status"),
    },
    handler: async (args) => {
      const data = await client.get(
        withQuery(`/nodes/${args.node}/disks/smart`, {
          disk: args.disk,
          healthonly: args.healthonly,
        }),
      );
      return JSON.stringify(data);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_lvm",
    title: "List Node LVM",
    description: "List a node's LVM volume groups and their physical volumes",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/disks/lvm`);
      return JSON.stringify(data);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_lvmthin",
    title: "List Node LVM Thin Pools",
    description: "List a node's LVM thin pools with data and metadata usage",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/disks/lvmthin`);
      return JSON.stringify(data);
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_package_versions",
    title: "List Node Package Versions",
    description:
      "List a node's Proxmox VE related packages (like pveversion -v): OldVersion is installed, Version is the candidate",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/apt/versions`);
      return JSON.stringify(slimPackages(data));
    },
  });

  registerTool(server, config, {
    name: "pve_list_node_apt_updates",
    title: "List Node APT Updates",
    description:
      "List a node's available package updates, as of the last package database refresh. Requires Sys.Modify on /nodes/{node}",
    category: "nodes",
    accessTier: "read-only",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
    },
    handler: async (args) => {
      const data = await client.get(`/nodes/${args.node}/apt/update`);
      return JSON.stringify(slimPackages(data));
    },
  });

  // --- Read-execute tools ---

  registerTool(server, config, {
    name: "pve_manage_node_service",
    title: "Manage Node Service",
    description:
      "Start, stop, restart, or reload a system service on a specific node",
    category: "nodes",
    accessTier: "read-execute",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    },
    inputSchema: {
      node: z.string().describe("The node name"),
      service: z
        .string()
        .describe("The service name (e.g. pveproxy, pvedaemon)"),
      command: z
        .enum(["start", "stop", "restart", "reload"])
        .describe("The action to perform on the service"),
    },
    handler: async (args) => {
      const data = await client.post(
        `/nodes/${args.node}/services/${args.service}/${args.command}`,
      );
      return `Service ${args.service} ${args.command} initiated on node ${args.node}. Task: ${data}`;
    },
  });
}
