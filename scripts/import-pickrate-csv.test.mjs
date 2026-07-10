import { describe, expect, it } from "vitest";
import { parsePickRateValue, computePercentiles } from "./import-pickrate-csv.mjs";

describe("pick-rate CSV import — parsePickRateValue", () => {
  it("parses a 0-1 fraction as-is (brawltime.ninja pick-rate exports are not 0-100)", () => {
    expect(parsePickRateValue("0.05309911307894945")).toBeCloseTo(0.0531, 4);
  });

  it("strips a stray percent sign if present", () => {
    expect(parsePickRateValue("5.3%")).toBeCloseTo(5.3, 5);
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parsePickRateValue("")).toBeUndefined();
    expect(parsePickRateValue("n/a")).toBeUndefined();
  });
});

describe("pick-rate CSV import — computePercentiles", () => {
  it("assigns 1.0 to the most-picked Brawler and 0.0 to the least-picked", () => {
    const entries = [
      { brawlerId: "a", pickRate: 0.01 },
      { brawlerId: "b", pickRate: 0.05 },
      { brawlerId: "c", pickRate: 0.03 },
    ];
    const withPercentiles = computePercentiles(entries);
    const byId = Object.fromEntries(withPercentiles.map((e) => [e.brawlerId, e.popularityPercentile]));
    expect(byId.b).toBeCloseTo(1, 5); // highest pick rate
    expect(byId.a).toBeCloseTo(0, 5); // lowest pick rate
    expect(byId.c).toBeCloseTo(0.5, 5); // middle
  });

  it("handles a single-entry list without dividing by zero", () => {
    const withPercentiles = computePercentiles([{ brawlerId: "solo", pickRate: 0.02 }]);
    expect(withPercentiles[0].popularityPercentile).toBe(1);
  });
});
