import { describe, expect, it } from "vitest";
import {
  HAS_ANY_REAL_MAP_DATA,
  HAS_ANY_REAL_PICK_RATE_DATA,
  HAS_ANY_REAL_MODE_USE_RATE_DATA,
  HYBRID_DATASET,
  hasRealMapData,
  hasRealPickRateData,
  hasRealModeUseRateData,
} from "./hybrid-dataset";
import { MOCK_DATASET } from "./mock-data";

describe("hybrid dataset (real brawltime.ninja import overlay)", () => {
  it("has no real map win-rate data imported yet (only pick-rate data has been imported so far)", () => {
    // generated-map-stats.json ships empty until someone runs scripts/import-brawltime-csv.mjs
    // for a real map/mode/rank export — unlike generated-pick-rates.json, which now has real
    // data (see the next describe block).
    expect(HAS_ANY_REAL_MAP_DATA).toBe(false);
  });

  it("the dataset is no longer pure mock now that real pick-rate data has been imported", () => {
    expect(HYBRID_DATASET.isMock).toBe(false);
    expect(HYBRID_DATASET.versionId).toContain("+brawltime");
  });

  it("passes through to identical mock values when nothing real is imported for a given map lookup", () => {
    const mock = MOCK_DATASET.getMapStat("shelly", "sneaky-fields", "brawl-ball", "all");
    const hybrid = HYBRID_DATASET.getMapStat("shelly", "sneaky-fields", "brawl-ball", "all");
    expect(hybrid).toEqual(mock);
    expect(hybrid?.source).toBe("mock");
    expect(hasRealMapData("sneaky-fields", "brawl-ball", "all")).toBe(false);
  });

  it("still delegates matchup/synergy/role lookups straight to the mock dataset (not real-data-backed)", () => {
    expect(HYBRID_DATASET.getMatchup).toBe(MOCK_DATASET.getMatchup);
    expect(HYBRID_DATASET.getSynergy).toBe(MOCK_DATASET.getSynergy);
    expect(HYBRID_DATASET.getRoleFeatures).toBe(MOCK_DATASET.getRoleFeatures);
  });
});

describe("real pick-rate data (imported from a user-provided brawltime.ninja export)", () => {
  it("has real data imported for the legendary and masters rank buckets", () => {
    expect(HAS_ANY_REAL_PICK_RATE_DATA).toBe(true);
    expect(hasRealPickRateData("legendary")).toBe(true);
    expect(hasRealPickRateData("masters")).toBe(true);
  });

  it("does not have real pick-rate data for rank buckets outside the imported range", () => {
    expect(hasRealPickRateData("diamond")).toBe(false);
    expect(hasRealPickRateData("mythic")).toBe(false);
    expect(hasRealPickRateData("all")).toBe(false);
  });

  it("Crow (the most-picked Brawler in the real export) has the maximum popularity percentile", () => {
    expect(HYBRID_DATASET.getRealPopularity("crow", "legendary")).toBeCloseTo(1, 5);
    expect(HYBRID_DATASET.getRealPopularity("crow", "masters")).toBeCloseTo(1, 5);
  });

  it("Sam (the least-picked Brawler in the real export) has the minimum popularity percentile", () => {
    expect(HYBRID_DATASET.getRealPopularity("sam", "legendary")).toBeCloseTo(0, 5);
  });

  it("returns undefined for a rank bucket with no imported pick-rate data", () => {
    expect(HYBRID_DATASET.getRealPopularity("crow", "diamond")).toBeUndefined();
  });

  it("returns undefined for a Brawler id not present in the imported export", () => {
    expect(HYBRID_DATASET.getRealPopularity("not-a-real-brawler", "legendary")).toBeUndefined();
  });
});

describe("real per-mode use-rate data (imported from 6 user-provided brawltime.ninja exports)", () => {
  it("has real data imported for all 6 seeded Ranked modes", () => {
    expect(HAS_ANY_REAL_MODE_USE_RATE_DATA).toBe(true);
    for (const modeId of ["gem-grab", "brawl-ball", "bounty", "heist", "hot-zone", "knockout"]) {
      expect(hasRealModeUseRateData(modeId)).toBe(true);
    }
  });

  it("Crow (the most-used Brawler in the Gem Grab export) has the maximum popularity percentile", () => {
    expect(HYBRID_DATASET.getModePopularity("crow", "gem-grab")).toBeCloseTo(1, 5);
  });

  it("a Brawler with a tiny use rate in the Gem Grab export has a near-zero popularity percentile", () => {
    expect(HYBRID_DATASET.getModePopularity("angelo", "gem-grab")).toBeLessThan(0.05);
  });

  it("is a distinct axis from rank-bucket pick rate — not defined for a mode with no import", () => {
    expect(HYBRID_DATASET.getModePopularity("crow", "not-a-real-mode")).toBeUndefined();
  });

  it("returns undefined for a Brawler id not present in the imported export", () => {
    expect(HYBRID_DATASET.getModePopularity("not-a-real-brawler", "gem-grab")).toBeUndefined();
  });
});
