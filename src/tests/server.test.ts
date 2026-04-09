import { request as httpRequest } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createServer, startServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { makeConfig, makeMockClient } from "./helpers.js";

function makeServerFactory() {
  const client = makeMockClient();
  const config = makeConfig({
    transport: "http",
    httpPort: 0,
    httpHost: "127.0.0.1",
  });
  return {
    config,
    factory: () => {
      const s = createServer();
      registerAllTools(s, client, config);
      return s;
    },
  };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

function initializeRequest(id = 1): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  };
}

async function sendPost(
  port: number,
  body: unknown,
  sessionId?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "POST",
        headers,
      },
      (res) => {
        let responseBody = "";
        res.on("data", (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        res.on("end", () => {
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") {
              responseHeaders[key] = value;
            }
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: responseHeaders,
            body: responseBody,
          });
        });
      },
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function sendGet(
  port: number,
  sessionId?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
    };
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "GET",
        headers,
      },
      (res) => {
        // For SSE, we just need to confirm it started (200) or got an error
        // Don't wait for end since SSE streams stay open
        const status = res.statusCode ?? 0;
        if (status !== 200) {
          let body = "";
          res.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });
          res.on("end", () => {
            const responseHeaders: Record<string, string> = {};
            for (const [key, value] of Object.entries(res.headers)) {
              if (typeof value === "string") {
                responseHeaders[key] = value;
              }
            }
            resolve({ status, headers: responseHeaders, body });
          });
        } else {
          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (typeof value === "string") {
              responseHeaders[key] = value;
            }
          }
          // Destroy the response to stop the SSE stream
          res.destroy();
          resolve({ status, headers: responseHeaders, body: "" });
        }
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function sendDelete(
  port: number,
  sessionId?: string,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (sessionId) {
      headers["mcp-session-id"] = sessionId;
    }
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/",
        method: "DELETE",
        headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function sendHealthCheck(
  port: number,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/health",
        method: "GET",
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => {
          body += chunk.toString();
        });
        res.on("end", () => {
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function getTestPort(): number {
  return 30000 + Math.floor(Math.random() * 10000);
}

describe("HTTP session management", () => {
  const servers: Array<() => void> = [];

  afterEach(() => {
    for (const cleanup of servers) {
      cleanup();
    }
    servers.length = 0;
  });

  async function startOnPort(port: number): Promise<void> {
    const { config, factory } = makeServerFactory();
    config.httpPort = port;

    const server = factory();

    // Override process.exit to prevent test runner from dying
    const origExit = process.exit;
    process.exit = (() => {}) as never;

    await startServer(server, config, factory);

    process.exit = origExit;

    // We can't easily get the http.Server reference to close it,
    // but the tests are independent and short-lived
  }

  it("initialize request creates a session with mcp-session-id", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendPost(port, initializeRequest());
    expect(res.status).toBe(200);
    expect(res.headers["mcp-session-id"]).toBeDefined();
    expect(res.headers["mcp-session-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("second initialize creates a different session", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res1 = await sendPost(port, initializeRequest(1));
    const res2 = await sendPost(port, initializeRequest(2));

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.headers["mcp-session-id"]).toBeDefined();
    expect(res2.headers["mcp-session-id"]).toBeDefined();
    expect(res1.headers["mcp-session-id"]).not.toBe(
      res2.headers["mcp-session-id"],
    );
  });

  it("POST without session ID and non-initialize method returns 400", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendPost(port, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    expect(res.status).toBe(400);
  });

  it("POST with invalid session ID returns 400", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendPost(
      port,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      },
      "nonexistent-session-id",
    );
    expect(res.status).toBe(400);
  });

  it("GET without session ID returns 400", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendGet(port);
    expect(res.status).toBe(400);
  });

  it("DELETE without session ID returns 400", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendDelete(port);
    expect(res.status).toBe(400);
  });

  it("health check works", async () => {
    const port = getTestPort();
    await startOnPort(port);

    const res = await sendHealthCheck(port);
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.server).toBe("mcp-pve");
  });

  it("existing session accepts subsequent requests", async () => {
    const port = getTestPort();
    await startOnPort(port);

    // Initialize
    const initRes = await sendPost(port, initializeRequest());
    expect(initRes.status).toBe(200);
    const sessionId = initRes.headers["mcp-session-id"];
    expect(sessionId).toBeDefined();

    // Send initialized notification
    await sendPost(
      port,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionId,
    );

    // Use session for tools/list
    const listRes = await sendPost(
      port,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      sessionId,
    );
    expect(listRes.status).toBe(200);
  });

  it("DELETE with valid session ID terminates the session", async () => {
    const port = getTestPort();
    await startOnPort(port);

    // Initialize
    const initRes = await sendPost(port, initializeRequest());
    const sessionId = initRes.headers["mcp-session-id"];

    // Send initialized notification
    await sendPost(
      port,
      { jsonrpc: "2.0", method: "notifications/initialized" },
      sessionId,
    );

    // Delete session
    const deleteRes = await sendDelete(port, sessionId);
    expect(deleteRes.status).toBe(200);

    // Subsequent request with that session should fail
    const afterDelete = await sendPost(
      port,
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      sessionId,
    );
    expect(afterDelete.status).toBe(400);
  });
});
