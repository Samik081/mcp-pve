import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PveClient } from "../core/client.js";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { connectTestClient, makeConfig, makeMockClient } from "./helpers.js";

describe("handler: pve_list_nodes", () => {
  let cleanup: () => Promise<void>;
  let mcpClient: Client;
  let mockClient: PveClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const conn = await connectTestClient(server);
    mcpClient = conn.client;
    cleanup = conn.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("returns node list as JSON text", async () => {
    const fakeNodes = [{ node: "pve1", status: "online" }];
    vi.mocked(mockClient.get).mockResolvedValueOnce(fakeNodes);

    const result = await mcpClient.callTool({
      name: "pve_list_nodes",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(JSON.parse(text)).toEqual(fakeNodes);
  });

  it("returns isError when client throws", async () => {
    vi.mocked(mockClient.get).mockRejectedValueOnce(
      new Error("connection refused"),
    );

    const result = await mcpClient.callTool({
      name: "pve_list_nodes",
      arguments: {},
    });

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("connection refused");
  });
});

describe("handler: pve_get_node_status", () => {
  let cleanup: () => Promise<void>;
  let mcpClient: Client;
  let mockClient: PveClient;

  beforeEach(async () => {
    mockClient = makeMockClient();
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const conn = await connectTestClient(server);
    mcpClient = conn.client;
    cleanup = conn.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it("calls client.get with correct path", async () => {
    const fakeStatus = { cpu: 0.05, memory: { used: 1024 } };
    vi.mocked(mockClient.get).mockResolvedValueOnce(fakeStatus);

    const result = await mcpClient.callTool({
      name: "pve_get_node_status",
      arguments: { node: "pve1" },
    });

    expect(mockClient.get).toHaveBeenCalledWith("/nodes/pve1/status");
    expect(result.isError).toBeFalsy();
  });

  it("rejects missing required node argument", async () => {
    const result = await mcpClient.callTool({
      name: "pve_get_node_status",
      arguments: {},
    });

    expect(result.isError).toBe(true);
  });
});

describe("handler: pve_manage_node_service (read-execute)", () => {
  it("is not registered in read-only mode", async () => {
    const server = createServer();
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ accessTier: "read-only" }),
    );
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain("pve_manage_node_service");
    await cleanup();
  });

  it("calls client.post with correct path", async () => {
    const mockClient = makeMockClient();
    vi.mocked(mockClient.post).mockResolvedValueOnce("UPID:pve1:task123");
    const server = createServer();
    registerAllTools(server, mockClient, makeConfig());
    const { client, cleanup } = await connectTestClient(server);

    const result = await client.callTool({
      name: "pve_manage_node_service",
      arguments: { node: "pve1", service: "pveproxy", command: "restart" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/nodes/pve1/services/pveproxy/restart",
    );
    await cleanup();
  });
});
