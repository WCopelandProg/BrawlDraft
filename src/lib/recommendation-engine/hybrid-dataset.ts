import { confidenceFromSampleSize, MOCK_DATASET, shrinkToPrior } from "./mock-data";
import generatedMapStats from "./real-data/generated-map-stats.json";
import generatedPickRates from "./real-data/generated-pick-rates.json";
import generatedModeStats from "./real-data/generated-mode-stats.json";
import type { ImportedMapStatRow, ImportedModeStatsRow, ImportedPickRateRow } from "./real-data/types";
import type { MapStatRecord, ModeStatsDetail, RecommendationDataset } from "./types";

/**
 * Wraps the seeded mock dataset with any real data imported from user-provided CSV exports (see
 * data/brawltime/README.md, scripts/import-brawltime-csv.mjs, scripts/import-pickrate-csv.mjs, and
 * scripts/import-mode-stats-csv.mjs). Three independent real-data overlays:
 *
 * - getMapStat: real per-Brawler win/use rate for a specific (map, mode, rank bucket), from the
 *   simple "Group By: Brawler" dashboard export.
 * - getRealPopularity: real, global (not map-specific) pick-rate percentile for a rank bucket —
 *   popularity, not win rate, and never written into adjustedWinRate.
 * - getModeWinRate / getModePopularity / getModeStatsDetail: real, per-mode (all maps, all ranks
 *   combined) win rate + pick rate + composite ranking score — a different axis from
 *   getRealPopularity above (mode-scoped instead of rank-bucket-scoped). The source export didn't
 *   state a rank bracket, so this applies the same per-mode numbers regardless of the selected
 *   rank bucket rather than guessing one (see real-data/types.ts).
 *
 * getMatchup/getSynergy/getRoleFeatures/getMetaStrength/getRankSkew still come from the seeded
 * mock dataset — none of these exports carry pairwise or role/archetype data. This is the entire
 * point of the RecommendationDataset interface (docs/architecture.md section 2): the scoring
 * engine doesn't know or care which parts of a lookup are real vs. seeded.
 *
 * All generated-*.json files ship empty and stay empty until someone actually runs an import
 * script against a real export — until then this wrapper is a no-op passthrough to MOCK_DATASET.
 */

const IMPORTED_MAP_ROWS = generatedMapStats as ImportedMapStatRow[];
const IMPORTED_PICK_RATE_ROWS = generatedPickRates as ImportedPickRateRow[];
const IMPORTED_MODE_STATS_ROWS = generatedModeStats as ImportedModeStatsRow[];

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

function findImportedModeStatsRow(brawlerId: string, modeId: string): ImportedModeStatsRow | undefined {
  return IMPORTED_MODE_STATS_ROWS.find((r) => r.brawlerId === brawlerId && r.modeId === modeId);
}

/** Real measured win rate (0-1 fraction) for this Brawler in this mode, or undefined if not imported. */
function getModeWinRate(brawlerId: string, modeId: string): number | undefined {
  return findImportedModeStatsRow(brawlerId, modeId)?.winRate;
}

/** Real pick-rate percentile (0-1) for this Brawler within this mode's import, or undefined. */
function getModePopularity(brawlerId: string, modeId: string): number | undefined {
  return findImportedModeStatsRow(brawlerId, modeId)?.pickRatePercentile;
}

/** Full real-data detail for rich "why" explanations (rank, raw rates), or undefined if not imported. */
function getModeStatsDetail(brawlerId: string, modeId: string): ModeStatsDetail | undefined {
  const row = findImportedModeStatsRow(brawlerId, modeId);
  if (!row) return undefined;
  return {
    winRate: row.winRate,
    pickRate: row.pickRate,
    score: row.score,
    scoreRank: row.scoreRank,
    scoreRankTotal: row.scoreRankTotal,
  };
}

/** True if any real (non-mock) map data has been imported at all, for a one-time UI banner. */
export const HAS_ANY_REAL_MAP_DATA = IMPORTED_MAP_ROWS.length > 0;
export const HAS_ANY_REAL_PICK_RATE_DATA = IMPORTED_PICK_RATE_ROWS.length > 0;
export const HAS_ANY_REAL_MODE_STATS_DATA = IMPORTED_MODE_STATS_ROWS.length > 0;
const HAS_ANY_REAL_DATA = HAS_ANY_REAL_MAP_DATA || HAS_ANY_REAL_PICK_RATE_DATA || HAS_ANY_REAL_MODE_STATS_DATA;

export function hasRealMapData(mapId: string, modeId: string, rankBucket: string): boolean {
  return IMPORTED_MAP_ROWS.some((r) => r.mapId === mapId && r.modeId === modeId && r.rankBucket === rankBucket);
}

export function hasRealPickRateData(rankBucket: string): boolean {
  return IMPORTED_PICK_RATE_ROWS.some((r) => r.rankBucket === rankBucket);
}

export function hasRealModeStatsData(modeId: string): boolean {
  return IMPORTED_MODE_STATS_ROWS.some((r) => r.modeId === modeId);
}

/** Every imported row for a mode, sorted best-winrate-first — used to drive "recommended bans". */
export function modeStatsForMode(modeId: string): ImportedModeStatsRow[] {
  return IMPORTED_MODE_STATS_ROWS.filter((r) => r.modeId === modeId).sort((a, b) => b.winRate - a.winRate);
}

export const HYBRID_DATASET: RecommendationDataset = {
  ...MOCK_DATASET,
  versionId: HAS_ANY_REAL_DATA ? `${MOCK_DATASET.versionId}+brawltime` : MOCK_DATASET.versionId,
  isMock: !HAS_ANY_REAL_DATA,
  getMapStat,
  getRealPopularity,
  getModeWinRate,
  getModePopularity,
  getModeStatsDetail,
};
