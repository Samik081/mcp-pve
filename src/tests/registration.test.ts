import { describe, expect, it, vi } from "vitest";
import { logger } from "../core/logger.js";
import { createServer } from "../core/server.js";
import { registerAllTools } from "../tools/index.js";
import { connectTestClient, makeConfig, makeMockClient } from "./helpers.js";

describe("tool registration", () => {
  it("registers 105 tools at full tier", async () => {
    const server = createServer();
    registerAllTools(server, makeMockClient(), makeConfig());
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(105);
    await cleanup();
  });

  it("registers only read-only tools in read-only mode", async () => {
    const server = createServer();
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ accessTier: "read-only" }),
    );
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(51);
    for (const tool of tools) {
      expect(
        tool.annotations?.readOnlyHint,
        `${tool.name} missing readOnlyHint`,
      ).toBe(true);
    }
    await cleanup();
  });

  it("registers 68 tools in read-execute mode", async () => {
    const server = createServer();
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ accessTier: "read-execute" }),
    );
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(68);
    await cleanup();
  });

  it("filters to only nodes category tools", async () => {
    const server = createServer();
    registerAllTools(
      server,
      makeMockClient(),
      makeConfig({ categories: ["nodes"] }),
    );
    const { client, cleanup } = await connectTestClient(server);
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^pve_.*node/);
    }
    await cleanup();
  });

  it("registers fewer tools when category filter is applied", async () => {
    const fullServer = createServer();
    registerAllTools(fullServer, makeMockClient(), makeConfig());
    const fullConn = await connectTestClient(fullServer);
    const { tools: allTools } = await fullConn.client.listTools();

    const filteredServer = createServer();
    registerAllTools(
      filteredServer,
      makeMockClient(),
      makeConfig({ categories: ["nodes", "cluster"] }),
    );
    const filteredConn = await connectTestClient(filteredServer);
    const { tools: filteredTools } = await filteredConn.client.listTools();

    expect(filteredTools.length).toBeGreaterThan(0);
    expect(filteredTools.length).toBeLessThan(allTools.length);

    await fullConn.cleanup();
    await filteredConn.cleanup();
  });

  describe("tool titles", () => {
    it("includes titles by default", async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(tool.title, `${tool.name} missing title`).toBeDefined();
      }
      await cleanup();
    });

    it("excludes titles when excludeToolTitles is true", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({ excludeToolTitles: true }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      for (const tool of tools) {
        expect(
          tool.title,
          `${tool.name} should not have title`,
        ).toBeUndefined();
      }
      await cleanup();
    });
  });

  describe("blacklist/whitelist", () => {
    it("blacklist excludes specific tools", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({ toolBlacklist: ["pve_list_nodes"] }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).not.toContain("pve_list_nodes");
      await cleanup();
    });

    it("blacklist does not affect non-blacklisted tools", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({ toolBlacklist: ["pve_list_nodes"] }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("pve_delete_qemu_vm");
      await cleanup();
    });

    it("whitelist includes tool excluded by tier filter", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          accessTier: "read-only",
          toolWhitelist: ["pve_delete_qemu_vm"],
        }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("pve_delete_qemu_vm");
      await cleanup();
    });

    it("whitelist includes tool excluded by category filter", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          categories: ["nodes"],
          toolWhitelist: ["pve_list_qemu_vms"],
        }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain("pve_list_qemu_vms");
      await cleanup();
    });

    it("blacklist takes precedence over whitelist", async () => {
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          toolBlacklist: ["pve_list_nodes"],
          toolWhitelist: ["pve_list_nodes"],
        }),
      );
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name);
      expect(names).not.toContain("pve_list_nodes");
      await cleanup();
    });

    it("blacklist + whitelist conflict logs warning", async () => {
      const spy = vi.spyOn(logger, "warn");
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          toolBlacklist: ["pve_list_nodes"],
          toolWhitelist: ["pve_list_nodes"],
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("blacklist takes precedence"),
      );
      spy.mockRestore();
    });

    it("validates unknown blacklisted tool name", async () => {
      const spy = vi.spyOn(logger, "warn");
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          toolBlacklist: ["nonexistent_tool_xyz"],
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("does not match"),
      );
      spy.mockRestore();
    });

    it("validates unknown whitelisted tool name", async () => {
      const spy = vi.spyOn(logger, "warn");
      const server = createServer();
      registerAllTools(
        server,
        makeMockClient(),
        makeConfig({
          toolWhitelist: ["nonexistent_tool_abc"],
        }),
      );
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining("does not match"),
      );
      spy.mockRestore();
    });
  });

  describe("annotations", () => {
    it("pve_list_nodes: readOnly, not destructive, idempotent", async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "pve_list_nodes");
      expect(tool).toBeDefined();
      expect(tool?.annotations?.readOnlyHint).toBe(true);
      expect(tool?.annotations?.destructiveHint).toBe(false);
      expect(tool?.annotations?.idempotentHint).toBe(true);
      await cleanup();
    });

    it("pve_manage_node_service: not readOnly, destructive, not idempotent", async () => {
      const server = createServer();
      registerAllTools(server, makeMockClient(), makeConfig());
      const { client, cleanup } = await connectTestClient(server);
      const { tools } = await client.listTools();
      const tool = tools.find((t) => t.name === "pve_manage_node_service");
      expect(tool).toBeDefined();
      expect(tool?.annotations?.readOnlyHint).toBe(false);
      expect(tool?.annotations?.destructiveHint).toBe(true);
      expect(tool?.annotations?.idempotentHint).toBe(false);
      await cleanup();
    });
  });
});
