/**
 * HTTP client for Proxmox VE API.
 *
 * Uses native fetch (Node 18+) with PVE API Token authentication.
 * All PVE JSON responses are wrapped in {"data": ...} — this client
 * unwraps them so callers get clean data.
 */

import type { AppConfig } from "../types/index.js";
import { PveError, registerSensitivePattern, sanitizeMessage } from "./errors.js";
import { logger } from "./logger.js";

/** Request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

export class PveClient {
  private readonly authHeader: string;
  private readonly apiBase: string;
  private readonly baseUrl: string;

  constructor(config: AppConfig) {
    this.baseUrl = config.baseUrl;
    this.authHeader = `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`;
    this.apiBase = `${config.baseUrl}/api2/json`;
  }

  /** Send a GET request and return unwrapped data. */
  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  /** Send a POST request with optional body and return unwrapped data. */
  async post(path: string, body?: Record<string, unknown>): Promise<unknown> {
    return this.request("POST", path, body);
  }

  /** Send a PUT request with optional body and return unwrapped data. */
  async put(path: string, body?: Record<string, unknown>): Promise<unknown> {
    return this.request("PUT", path, body);
  }

  /** Send a DELETE request and return unwrapped data. */
  async delete(path: string): Promise<unknown> {
    return this.request("DELETE", path);
  }

  /**
   * Validate the connection to PVE by calling GET /api2/json/version.
   * Logs the PVE version on success.
   */
  async validateConnection(): Promise<void> {
    const url = `${this.apiBase}/version`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: this.authHeader },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === 401 || response.status === 403) {
        throw new PveError(
          "Authentication failed -- check PVE_TOKEN_ID and PVE_TOKEN_SECRET",
          response.status,
        );
      }

      if (!response.ok) {
        throw new PveError(
          `Connection check failed: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      const json = (await response.json()) as { data?: { version?: string; release?: string } };
      const version = json.data?.version ?? "unknown";
      const release = json.data?.release ?? "";
      logger.info(
        `Connected to Proxmox VE at ${this.baseUrl} (version: ${version}${release ? `, release: ${release}` : ""})`,
      );
    } catch (err) {
      if (err instanceof PveError) throw err;
      throw new PveError(
        sanitizeMessage(
          `Cannot connect to Proxmox VE at ${this.baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  /**
   * Core request method. Builds the full URL, sends the request,
   * checks for errors, and unwraps PVE's {"data": ...} envelope.
   */
  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.apiBase}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.authHeader,
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try {
          const errBody = (await response.json()) as { errors?: Record<string, string> };
          if (errBody.errors) {
            const messages = Object.entries(errBody.errors)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ");
            detail += ` — ${messages}`;
          }
        } catch {
          // Ignore JSON parse failures on error bodies
        }
        throw new PveError(
          sanitizeMessage(`${method} ${path} failed: ${detail}`),
          response.status,
        );
      }

      // Some DELETE/POST endpoints return empty or non-JSON responses
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("json")) {
        const text = await response.text();
        return text || null;
      }

      const json = (await response.json()) as { data?: unknown };
      return json.data !== undefined ? json.data : json;
    } catch (err) {
      if (err instanceof PveError) throw err;
      throw new PveError(
        sanitizeMessage(
          err instanceof Error ? err.message : String(err),
        ),
      );
    }
  }
}

/**
 * Create a PVE client from config.
 * Registers credentials as sensitive patterns before creating the client.
 */
export function createClient(config: AppConfig): PveClient {
  registerSensitivePattern(config.tokenId);
  registerSensitivePattern(config.tokenSecret);
  return new PveClient(config);
}

/**
 * Validate connectivity to PVE.
 * Must be called during startup before accepting MCP connections.
 * Exits the process with code 1 if validation fails.
 */
export async function validateConnection(client: PveClient): Promise<void> {
  try {
    await client.validateConnection();
  } catch (error) {
    logger.error(
      "Failed to connect to Proxmox VE.",
    );
    logger.error(
      "Check that PVE_BASE_URL is correct and the PVE host is reachable.",
    );
    if (error instanceof Error) {
      logger.error(`Details: ${sanitizeMessage(error.message)}`);
    }
    process.exit(1);
  }
}
