import { describe, expect, it } from "vitest";
import { parseFractionOrPercent, parseScoreValue, computePercentileFor, computeScoreRanks } from "./import-mode-stats-csv.mjs";

describe("mode stats CSV import — parseFractionOrPercent", () => {
  it("parses a 0-1 fraction as-is", () => {
    expect(parseFractionOrPercent("0.5949")).toBeCloseTo(0.5949, 4);
  });

  it("converts a percentage string to a 0-1 fraction", () => {
    expect(parseFractionOrPercent("59.49%")).toBeCloseTo(0.5949, 4);
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parseFractionOrPercent("")).toBeUndefined();
    expect(parseFractionOrPercent("n/a")).toBeUndefined();
  });
});

describe("mode stats CSV import — parseScoreValue", () => {
  it("parses a raw score number", () => {
    expect(parseScoreValue("163.29")).toBeCloseTo(163.29, 2);
  });

  it("returns undefined for empty or non-numeric input", () => {
    expect(parseScoreValue("")).toBeUndefined();
    expect(parseScoreValue("n/a")).toBeUndefined();
  });
});

describe("mode stats CSV import — computePercentileFor", () => {
  it("assigns 1.0 to the highest value and 0.0 to the lowest for the given key", () => {
    const entries = [
      { brawlerId: "a", winRate: 0.3 },
      { brawlerId: "b", winRate: 0.7 },
      { brawlerId: "c", winRate: 0.5 },
    ];
    const percentileById = computePercentileFor(entries, "winRate");
    expect(percentileById.get("b")).toBeCloseTo(1, 5);
    expect(percentileById.get("a")).toBeCloseTo(0, 5);
    expect(percentileById.get("c")).toBeCloseTo(0.5, 5);
  });

  it("handles a single-entry list without dividing by zero", () => {
    const percentileById = computePercentileFor([{ brawlerId: "solo", winRate: 0.4 }], "winRate");
    expect(percentileById.get("solo")).toBe(1);
  });
});

describe("mode stats CSV import — computeScoreRanks", () => {
  it("assigns rank 1 to the highest score", () => {
    const entries = [
      { brawlerId: "a", score: 50 },
      { brawlerId: "b", score: 90 },
      { brawlerId: "c", score: 70 },
    ];
    const rankById = computeScoreRanks(entries);
    expect(rankById.get("b")).toBe(1);
    expect(rankById.get("c")).toBe(2);
    expect(rankById.get("a")).toBe(3);
  });
});
