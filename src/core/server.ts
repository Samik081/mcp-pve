/**
 * MCP server factory.
 *
 * Creates the McpServer instance and provides startServer()
 * which selects stdio or HTTP transport based on config.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createServer as createHttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import type { AppConfig } from "../types/index.js";
import { logger } from "./logger.js";
import pkg from "../../package.json" with { type: "json" };

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
): Promise<void> {
  if (config.transport === "http") {
    await startHttpServer(server, config);
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
  server: McpServer,
  config: AppConfig,
): Promise<void> {
  const { httpHost, httpPort } = config;

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  await server.connect(transport);

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

      if (url === "/mcp") {
        try {
          if (req.method === "POST") {
            const body = await parseJsonBody(req);
            await transport.handleRequest(req, res, body);
          } else {
            await transport.handleRequest(req, res);
          }
        } catch (err) {
          logger.error("MCP request handling error:", err);
          if (!res.headersSent) {
            const status = err instanceof SyntaxError ? 400 : 500;
            const message =
              err instanceof SyntaxError ? "Invalid JSON" : "Internal server error";
            res.writeHead(status, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: message }));
          }
        }
        return;
      }

      res.writeHead(404);
      res.end("Not found");
    },
  );

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(httpPort, httpHost, () => {
      logger.info(
        `${SERVER_NAME} v${pkg.version} listening on http://${httpHost}:${httpPort}/mcp`,
      );
      resolve();
    });
    httpServer.once("error", reject);
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Received ${signal}, shutting down...`);
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await transport.close();
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
