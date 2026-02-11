/**
 * MCP server factory.
 *
 * Creates the McpServer instance with project identity
 * and provides a startServer() to connect stdio transport.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { logger } from "./logger.js";

/**
 * Create a new MCP server instance.
 */
export function createServer(): McpServer {
  return new McpServer(
    {
      name: "mcp-pve",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
}

/**
 * Start the MCP server on stdio transport.
 */
export async function startServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  logger.info("mcp-pve listening on stdio");
  await server.connect(transport);
}
