import { describe, expect, it } from "vitest";
import { formatRrdTable } from "../core/rrd.js";

/** Build `n` rows 60s apart with a rising cpu and constant maxcpu. */
function makeRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    time: 1000 + i * 60,
    cpu: i,
    maxcpu: 4,
    netin: i * 10,
  }));
}

describe("formatRrdTable", () => {
  it("returns every row when row count is within the bucket limit", () => {
    const out = formatRrdTable(makeRows(3), { timeframe: "hour" });
    expect(out).toEqual({
      timeframe: "hour",
      cf: "AVERAGE",
      source_rows: 3,
      constant: { maxcpu: 4 },
      columns: ["time", "cpu", "netin"],
      rows: [
        [1000, 0, 0],
        [1060, 1, 10],
        [1120, 2, 20],
      ],
    });
  });

  it("sorts rows by time and unions keys that differ between rows", () => {
    const out = formatRrdTable(
      [
        { time: 1060, cpu: 1 },
        { time: 1000, cpu: 0.5, mem: 7 },
      ],
      { timeframe: "hour" },
    );
    expect(out.columns).toEqual(["time", "cpu", "mem"]);
    expect(out.rows).toEqual([
      [1000, 0.5, 7],
      [1060, 1, null],
    ]);
  });

  it("averages rows into buckets by default (60)", () => {
    const out = formatRrdTable(makeRows(120), { timeframe: "day" });
    expect(out.source_rows).toBe(120);
    expect(out.bucket_seconds).toBe(120);
    expect(out.rows).toHaveLength(60);
    // First bucket = rows 0 and 1: cpu mean 0.5, netin mean 5
    expect(out.rows[0]).toEqual([1000, 0.5, 5]);
    expect(out.rows[59]).toEqual([1000 + 118 * 60, 118.5, 1185]);
    expect(out.note).toContain("120 rows");
    expect(out.note).toContain("60 buckets");
  });

  it("takes the max per bucket when cf is MAX", () => {
    const out = formatRrdTable(makeRows(6), {
      timeframe: "day",
      cf: "MAX",
      buckets: 2,
    });
    expect(out.cf).toBe("MAX");
    expect(out.rows).toEqual([
      [1000, 2, 20],
      [1180, 5, 50],
    ]);
  });

  it("skips null samples when aggregating and yields null for all-null buckets", () => {
    const out = formatRrdTable(
      [
        { time: 0, cpu: 1 },
        { time: 60, cpu: 3, mem: 5 },
        { time: 120 },
        { time: 180 },
      ],
      { timeframe: "hour", buckets: 2 },
    );
    expect(out.rows).toEqual([
      [0, 2, 5],
      [120, null, null],
    ]);
  });

  it("rounds bucket means to 4 significant digits but keeps MAX samples exact", () => {
    const rows = [
      { time: 0, cpu: 0.1, mem: 12687495606 },
      { time: 60, cpu: 0.2, mem: 12687495607 },
      { time: 120, cpu: 0.4, mem: 12687495608 },
      { time: 180, cpu: 0.123456789, mem: 1 },
    ];
    const avg = formatRrdTable(rows, { timeframe: "hour", buckets: 2 });
    // (0.1 + 0.2) / 2 = 0.15000000000000002 in floating point
    expect(avg.rows[0]).toEqual([0, 0.15, 12690000000]);
    const max = formatRrdTable(rows, {
      timeframe: "hour",
      cf: "MAX",
      buckets: 2,
    });
    expect(max.rows[1]).toEqual([120, 0.4, 12687495608]);
  });

  it("puts the aggregation note before the data", () => {
    const out = formatRrdTable(makeRows(120), { timeframe: "day" });
    const keys = Object.keys(out);
    expect(keys.indexOf("note")).toBeLessThan(keys.indexOf("rows"));
    expect(keys.indexOf("bucket_seconds")).toBeLessThan(keys.indexOf("rows"));
  });

  it("buckets: 0 disables aggregation", () => {
    const out = formatRrdTable(makeRows(120), { timeframe: "day", buckets: 0 });
    expect(out.rows).toHaveLength(120);
    expect(out.bucket_seconds).toBeUndefined();
    expect(out.note).toBeUndefined();
  });

  it("keeps only requested fields (plus time) and reports unknown ones", () => {
    const out = formatRrdTable(makeRows(2), {
      timeframe: "hour",
      fields: ["netin", "bogus"],
    });
    expect(out.columns).toEqual(["time", "netin"]);
    expect(out.constant).toEqual({});
    expect(out.rows).toEqual([
      [1000, 0],
      [1060, 10],
    ]);
    expect(out.unknown_fields).toEqual(["bogus"]);
  });

  it("handles empty input", () => {
    const out = formatRrdTable([], { timeframe: "hour" });
    expect(out.source_rows).toBe(0);
    expect(out.columns).toEqual(["time"]);
    expect(out.rows).toEqual([]);
  });
});
