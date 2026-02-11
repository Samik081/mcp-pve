/**
 * Shared types for the Proxmox VE MCP server.
 */

/**
 * Access tier controlling which tools are registered at startup.
 *
 * - "read-only": Only read tools (51 tools)
 * - "read-execute": Read + execute tools (68 tools)
 * - "full": All tools including write/delete (105 tools)
 */
export type AccessTier = "read-only" | "read-execute" | "full";

/**
 * Tool categories corresponding to PVE API namespaces.
 */
export type ToolCategory =
  | "nodes"
  | "qemu"
  | "lxc"
  | "storage"
  | "cluster"
  | "access"
  | "pools"
  | "network"
  | "firewall"
  | "backup"
  | "tasks"
  | "ha";

export const VALID_CATEGORIES: ToolCategory[] = [
  "nodes",
  "qemu",
  "lxc",
  "storage",
  "cluster",
  "access",
  "pools",
  "network",
  "firewall",
  "backup",
  "tasks",
  "ha",
];

export interface AppConfig {
  baseUrl: string;
  tokenId: string;
  tokenSecret: string;
  accessTier: AccessTier;
  categories: string[] | null;
  verifySsl: boolean;
  debug: boolean;
}
