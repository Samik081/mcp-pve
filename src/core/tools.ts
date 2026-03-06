/**
 * Tool registration helper. Wraps MCP server.registerTool() with
 * 3-tier access checking, category filtering, blacklist/whitelist support,
 * and error handling.
 *
 * Hybrid pattern: Komodo's 3-tier numeric gating + AdGuard's
 * Promise<string> handler with automatic error wrapping.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { ZodRawShape } from "zod";
import type { AccessTier, AppConfig, ToolCategory } from "../types/index.js";
import { sanitizeMessage } from "./errors.js";
import { logger } from "./logger.js";

const TIER_LEVELS: Record<AccessTier, number> = {
  "read-only": 0,
  "read-execute": 1,
  full: 2,
};

export interface ToolRegistrationOptions {
  name: string;
  title: string;
  description: string;
  accessTier: AccessTier;
  category: ToolCategory;
  annotations?: ToolAnnotations;
  inputSchema?: ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

/** Tracks all tool names seen during registration for post-registration validation. */
const seenToolNames = new Set<string>();

/**
 * Register a tool with the MCP server, respecting blacklist/whitelist,
 * access tier, and category filters.
 *
 * Filter precedence:
 * 1. Blacklist always wins (even over whitelist — logs warning if both)
 * 2. Whitelist bypasses access tier and category filters
 * 3. Access tier gate
 * 4. Category gate
 *
 * Handlers return Promise<string>. The wrapper wraps the result into MCP
 * response format and catches errors with sanitization.
 *
 * Returns true if the tool was registered, false if filtered out.
 */
export function registerTool(
  server: McpServer,
  config: AppConfig,
  options: ToolRegistrationOptions,
): boolean {
  seenToolNames.add(options.name);

  const isBlacklisted = config.toolBlacklist?.includes(options.name);
  const isWhitelisted = config.toolWhitelist?.includes(options.name);

  // Blacklist always wins
  if (isBlacklisted) {
    if (isWhitelisted) {
      logger.warn(
        `Tool "${options.name}" is both blacklisted and whitelisted — blacklist takes precedence, skipping`,
      );
    } else {
      logger.debug(`Skipping tool "${options.name}" (blacklisted)`);
    }
    return false;
  }

  // Whitelist bypasses tier and category filters
  if (!isWhitelisted) {
    if (TIER_LEVELS[config.accessTier] < TIER_LEVELS[options.accessTier]) {
      logger.debug(
        `Skipping tool "${options.name}" (requires ${options.accessTier}, running in ${config.accessTier} mode)`,
      );
      return false;
    }

    if (
      config.categories !== null &&
      !config.categories.includes(options.category)
    ) {
      logger.debug(
        `Skipping tool "${options.name}" (category "${options.category}" not in allowed categories)`,
      );
      return false;
    }
  }

  const annotations: ToolAnnotations = {
    readOnlyHint: options.accessTier === "read-only",
    destructiveHint: false,
    ...options.annotations,
  };

  const toolConfig: {
    title?: string;
    description: string;
    inputSchema?: ZodRawShape;
    annotations: ToolAnnotations;
  } = {
    ...(!config.excludeToolTitles && { title: options.title }),
    description: options.description,
    annotations,
  };

  if (options.inputSchema) {
    toolConfig.inputSchema = options.inputSchema;
  }

  server.registerTool(
    options.name,
    toolConfig,
    async (args: Record<string, unknown>) => {
      try {
        const result = await options.handler(args);
        return {
          content: [{ type: "text" as const, text: result }],
        };
      } catch (err) {
        const message =
          err instanceof Error
            ? sanitizeMessage(err.message)
            : "An unknown error occurred";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );

  if (isWhitelisted) {
    logger.debug(
      `Registered tool: ${options.name} [${options.category}] (whitelisted)`,
    );
  } else {
    logger.debug(`Registered tool: ${options.name} [${options.category}]`);
  }
  return true;
}

/**
 * Validate that all tool names in blacklist/whitelist actually exist.
 * Call after registerAllTools() to warn about typos or stale entries.
 */
export function validateToolLists(config: AppConfig): void {
  for (const name of config.toolBlacklist ?? []) {
    if (!seenToolNames.has(name)) {
      logger.warn(`Blacklisted tool "${name}" does not match any known tool`);
    }
  }
  for (const name of config.toolWhitelist ?? []) {
    if (!seenToolNames.has(name)) {
      logger.warn(`Whitelisted tool "${name}" does not match any known tool`);
    }
  }
}
