import { confidenceFromSampleSize, MOCK_DATASET, shrinkToPrior } from "./mock-data";
import generatedMapStats from "./real-data/generated-map-stats.json";
import generatedPickRates from "./real-data/generated-pick-rates.json";
import type { ImportedMapStatRow, ImportedPickRateRow } from "./real-data/types";
import type { MapStatRecord, RecommendationDataset } from "./types";

/**
 * Wraps the seeded mock dataset with any real data imported from user-exported brawltime.ninja
 * CSVs (see data/brawltime/README.md, scripts/import-brawltime-csv.mjs, and
 * scripts/import-pickrate-csv.mjs). Two independent real-data overlays:
 *
 * - getMapStat: real per-Brawler win/use rate for a specific (map, mode, rank bucket), from the
 *   simple "Group By: Brawler" dashboard export.
 * - getRealPopularity: real, global (not map-specific) pick-rate percentile for a rank bucket —
 *   popularity, not win rate, and never written into adjustedWinRate.
 *
 * getMatchup/getSynergy/getRoleFeatures/getMetaStrength/getRankSkew still come from the seeded
 * mock dataset — brawltime.ninja's exports don't carry pairwise or role/archetype data. This is
 * the entire point of the RecommendationDataset interface (docs/architecture.md section 2): the
 * scoring engine doesn't know or care which parts of a lookup are real vs. seeded.
 *
 * Both generated-*.json files ship empty and stay empty until someone actually runs an import
 * script against a real export — until then this wrapper is a no-op passthrough to MOCK_DATASET.
 */

const IMPORTED_MAP_ROWS = generatedMapStats as ImportedMapStatRow[];
const IMPORTED_PICK_RATE_ROWS = generatedPickRates as ImportedPickRateRow[];

function findImportedMapRow(
  brawlerId: string,
  mapId: string,
  modeId: string,
  rankBucket: string,
): ImportedMapStatRow | undefined {
  return IMPORTED_MAP_ROWS.find(
    (r) => r.brawlerId === brawlerId && r.mapId === mapId && r.modeId === modeId && r.rankBucket === rankBucket,
  );
}

function getMapStat(brawlerId: string, mapId: string, modeId: string, rankBucket: string): MapStatRecord | undefined {
  const imported = findImportedMapRow(brawlerId, mapId, modeId, rankBucket);
  if (!imported) return MOCK_DATASET.getMapStat(brawlerId, mapId, modeId, rankBucket);
  return {
    brawlerId,
    mapId,
    modeId,
    patchId: MOCK_DATASET.patchId,
    rankBucket,
    sampleSize: imported.sampleSize,
    adjustedWinRate: shrinkToPrior(imported.winRate, imported.sampleSize),
    confidenceScore: confidenceFromSampleSize(imported.sampleSize),
    source: "brawltime_export",
    exportedAt: imported.exportedAt,
  };
}

function getRealPopularity(brawlerId: string, rankBucket: string): number | undefined {
  return IMPORTED_PICK_RATE_ROWS.find((r) => r.brawlerId === brawlerId && r.rankBucket === rankBucket)
    ?.popularityPercentile;
}

/** True if any real (non-mock) map data has been imported at all, for a one-time UI banner. */
export const HAS_ANY_REAL_MAP_DATA = IMPORTED_MAP_ROWS.length > 0;
export const HAS_ANY_REAL_PICK_RATE_DATA = IMPORTED_PICK_RATE_ROWS.length > 0;
const HAS_ANY_REAL_DATA = HAS_ANY_REAL_MAP_DATA || HAS_ANY_REAL_PICK_RATE_DATA;

export function hasRealMapData(mapId: string, modeId: string, rankBucket: string): boolean {
  return IMPORTED_MAP_ROWS.some((r) => r.mapId === mapId && r.modeId === modeId && r.rankBucket === rankBucket);
}

export function hasRealPickRateData(rankBucket: string): boolean {
  return IMPORTED_PICK_RATE_ROWS.some((r) => r.rankBucket === rankBucket);
}

export const HYBRID_DATASET: RecommendationDataset = {
  ...MOCK_DATASET,
  versionId: HAS_ANY_REAL_DATA ? `${MOCK_DATASET.versionId}+brawltime` : MOCK_DATASET.versionId,
  isMock: !HAS_ANY_REAL_DATA,
  getMapStat,
  getRealPopularity,
};
