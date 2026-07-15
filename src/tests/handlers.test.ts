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

describe("handler: pve_list_ha_rules", () => {
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

  it("calls client.get with /cluster/ha/rules and no query by default", async () => {
    const fakeRules = [{ rule: "keep-apart", type: "resource-affinity" }];
    vi.mocked(mockClient.get).mockResolvedValueOnce(fakeRules);

    const result = await mcpClient.callTool({
      name: "pve_list_ha_rules",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.get).toHaveBeenCalledWith("/cluster/ha/rules");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(JSON.parse(text)).toEqual(fakeRules);
  });

  it("passes type and resource filters as query params", async () => {
    vi.mocked(mockClient.get).mockResolvedValueOnce([]);

    await mcpClient.callTool({
      name: "pve_list_ha_rules",
      arguments: { type: "node-affinity", resource: "vm:100" },
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      "/cluster/ha/rules?type=node-affinity&resource=vm%3A100",
    );
  });
});

describe("handler: pve_get_ha_rule", () => {
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

  it("calls client.get with the rule id in the path", async () => {
    const fakeRule = { rule: "keep-apart", type: "resource-affinity" };
    vi.mocked(mockClient.get).mockResolvedValueOnce(fakeRule);

    const result = await mcpClient.callTool({
      name: "pve_get_ha_rule",
      arguments: { rule: "keep-apart" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.get).toHaveBeenCalledWith("/cluster/ha/rules/keep-apart");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(JSON.parse(text)).toEqual(fakeRule);
  });
});

describe("handler: HA rule write tools", () => {
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

  it("pve_create_ha_rule posts required and optional fields", async () => {
    const result = await mcpClient.callTool({
      name: "pve_create_ha_rule",
      arguments: {
        rule: "keep-apart",
        type: "resource-affinity",
        resources: "vm:100,vm:101",
        affinity: "negative",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith("/cluster/ha/rules", {
      rule: "keep-apart",
      type: "resource-affinity",
      resources: "vm:100,vm:101",
      affinity: "negative",
    });
  });

  it("pve_update_ha_rule puts to the rule path and converts booleans", async () => {
    const result = await mcpClient.callTool({
      name: "pve_update_ha_rule",
      arguments: { rule: "keep-apart", disable: true, comment: "paused" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.put).toHaveBeenCalledWith(
      "/cluster/ha/rules/keep-apart",
      { disable: 1, comment: "paused" },
    );
  });

  it("pve_delete_ha_rule deletes the rule path", async () => {
    const result = await mcpClient.callTool({
      name: "pve_delete_ha_rule",
      arguments: { rule: "keep-apart" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.delete).toHaveBeenCalledWith(
      "/cluster/ha/rules/keep-apart",
    );
  });
});

describe("handler: HA arm/disarm", () => {
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

  it("pve_disarm_ha posts resource-mode", async () => {
    const result = await mcpClient.callTool({
      name: "pve_disarm_ha",
      arguments: { resource_mode: "freeze" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/cluster/ha/status/disarm-ha",
      { "resource-mode": "freeze" },
    );
  });

  it("pve_arm_ha posts with no body", async () => {
    const result = await mcpClient.callTool({
      name: "pve_arm_ha",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith("/cluster/ha/status/arm-ha");
  });
});

describe("handler: bulk guest actions", () => {
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

  it("pve_bulk_start_guests posts vms array and mapped max-workers", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce("UPID:pve:0000");

    const result = await mcpClient.callTool({
      name: "pve_bulk_start_guests",
      arguments: { vms: [100, 101], max_workers: 2 },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/cluster/bulk-action/guest/start",
      { vms: [100, 101], "max-workers": 2 },
    );
  });

  it("pve_bulk_start_guests rejects an empty vms array", async () => {
    const result = await mcpClient.callTool({
      name: "pve_bulk_start_guests",
      arguments: { vms: [] },
    });

    expect(result.isError).toBe(true);
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it("pve_bulk_shutdown_guests maps force_stop and timeout", async () => {
    const result = await mcpClient.callTool({
      name: "pve_bulk_shutdown_guests",
      arguments: { vms: [100], timeout: 60, force_stop: false },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/cluster/bulk-action/guest/shutdown",
      { vms: [100], timeout: 60, "force-stop": 0 },
    );
  });

  it("pve_bulk_suspend_guests maps to-disk and statestorage", async () => {
    const result = await mcpClient.callTool({
      name: "pve_bulk_suspend_guests",
      arguments: { vms: [100], to_disk: true, statestorage: "local-lvm" },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/cluster/bulk-action/guest/suspend",
      { vms: [100], "to-disk": 1, statestorage: "local-lvm" },
    );
  });

  it("pve_bulk_migrate_guests requires target and maps online/with-local-disks", async () => {
    const result = await mcpClient.callTool({
      name: "pve_bulk_migrate_guests",
      arguments: {
        vms: [100, 200],
        target: "pve2",
        online: true,
        with_local_disks: true,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/cluster/bulk-action/guest/migrate",
      { vms: [100, 200], target: "pve2", online: 1, "with-local-disks": 1 },
    );
  });
});

describe("handler: pve_pull_oci_image", () => {
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

  it("posts the reference to the oci-registry-pull endpoint", async () => {
    vi.mocked(mockClient.post).mockResolvedValueOnce("UPID:pve:0001");

    const result = await mcpClient.callTool({
      name: "pve_pull_oci_image",
      arguments: {
        node: "pve",
        storage: "local",
        reference: "docker.io/library/alpine:3.20",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(mockClient.post).toHaveBeenCalledWith(
      "/nodes/pve/storage/local/oci-registry-pull",
      { reference: "docker.io/library/alpine:3.20" },
    );
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("UPID:pve:0001");
  });

  it("includes filename when provided", async () => {
    await mcpClient.callTool({
      name: "pve_pull_oci_image",
      arguments: {
        node: "pve",
        storage: "local",
        reference: "ghcr.io/acme/app:v1",
        filename: "acme-app-v1",
      },
    });

    expect(mockClient.post).toHaveBeenCalledWith(
      "/nodes/pve/storage/local/oci-registry-pull",
      { reference: "ghcr.io/acme/app:v1", filename: "acme-app-v1" },
    );
  });
});
