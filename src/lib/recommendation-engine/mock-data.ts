import { BRAWLER_ROLE_FEATURES, BRAWLERS, getBrawlerMeta, getRankSkew } from "@/lib/data/brawlers";
import { rankBucketSkewPosition } from "@/lib/data/ranks";
import type {
  MapStatRecord,
  MatchupStatRecord,
  RecommendationDataset,
  RoleFeature,
  SynergyStatRecord,
} from "./types";

/**
 * MOCK / SEEDED DATASET — NOT REAL STATISTICS.
 *
 * Every number this module produces is generated deterministically from a string hash so the
 * scoring engine has *something internally consistent* to run against and to test. None of it is
 * derived from real Brawl Stars match data. Every recommendation surfaced in the UI must carry
 * `datasetVersion` / `isMock` from here so a user (or a future maintainer) can never mistake this
 * for a live statistics feed. See docs/data-sources.md section 2 for the real/mock boundary.
 */

export const MOCK_DATASET_VERSION = "mock-2026.07.1";

export interface MockPatchInfo {
  id: string;
  releasedAt: string;
  buffedBrawlerIds: string[];
  nerfedBrawlerIds: string[];
}

/**
 * Small seeded patch history demonstrating the mechanism spec section 8.2 asks for: when a patch
 * buffs/nerfs a Brawler, meta-strength (and therefore the recommendation score) shifts for that
 * Brawler on the very next lookup — no code change required, only a new entry here. In Phase 4
 * this same shape is populated by the real `balance_patches` table (docs/implementation-plan.md
 * section 2) instead of being hand-written, and getMetaStrength would additionally apply the
 * exp(-lambda * ageInDays) decay of pre-patch match data described in that same section.
 */
export const MOCK_PATCH_HISTORY: MockPatchInfo[] = [
  { id: "2026.06", releasedAt: "2026-06-04", buffedBrawlerIds: ["poco"], nerfedBrawlerIds: ["bull", "elprimo"] },
  { id: "2026.07", releasedAt: "2026-07-08", buffedBrawlerIds: ["tick", "rico"], nerfedBrawlerIds: ["shelly"] },
];

export const MOCK_PATCH_ID = MOCK_PATCH_HISTORY[MOCK_PATCH_HISTORY.length - 1]!.id;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Deterministic pseudo-random float in [0, 1) from a seed, mulberry32. */
function seededFloat(seed: number): number {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function keyedFloat(...parts: string[]): number {
  return seededFloat(hashString(parts.join("|")));
}

const LOW_SAMPLE_BRAWLER_IDS = new Set(BRAWLERS.filter((b) => b.recentlyReleased).map((b) => b.id));

function sampleSizeFor(...parts: string[]): number {
  if (parts.some((p) => LOW_SAMPLE_BRAWLER_IDS.has(p))) {
    return Math.round(20 + keyedFloat(...parts, "n") * 40); // deliberately small, n in [20,60)
  }
  return Math.round(300 + keyedFloat(...parts, "n") * 4000); // n in [300,4300)
}

export const PRIOR_STRENGTH = 200;
export const GLOBAL_PRIOR_WIN_RATE = 0.5;

/**
 * Bayesian shrinkage per docs/implementation-plan.md section 4. Exported (not mock-specific) so
 * hybrid-dataset.ts can apply the same, real statistical treatment to imported brawltime.ninja
 * rows, which only carry an approximate sample size rather than raw win/loss counts.
 */
export function shrinkToPrior(observed: number, sampleSize: number): number {
  return (sampleSize * observed + PRIOR_STRENGTH * GLOBAL_PRIOR_WIN_RATE) / (sampleSize + PRIOR_STRENGTH);
}

export function confidenceFromSampleSize(sampleSize: number): number {
  return sampleSize / (sampleSize + PRIOR_STRENGTH);
}

function getMapStat(
  brawlerId: string,
  mapId: string,
  modeId: string,
  rankBucket: string,
): MapStatRecord | undefined {
  if (!getBrawlerMeta(brawlerId)) return undefined;
  const bucket = rankBucket || "all";
  const sampleSize = sampleSizeFor(brawlerId, mapId, modeId, bucket);
  // Rank-bracket skew (docs/data-sources.md): a Brawler curated as "low-elo strong" trends worse
  // as the bucket climbs toward Masters, and vice versa for "high-elo strong" — up to ~12 points.
  // Deliberately keyed WITHOUT `bucket` in the base noise term below, so rank bucket only ever
  // moves this number through the explicit, monotonic skew term — not through unrelated per-bucket
  // hash noise that could just as easily point the wrong way.
  const skewAdjustment = getRankSkew(brawlerId) * rankBucketSkewPosition(bucket) * 0.12;
  const observedWinRate = clamp(
    0.38 + keyedFloat(brawlerId, mapId, modeId, "wr") * 0.24 + skewAdjustment,
    0.05,
    0.95,
  ); // base 0.38-0.62 before skew
  const adjustedWinRate = shrinkToPrior(observedWinRate, sampleSize);
  return {
    brawlerId,
    mapId,
    modeId,
    patchId: MOCK_PATCH_ID,
    rankBucket: bucket,
    sampleSize,
    adjustedWinRate,
    confidenceScore: confidenceFromSampleSize(sampleSize),
    source: "mock",
  };
}

function getMatchup(
  candidateId: string,
  opponentId: string,
  mapId: string,
  modeId: string,
  rankBucket: string,
): MatchupStatRecord | undefined {
  if (candidateId === opponentId) return undefined;
  if (!getBrawlerMeta(candidateId) || !getBrawlerMeta(opponentId)) return undefined;
  const bucket = rankBucket || "all";
  // Keep the pair-level random draw symmetric so matchup(A,B) + matchup(B,A) == 1, a real invariant
  // any adjustedMatchupRate must satisfy (it's "probability candidate beats opponent").
  const [first, second] = [candidateId, opponentId].sort() as [string, string];
  // Apply rank skew as the *relative* difference between the two Brawlers' curated skews, split
  // evenly into `base` (first's win probability) — this keeps the antisymmetry invariant
  // (candidate-vs-opponent + opponent-vs-candidate == 1) exact by construction while still letting
  // "easily countered at high elo" show up as a genuinely worse matchup number at high brackets.
  // As with getMapStat, the base noise term below is deliberately keyed WITHOUT `bucket`, so rank
  // bucket only ever moves this number through the explicit skewDelta term.
  const skewDelta =
    (getRankSkew(first) - getRankSkew(second)) * rankBucketSkewPosition(bucket) * 0.08;
  const base = clamp(
    0.32 + keyedFloat(first, second, mapId, modeId, "matchup") * 0.36 + skewDelta,
    0.05,
    0.95,
  ); // base 0.32-0.68 before skew
  const rate = candidateId === first ? base : 1 - base;
  const sampleSize = sampleSizeFor(candidateId, opponentId, mapId, modeId, bucket);
  return {
    candidateBrawlerId: candidateId,
    opponentBrawlerId: opponentId,
    mapId,
    modeId,
    patchId: MOCK_PATCH_ID,
    rankBucket: bucket,
    sampleSize,
    adjustedMatchupRate: rate,
  };
}

function getSynergy(
  brawlerId: string,
  allyId: string,
  mapId: string,
  modeId: string,
  rankBucket: string,
): SynergyStatRecord | undefined {
  if (brawlerId === allyId) return undefined;
  if (!getBrawlerMeta(brawlerId) || !getBrawlerMeta(allyId)) return undefined;
  const bucket = rankBucket || "all";
  const [first, second] = [brawlerId, allyId].sort() as [string, string];
  const sampleSize = sampleSizeFor(brawlerId, allyId, mapId, modeId, bucket);
  const rate = 0.35 + keyedFloat(first, second, mapId, modeId, bucket, "synergy") * 0.3; // 0.35-0.65, symmetric
  return {
    brawlerId,
    allyBrawlerId: allyId,
    mapId,
    modeId,
    patchId: MOCK_PATCH_ID,
    rankBucket: bucket,
    sampleSize,
    adjustedSynergyRate: rate,
  };
}

function getRoleFeatures(brawlerId: string): RoleFeature[] {
  return BRAWLER_ROLE_FEATURES[brawlerId] ?? [];
}

function patchInfo(patchId: string): MockPatchInfo | undefined {
  return MOCK_PATCH_HISTORY.find((p) => p.id === patchId);
}

function getMetaTrend(brawlerId: string, patchId: string): "buffed" | "nerfed" | "stable" {
  const patch = patchInfo(patchId);
  if (!patch) return "stable";
  if (patch.buffedBrawlerIds.includes(brawlerId)) return "buffed";
  if (patch.nerfedBrawlerIds.includes(brawlerId)) return "nerfed";
  return "stable";
}

function getMetaStrength(brawlerId: string, patchId: string): number {
  if (!getBrawlerMeta(brawlerId)) return 0.5;
  const base = 0.35 + keyedFloat(brawlerId, patchId, "meta") * 0.3; // 0.35-0.65
  const trend = getMetaTrend(brawlerId, patchId);
  const trendAdjustment = trend === "buffed" ? 0.15 : trend === "nerfed" ? -0.15 : 0;
  return clamp(base + trendAdjustment, 0.05, 0.95);
}

/** The pure mock dataset has no concept of real pick-rate data — only hybrid-dataset.ts does. */
function getRealPopularity(): number | undefined {
  return undefined;
}

/** Same as getRealPopularity above — only hybrid-dataset.ts overlays real per-mode stats data. */
function getModePopularity(): number | undefined {
  return undefined;
}

function getModeWinRate(): number | undefined {
  return undefined;
}

function getModeMetaPercentile(): number | undefined {
  return undefined;
}

function getModeStatsDetail(): undefined {
  return undefined;
}

export const MOCK_DATASET: RecommendationDataset = {
  versionId: MOCK_DATASET_VERSION,
  patchId: MOCK_PATCH_ID,
  isMock: true,
  getMapStat,
  getMatchup,
  getSynergy,
  getRoleFeatures,
  getMetaStrength,
  getMetaTrend,
  getRankSkew,
  getRealPopularity,
  getModeWinRate,
  getModePopularity,
  getModeMetaPercentile,
  getModeStatsDetail,
};
