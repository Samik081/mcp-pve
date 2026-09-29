/**
 * Shared RRD (round-robin database) helpers for the *_rrddata tools.
 *
 * PVE returns one JSON object per sample (60 rows for `hour`, ~1400 for
 * `day`), repeating every key and constant fields like `maxmem` in each row.
 * By default we compact that into a column/row table, hoist constant fields,
 * and average rows into a bounded number of time buckets so the output stays
 * small enough for an LLM. `format: "raw"` returns the exact PVE response.
 */

import { z } from "zod";
import type { PveClient } from "./client.js";

export const DEFAULT_RRD_BUCKETS = 60;

type RrdRow = Record<string, number | null | undefined>;

export interface RrdTableOptions {
  timeframe: string;
  cf?: "AVERAGE" | "MAX";
  fields?: string[];
  buckets?: number;
}

export interface RrdTable {
  timeframe: string;
  cf: "AVERAGE" | "MAX";
  source_rows: number;
  bucket_seconds?: number;
  note?: string;
  unknown_fields?: string[];
  constant: Record<string, number>;
  columns: string[];
  rows: (number | null)[][];
}

/** Tool description shared by the rrddata tools, e.g. `rrdDescription("a QEMU VM")`. */
export function rrdDescription(subject: string): string {
  return (
    `Get RRD statistics (CPU, memory, disk, network, pressure) for ${subject} over a time period. ` +
    `Returns a compact {columns, rows} table averaged into at most ${DEFAULT_RRD_BUCKETS} time buckets, ` +
    "with fields that never change (e.g. maxmem) hoisted into `constant`. Use fields to pick columns, " +
    'cf MAX for peaks, buckets 0 for full resolution, or format "raw" for the exact PVE response'
  );
}

/** Zod input schema shared by all rrddata tools (merge with node/vmid). */
export const rrdInputSchema = {
  timeframe: z
    .enum(["hour", "day", "week", "month", "year"])
    .describe("Time frame for the RRD data"),
  cf: z
    .enum(["AVERAGE", "MAX"])
    .optional()
    .describe(
      "RRD consolidation function (default: AVERAGE). MAX shows peaks; buckets then keep the max too",
    ),
  fields: z
    .array(z.string())
    .optional()
    .describe(
      'Only return these fields (time is always included), e.g. ["cpu", "mem"]. Default: all fields',
    ),
  buckets: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      `Aggregate rows into at most this many equal time buckets (default: ${DEFAULT_RRD_BUCKETS}; means rounded to 4 significant digits). 0 = every row at full resolution, unrounded`,
    ),
  format: z
    .enum(["table", "raw"])
    .optional()
    .describe(
      "table (default): compact {columns, rows} with constant fields hoisted and bucketing applied. " +
        "raw: the exact PVE response (array of objects; ignores fields/buckets) — large, best saved to a file",
    ),
};

function aggregate(
  values: (number | null)[],
  cf: "AVERAGE" | "MAX",
): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  // MAX returns a real sample, kept exact. A mean is derived, so trim float
  // noise (0.0036180555555555553) to 4 significant digits.
  if (cf === "MAX") return Math.max(...present);
  const mean = present.reduce((sum, v) => sum + v, 0) / present.length;
  return Number(mean.toPrecision(4));
}

/** Turn PVE rrddata rows into a compact, optionally bucketed table. */
export function formatRrdTable(
  data: RrdRow[],
  options: RrdTableOptions,
): RrdTable {
  const cf = options.cf ?? "AVERAGE";
  const buckets = options.buckets ?? DEFAULT_RRD_BUCKETS;
  const sorted = [...data].sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

  const allKeys = new Set<string>();
  for (const row of sorted) {
    for (const key of Object.keys(row)) if (key !== "time") allKeys.add(key);
  }

  let keys = [...allKeys].sort();
  let unknownFields: string[] | undefined;
  if (options.fields) {
    const wanted = options.fields.filter((f) => f !== "time");
    keys = keys.filter((k) => wanted.includes(k));
    const unknown = wanted.filter((f) => !allKeys.has(f));
    if (unknown.length > 0) unknownFields = unknown;
  }

  // Hoist fields that hold the same non-null value in every row.
  const constant: Record<string, number> = {};
  if (sorted.length > 1) {
    for (const key of keys) {
      const first = sorted[0][key];
      if (
        typeof first === "number" &&
        sorted.every((row) => row[key] === first)
      ) {
        constant[key] = first;
      }
    }
  }
  const columns = keys.filter((k) => !(k in constant));

  let rows = sorted.map((row) => [
    row.time ?? null,
    ...columns.map((k) => row[k] ?? null),
  ]);

  // Aggregation metadata goes before the data so it is read first.
  const table: Partial<RrdTable> = {
    timeframe: options.timeframe,
    cf,
    source_rows: sorted.length,
  };

  if (buckets > 0 && rows.length > buckets) {
    // RRD rows are evenly spaced, so equal-count chunks are equal-time buckets.
    const size = Math.ceil(rows.length / buckets);
    const step = (sorted[1].time ?? 0) - (sorted[0].time ?? 0);
    const bucketed: (number | null)[][] = [];
    for (let i = 0; i < rows.length; i += size) {
      const chunk = rows.slice(i, i + size);
      bucketed.push([
        chunk[0][0],
        ...columns.map((_, c) =>
          aggregate(
            chunk.map((r) => r[c + 1]),
            cf,
          ),
        ),
      ]);
    }
    table.bucket_seconds = size * step;
    table.note =
      `Aggregated ${rows.length} rows into ${bucketed.length} buckets of ${size * step}s ` +
      `(${cf === "MAX" ? "max per bucket" : "mean per bucket, rounded to 4 significant digits"}; time = bucket start). ` +
      `Pass buckets: 0 for full resolution or format: "raw" for the exact PVE response.`;
    rows = bucketed;
  }

  if (unknownFields) table.unknown_fields = unknownFields;
  table.constant = constant;
  table.columns = ["time", ...columns];
  table.rows = rows;

  return table as RrdTable;
}

/**
 * Fetch `<basePath>/rrddata` and render it per the shared rrd input schema.
 * `basePath` is e.g. `/nodes/pve1` or `/nodes/pve1/qemu/100`.
 */
export async function getRrdData(
  client: PveClient,
  basePath: string,
  args: Record<string, unknown>,
): Promise<string> {
  const params = new URLSearchParams({ timeframe: String(args.timeframe) });
  if (args.cf) params.set("cf", String(args.cf));
  const data = await client.get(`${basePath}/rrddata?${params}`);
  if (args.format === "raw") return JSON.stringify(data);
  return JSON.stringify(
    formatRrdTable((data as RrdRow[]) ?? [], {
      timeframe: String(args.timeframe),
      cf: args.cf as RrdTableOptions["cf"],
      fields: args.fields as string[] | undefined,
      buckets: args.buckets as number | undefined,
    }),
  );
}
