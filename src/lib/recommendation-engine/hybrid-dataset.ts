import { confidenceFromSampleSize, MOCK_DATASET, shrinkToPrior } from "./mock-data";
import generatedMapStats from "./real-data/generated-map-stats.json";
import type { ImportedMapStatRow } from "./real-data/types";
import type { MapStatRecord, RecommendationDataset } from "./types";

/**
 * Wraps the seeded mock dataset with any real map/mode/rank-bucket win-rate data imported from a
 * user-exported brawltime.ninja CSV (see data/brawltime/README.md and scripts/import-brawltime-csv.mjs).
 *
 * Only getMapStat can currently be backed by real data — brawltime.ninja's per-Brawler dashboard
 * export gives win rate/use rate by (map, mode, rank), not matchup-vs-matchup or ally-synergy
 * numbers, so getMatchup/getSynergy/getRoleFeatures/getMetaStrength/getRankSkew still come from the
 * seeded mock dataset. This is the entire point of the RecommendationDataset interface (see
 * docs/architecture.md section 2): the scoring engine doesn't know or care which parts of a lookup
 * are real vs. seeded, it just calls the interface.
 *
 * generated-map-stats.json starts empty and stays empty until someone actually runs the import
 * script against a real export — until then this wrapper is a no-op passthrough to MOCK_DATASET.
 */

const IMPORTED_ROWS = generatedMapStats as ImportedMapStatRow[];

function findImportedRow(
  brawlerId: string,
  mapId: string,
  modeId: string,
  rankBucket: string,
): ImportedMapStatRow | undefined {
  return IMPORTED_ROWS.find(
    (r) => r.brawlerId === brawlerId && r.mapId === mapId && r.modeId === modeId && r.rankBucket === rankBucket,
  );
}

function getMapStat(brawlerId: string, mapId: string, modeId: string, rankBucket: string): MapStatRecord | undefined {
  const imported = findImportedRow(brawlerId, mapId, modeId, rankBucket);
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

/** True if any real (non-mock) map data has been imported at all, for a one-time UI banner. */
export const HAS_ANY_REAL_MAP_DATA = IMPORTED_ROWS.length > 0;

export function hasRealMapData(mapId: string, modeId: string, rankBucket: string): boolean {
  return IMPORTED_ROWS.some((r) => r.mapId === mapId && r.modeId === modeId && r.rankBucket === rankBucket);
}

export const HYBRID_DATASET: RecommendationDataset = {
  ...MOCK_DATASET,
  versionId: HAS_ANY_REAL_MAP_DATA ? `${MOCK_DATASET.versionId}+brawltime` : MOCK_DATASET.versionId,
  isMock: !HAS_ANY_REAL_MAP_DATA,
  getMapStat,
};
