/**
 * MCP server factory.
 *
 * Creates the McpServer instance and provides startServer()
 * which selects stdio or HTTP transport based on config.
 */

import { randomUUID } from "node:crypto";
import {
  createServer as createHttpServer,
  type Server as HttpServer,
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

/**
 * Returns the underlying http.Server for HTTP transport (so callers such as
 * tests can inspect the bound port and close it), undefined for stdio.
 */
export async function startServer(
  server: McpServer,
  config: AppConfig,
  serverFactory?: () => McpServer,
): Promise<HttpServer | undefined> {
  if (config.transport === "http") {
    if (!serverFactory) {
      throw new Error("serverFactory is required for HTTP transport");
    }
    return startHttpServer(config, serverFactory);
  }
  const transport = new StdioServerTransport();
  logger.info(`${SERVER_NAME} v${pkg.version} listening on stdio`);
  await server.connect(transport);
  return undefined;
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

interface Session {
  transport: StreamableHTTPServerTransport;
  /** Timestamp of the last request routed to this session. */
  lastActivity: number;
  /** Number of currently connected standalone GET SSE streams (0 or 1). */
  openStreams: number;
}

/** Upper bound on how often the idle-session reaper runs. */
const MAX_REAP_INTERVAL_MS = 60_000;

function sessionNotFound(res: ServerResponse): void {
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Session not found" },
      id: null,
    }),
  );
}

function badRequest(res: ServerResponse, message: string): void {
  res.writeHead(400, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: `Bad Request: ${message}` },
      id: null,
    }),
  );
}

async function startHttpServer(
  config: AppConfig,
  serverFactory: () => McpServer,
): Promise<HttpServer> {
  const { httpHost, httpPort, sessionIdleTimeoutMs } = config;

  // Sessions are only removed by the SDK when a client sends DELETE. Clients
  // that simply disconnect (proxies, gateway restarts, crashes) would otherwise
  // leave their McpServer + transport (~3 MB with all tools) retained forever,
  // so idle sessions are reaped after sessionIdleTimeoutMs.
  const sessions = new Map<string, Session>();

  const closeSession = async (id: string, reason: string): Promise<void> => {
    const session = sessions.get(id);
    if (!session) return;
    sessions.delete(id);
    logger.info(
      `Closing session ${id} (${reason}); ${sessions.size} session(s) remain`,
    );
    try {
      await session.transport.close();
    } catch (err) {
      logger.warn(`Error closing session ${id}:`, err);
    }
  };

  const reapIdleSessions = async (): Promise<void> => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.openStreams > 0) continue; // client is still connected
      const idleMs = now - session.lastActivity;
      if (idleMs >= sessionIdleTimeoutMs) {
        await closeSession(id, `idle for ${Math.round(idleMs / 1000)}s`);
      }
    }
  };

  const reaper =
    sessionIdleTimeoutMs > 0
      ? setInterval(
          () => void reapIdleSessions(),
          Math.min(sessionIdleTimeoutMs, MAX_REAP_INTERVAL_MS),
        ).unref()
      : undefined;

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
              existing.lastActivity = Date.now();
              await existing.transport.handleRequest(req, res, body);
            } else if (sessionId) {
              sessionNotFound(res);
            } else if (isInitializeRequest(body)) {
              const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id: string) => {
                  sessions.set(id, {
                    transport,
                    lastActivity: Date.now(),
                    openStreams: 0,
                  });
                  logger.debug(
                    `Session initialized: ${id}; ${sessions.size} session(s) active`,
                  );
                },
              });

              // Fires on client DELETE, reaping, and shutdown.
              transport.onclose = () => {
                const sid = transport.sessionId;
                if (sid && sessions.delete(sid)) {
                  logger.debug(`Session closed: ${sid}`);
                }
              };

              const server = serverFactory();
              await server.connect(transport);
              await transport.handleRequest(req, res, body);
            } else {
              badRequest(res, "No valid session ID provided");
            }
          } else if (req.method === "GET" || req.method === "DELETE") {
            const sessionId = req.headers["mcp-session-id"] as
              | string
              | undefined;
            if (!sessionId) {
              badRequest(res, "Mcp-Session-Id header is required");
              return;
            }
            const session = sessions.get(sessionId);
            if (!session) {
              sessionNotFound(res);
              return;
            }
            session.lastActivity = Date.now();
            if (req.method === "GET") {
              // A connected SSE stream proves the client is alive, so the
              // session is exempt from reaping until the stream closes.
              session.openStreams++;
              res.once("close", () => {
                session.openStreams--;
                session.lastActivity = Date.now();
              });
            }
            await session.transport.handleRequest(req, res);
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
      const address = httpServer.address();
      const boundPort =
        typeof address === "object" && address !== null
          ? address.port
          : httpPort;
      logger.info(
        `${SERVER_NAME} v${pkg.version} listening on http://${httpHost}:${boundPort}`,
      );
      resolve();
    });
    httpServer.once("error", reject);
  });

  httpServer.once("close", () => {
    if (reaper) clearInterval(reaper);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    for (const id of [...sessions.keys()]) {
      await closeSession(id, signal);
    }
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));

  return httpServer;
}
