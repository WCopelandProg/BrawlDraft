import { describe, expect, it } from "vitest";
import { HAS_ANY_REAL_MAP_DATA, HYBRID_DATASET, hasRealMapData } from "./hybrid-dataset";
import { MOCK_DATASET } from "./mock-data";

describe("hybrid dataset (real brawltime.ninja import overlay)", () => {
  it("falls back to the mock dataset entirely when no real data has been imported", () => {
    // generated-map-stats.json ships empty until someone runs the import script for real.
    expect(HAS_ANY_REAL_MAP_DATA).toBe(false);
    expect(HYBRID_DATASET.isMock).toBe(true);
    expect(HYBRID_DATASET.versionId).toBe(MOCK_DATASET.versionId);
  });

  it("passes through to identical mock values when nothing real is imported for a given lookup", () => {
    const mock = MOCK_DATASET.getMapStat("shelly", "sneaky-fields", "brawl-ball", "all");
    const hybrid = HYBRID_DATASET.getMapStat("shelly", "sneaky-fields", "brawl-ball", "all");
    expect(hybrid).toEqual(mock);
    expect(hybrid?.source).toBe("mock");
  });

  it("still delegates matchup/synergy/role/meta lookups straight to the mock dataset (not yet real-data-backed)", () => {
    expect(HYBRID_DATASET.getMatchup).toBe(MOCK_DATASET.getMatchup);
    expect(HYBRID_DATASET.getSynergy).toBe(MOCK_DATASET.getSynergy);
    expect(HYBRID_DATASET.getRoleFeatures).toBe(MOCK_DATASET.getRoleFeatures);
    expect(hasRealMapData("sneaky-fields", "brawl-ball", "all")).toBe(false);
  });
});
