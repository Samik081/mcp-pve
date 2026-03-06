import { vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../types/index.js";
import type { PveClient } from "../core/client.js";

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    baseUrl: "https://pve.test:8006",
    tokenId: "test@pam!test-token",
    tokenSecret: "00000000-0000-0000-0000-000000000000",
    accessTier: "full",
    categories: null,
    toolBlacklist: null,
    toolWhitelist: null,
    excludeToolTitles: false,
    verifySsl: false,
    debug: false,
    transport: "stdio",
    httpPort: 3000,
    httpHost: "0.0.0.0",
    ...overrides,
  };
}

export function makeMockClient(): PveClient {
  return {
    get: vi.fn().mockResolvedValue({}),
    post: vi.fn().mockResolvedValue({}),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
    validateConnection: vi.fn().mockResolvedValue(undefined),
  } as unknown as PveClient;
}

export async function connectTestClient(server: McpServer) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return {
    client,
    cleanup: async () => {
      await client.close();
    },
  };
}
