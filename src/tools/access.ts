/**
 * Access tools: users, roles, groups, ACLs, and authentication domains.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PveClient } from "../core/client.js";
import type { AppConfig } from "../types/index.js";
import { registerTool } from "../core/tools.js";

export function registerAccessTools(
  server: McpServer,
  client: PveClient,
  config: AppConfig,
): void {
  // --- Read-only tools ---

  registerTool(server, config, {
    name: "pve_list_users",
    description: "List all users in the PVE access control system",
    category: "access",
    accessTier: "read-only",
    inputSchema: {
      enabled: z
        .boolean()
        .optional()
        .describe("Filter by enabled status"),
    },
    handler: async (args) => {
      let path = "/access/users";
      if (args.enabled !== undefined) path += `?enabled=${args.enabled ? 1 : 0}`;
      const data = await client.get(path);
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_get_user",
    description: "Get detailed information about a specific user",
    category: "access",
    accessTier: "read-only",
    inputSchema: {
      userid: z.string().describe("The user ID (e.g. root@pam, user@pve)"),
    },
    handler: async (args) => {
      const data = await client.get(
        `/access/users/${encodeURIComponent(String(args.userid))}`,
      );
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_roles",
    description: "List all available roles and their privileges",
    category: "access",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/access/roles");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_groups",
    description: "List all user groups",
    category: "access",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/access/groups");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_acls",
    description: "List all access control list entries",
    category: "access",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/access/acl");
      return JSON.stringify(data, null, 2);
    },
  });

  registerTool(server, config, {
    name: "pve_list_domains",
    description:
      "List all authentication domains/realms (e.g. pam, pve, ldap, ad)",
    category: "access",
    accessTier: "read-only",
    handler: async () => {
      const data = await client.get("/access/domains");
      return JSON.stringify(data, null, 2);
    },
  });

  // --- Full access tools ---

  registerTool(server, config, {
    name: "pve_create_user",
    description: "Create a new user in the PVE access control system",
    category: "access",
    accessTier: "full",
    inputSchema: {
      userid: z
        .string()
        .describe("The user ID in format user@realm (e.g. john@pve)"),
      password: z.string().optional().describe("User password"),
      email: z.string().optional().describe("User email address"),
      firstname: z.string().optional().describe("First name"),
      lastname: z.string().optional().describe("Last name"),
      groups: z
        .string()
        .optional()
        .describe("Comma-separated list of groups"),
      comment: z.string().optional().describe("User comment"),
      enable: z
        .boolean()
        .optional()
        .describe("Enable the user (default: true)"),
      expire: z
        .number()
        .optional()
        .describe("Account expiration date (Unix epoch, 0 = never)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = { userid: args.userid };
      if (args.password !== undefined) body.password = args.password;
      if (args.email !== undefined) body.email = args.email;
      if (args.firstname !== undefined) body.firstname = args.firstname;
      if (args.lastname !== undefined) body.lastname = args.lastname;
      if (args.groups !== undefined) body.groups = args.groups;
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.enable !== undefined) body.enable = args.enable ? 1 : 0;
      if (args.expire !== undefined) body.expire = args.expire;
      await client.post("/access/users", body);
      return `User '${args.userid}' created successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_user",
    description: "Update an existing user's properties",
    category: "access",
    accessTier: "full",
    inputSchema: {
      userid: z.string().describe("The user ID (e.g. john@pve)"),
      email: z.string().optional().describe("User email address"),
      firstname: z.string().optional().describe("First name"),
      lastname: z.string().optional().describe("Last name"),
      groups: z
        .string()
        .optional()
        .describe("Comma-separated list of groups"),
      comment: z.string().optional().describe("User comment"),
      enable: z
        .boolean()
        .optional()
        .describe("Enable or disable the user"),
      expire: z
        .number()
        .optional()
        .describe("Account expiration date (Unix epoch, 0 = never)"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {};
      if (args.email !== undefined) body.email = args.email;
      if (args.firstname !== undefined) body.firstname = args.firstname;
      if (args.lastname !== undefined) body.lastname = args.lastname;
      if (args.groups !== undefined) body.groups = args.groups;
      if (args.comment !== undefined) body.comment = args.comment;
      if (args.enable !== undefined) body.enable = args.enable ? 1 : 0;
      if (args.expire !== undefined) body.expire = args.expire;
      await client.put(
        `/access/users/${encodeURIComponent(String(args.userid))}`,
        body,
      );
      return `User '${args.userid}' updated successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_delete_user",
    description: "Delete a user from the PVE access control system",
    category: "access",
    accessTier: "full",
    annotations: { destructiveHint: true },
    inputSchema: {
      userid: z.string().describe("The user ID to delete (e.g. john@pve)"),
    },
    handler: async (args) => {
      await client.delete(
        `/access/users/${encodeURIComponent(String(args.userid))}`,
      );
      return `User '${args.userid}' deleted successfully.`;
    },
  });

  registerTool(server, config, {
    name: "pve_update_acl",
    description:
      "Update access control list — grant or revoke roles for users/groups on specific paths",
    category: "access",
    accessTier: "full",
    inputSchema: {
      path: z
        .string()
        .describe("ACL path (e.g. /, /vms/100, /storage/local)"),
      roles: z
        .string()
        .describe("Comma-separated list of roles to assign"),
      users: z
        .string()
        .optional()
        .describe("Comma-separated list of user IDs"),
      groups: z
        .string()
        .optional()
        .describe("Comma-separated list of group IDs"),
      propagate: z
        .boolean()
        .optional()
        .describe("Propagate ACL to child objects (default: true)"),
      delete: z
        .boolean()
        .optional()
        .describe("Remove the ACL entry instead of adding"),
    },
    handler: async (args) => {
      const body: Record<string, unknown> = {
        path: args.path,
        roles: args.roles,
      };
      if (args.users !== undefined) body.users = args.users;
      if (args.groups !== undefined) body.groups = args.groups;
      if (args.propagate !== undefined) body.propagate = args.propagate ? 1 : 0;
      if (args.delete !== undefined) body.delete = args.delete ? 1 : 0;
      await client.put("/access/acl", body);
      return `ACL updated successfully for path '${args.path}'.`;
    },
  });
}
