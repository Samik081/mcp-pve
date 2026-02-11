/**
 * Tool registration helper. Wraps MCP server.registerTool() with
 * 3-tier access checking, category filtering, and error handling.
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
  "full": 2,
};

export interface ToolRegistrationOptions {
  name: string;
  description: string;
  accessTier: AccessTier;
  category: ToolCategory;
  annotations?: ToolAnnotations;
  inputSchema?: ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Register a tool with the MCP server, respecting access tier and category filters.
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

  const annotations: ToolAnnotations = {
    readOnlyHint: options.accessTier === "read-only",
    destructiveHint: false,
    ...options.annotations,
  };

  const toolConfig: {
    description: string;
    inputSchema?: ZodRawShape;
    annotations: ToolAnnotations;
  } = {
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

  logger.debug(`Registered tool: ${options.name} [${options.category}]`);
  return true;
}
