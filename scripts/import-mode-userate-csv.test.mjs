import { describe, expect, it } from "vitest";
import { parseUseRateValue, computeModePercentiles } from "./import-mode-userate-csv.mjs";

describe("mode use-rate CSV import — parseUseRateValue", () => {
  it("parses a 0-1 fraction as-is (brawltime.ninja use-rate exports are not 0-100)", () => {
    expect(parseUseRateValue("0.07105300208128754")).toBeCloseTo(0.0711, 4);
  });

  it("strips a stray percent sign if present", () => {
    expect(parseUseRateValue("7.1%")).toBeCloseTo(7.1, 5);
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parseUseRateValue("")).toBeUndefined();
    expect(parseUseRateValue("n/a")).toBeUndefined();
  });
});

describe("mode use-rate CSV import — computeModePercentiles", () => {
  it("assigns 1.0 to the most-used Brawler and 0.0 to the least-used, within one mode", () => {
    const entries = [
      { brawlerId: "a", useRate: 0.01 },
      { brawlerId: "b", useRate: 0.05 },
      { brawlerId: "c", useRate: 0.03 },
    ];
    const withPercentiles = computeModePercentiles(entries);
    const byId = Object.fromEntries(withPercentiles.map((e) => [e.brawlerId, e.popularityPercentile]));
    expect(byId.b).toBeCloseTo(1, 5);
    expect(byId.a).toBeCloseTo(0, 5);
    expect(byId.c).toBeCloseTo(0.5, 5);
  });

  it("handles a single-entry list without dividing by zero", () => {
    const withPercentiles = computeModePercentiles([{ brawlerId: "solo", useRate: 0.02 }]);
    expect(withPercentiles[0].popularityPercentile).toBe(1);
  });
});
