/**
 * MCP server factory.
 *
 * Creates the McpServer instance and provides startServer()
 * which selects stdio or HTTP transport based on config.
 */

import { randomUUID } from "node:crypto";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import pkg from "../../package.json" with { type: "json" };
import type { AppConfig } from "../types/index.js";
import { logger } from "./logger.js";

const SERVER_NAME = "mcp-pve";

export function createServer(): McpServer {
  return new McpServer(
    { name: SERVER_NAME, version: pkg.version },
    { capabilities: { tools: {} } },
  );
}

export async function startServer(
  server: McpServer,
  config: AppConfig,
  serverFactory?: () => McpServer,
): Promise<void> {
  if (config.transport === "http") {
    if (!serverFactory) {
      throw new Error("serverFactory is required for HTTP transport");
    }
    await startHttpServer(config, serverFactory);
  } else {
    const transport = new StdioServerTransport();
    logger.info(`${SERVER_NAME} v${pkg.version} listening on stdio`);
    await server.connect(transport);
  }
}

const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4 MB

async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

async function startHttpServer(
  config: AppConfig,
  serverFactory: () => McpServer,
): Promise<void> {
  const { httpHost, httpPort } = config;

  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = createHttpServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      const url = req.url ?? "";

      if (url === "/health" && req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status: "ok",
            server: SERVER_NAME,
            version: pkg.version,
          }),
        );
        return;
      }

      if (url === "/") {
        try {
          if (req.method === "POST") {
            const body = await parseJsonBody(req);
            const sessionId = req.headers["mcp-session-id"] as
              | string
              | undefined;

            const existing = sessionId ? sessions.get(sessionId) : undefined;

            if (existing) {
              await existing.handleRequest(req, res, body);
            } else if (!sessionId && isInitializeRequest(body)) {
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id: string) => {
                  sessions.set(id, transport);
                  logger.debug(`Session initialized: ${id}`);
                },
              });

              transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid) {
                  sessions.delete(sid);
                  logger.debug(`Session closed: ${sid}`);
                }
              };

              const server = serverFactory();
              await server.connect(transport);
              await transport.handleRequest(req, res, body);
            } else {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32000,
                    message: "Bad Request: No valid session ID provided",
                  },
                  id: null,
                }),
              );
            }
          } else if (req.method === "GET" || req.method === "DELETE") {
            const sessionId = req.headers["mcp-session-id"] as
              | string
              | undefined;
            const transport = sessionId ? sessions.get(sessionId) : undefined;
            if (transport) {
              await transport.handleRequest(req, res);
            } else {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: {
                    code: -32000,
                    message: "Bad Request: Invalid or missing session ID",
                  },
                  id: null,
                }),
              );
            }
          } else {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
          }
        } catch (err) {
          logger.error("MCP request handling error:", err);
          if (!res.headersSent) {
            const status = err instanceof SyntaxError ? 400 : 500;
            const message =
              err instanceof SyntaxError
                ? "Invalid JSON"
                : "Internal server error";
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: message }));
          }
        }
        return;
      }

      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    },
  );

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(httpPort, httpHost, () => {
      logger.info(
        `${SERVER_NAME} v${pkg.version} listening on http://${httpHost}:${httpPort}`,
      );
      resolve();
    });
    httpServer.once("error", reject);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    for (const [id, transport] of sessions) {
      logger.debug(`Closing session: ${id}`);
      await transport.close();
    }
    sessions.clear();
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
