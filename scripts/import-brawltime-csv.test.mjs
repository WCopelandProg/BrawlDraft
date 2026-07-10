import { describe, expect, it } from "vitest";
import { parseCsv, parseRateValue, normalizeBrawlerName, findColumnIndex } from "./import-brawltime-csv.mjs";

describe("brawltime CSV import — parseCsv", () => {
  it("parses a simple comma-separated CSV into rows of cells", () => {
    const csv = "Brawler,Win Rate,Use Rate\nShelly,54.2%,3.1%\nColt,48.9%,2.4%\n";
    const rows = parseCsv(csv);
    expect(rows).toEqual([
      ["Brawler", "Win Rate", "Use Rate"],
      ["Shelly", "54.2%", "3.1%"],
      ["Colt", "48.9%", "2.4%"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const csv = 'Brawler,Note\nEl Primo,"Great, but risky"\n';
    const rows = parseCsv(csv);
    expect(rows[1]).toEqual(["El Primo", "Great, but risky"]);
  });

  it("strips a leading BOM", () => {
    const csv = "﻿Brawler,Win Rate\nBull,45%\n";
    const rows = parseCsv(csv);
    expect(rows[0][0]).toBe("Brawler");
  });

  it("ignores blank lines", () => {
    const csv = "Brawler,Win Rate\nBull,45%\n\n\nColt,50%\n";
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(3);
  });
});

describe("brawltime CSV import — parseRateValue", () => {
  it("converts a percentage string to a 0-1 fraction", () => {
    expect(parseRateValue("54.2%")).toBeCloseTo(0.542, 5);
  });

  it("converts a bare percentage number (0-100 scale) to a 0-1 fraction", () => {
    expect(parseRateValue("54.2")).toBeCloseTo(0.542, 5);
  });

  it("leaves an already-fractional value (0-1 scale) unchanged", () => {
    expect(parseRateValue("0.542")).toBeCloseTo(0.542, 5);
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parseRateValue("")).toBeUndefined();
    expect(parseRateValue("n/a")).toBeUndefined();
  });
});

describe("brawltime CSV import — normalizeBrawlerName", () => {
  it("normalizes names to match this app's Brawler ids", () => {
    expect(normalizeBrawlerName("El Primo")).toBe("elprimo");
    expect(normalizeBrawlerName("8-Bit")).toBe("8bit");
    expect(normalizeBrawlerName("Shelly")).toBe("shelly");
  });
});

describe("brawltime CSV import — findColumnIndex", () => {
  it("finds a header column by a case-insensitive pattern", () => {
    const header = ["#", "Brawler", "Win Rate", "Use Rate"];
    expect(findColumnIndex(header, /brawler/i)).toBe(1);
    expect(findColumnIndex(header, /win.?rate/i)).toBe(2);
    expect(findColumnIndex(header, /nonexistent/i)).toBe(-1);
  });
});
