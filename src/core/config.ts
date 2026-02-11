/**
 * Environment variable parsing and validation.
 * Reads required and optional config from process.env.
 */

import type { AccessTier, AppConfig } from "../types/index.js";
import { VALID_CATEGORIES } from "../types/index.js";
import { logger } from "./logger.js";

/**
 * Determine the access tier from PVE_ACCESS_TIER.
 *
 * Valid values: "read-only", "read-execute", "full" (default).
 */
function parseAccessTier(): AccessTier {
  const tier = process.env.PVE_ACCESS_TIER;
  if (tier === "read-only" || tier === "read-execute") {
    return tier;
  }
  return "full";
}

function parseCategories(value: string | undefined): string[] | null {
  if (value === undefined || value === "") {
    return null;
  }
  const categories = value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const invalid = categories.filter(
    (c) => !VALID_CATEGORIES.includes(c as never),
  );
  if (invalid.length > 0) {
    logger.warn(
      `Ignoring unknown categories: ${invalid.join(", ")}. Valid: ${VALID_CATEGORIES.join(", ")}`,
    );
  }

  const valid = categories.filter((c) =>
    VALID_CATEGORIES.includes(c as never),
  );
  return valid.length > 0 ? valid : null;
}

/**
 * Load and validate application config from environment variables.
 *
 * Required: PVE_BASE_URL, PVE_TOKEN_ID, PVE_TOKEN_SECRET
 * Optional: PVE_ACCESS_TIER (default: 'full'), PVE_CATEGORIES,
 *           PVE_VERIFY_SSL (default: 'true'), DEBUG
 *
 * Throws clear error (no credentials in message) if required vars are missing.
 */
export function loadConfig(): AppConfig {
  const baseUrl = process.env.PVE_BASE_URL;
  const tokenId = process.env.PVE_TOKEN_ID;
  const tokenSecret = process.env.PVE_TOKEN_SECRET;

  const missing: string[] = [];
  if (!baseUrl) missing.push("PVE_BASE_URL");
  if (!tokenId) missing.push("PVE_TOKEN_ID");
  if (!tokenSecret) missing.push("PVE_TOKEN_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Set these variables to connect to your Proxmox VE instance.",
    );
  }

  const verifySsl = process.env.PVE_VERIFY_SSL !== "false";

  return {
    baseUrl: baseUrl!.replace(/\/+$/, ""),
    tokenId: tokenId!,
    tokenSecret: tokenSecret!,
    accessTier: parseAccessTier(),
    categories: parseCategories(process.env.PVE_CATEGORIES),
    verifySsl,
    debug: Boolean(process.env.DEBUG),
  };
}
