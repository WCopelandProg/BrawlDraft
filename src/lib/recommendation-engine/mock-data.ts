import { BRAWLER_ROLE_FEATURES, BRAWLERS, getBrawlerMeta } from "@/lib/data/brawlers";
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
export const MOCK_PATCH_ID = "2026.07";

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

const PRIOR_STRENGTH = 200;
const GLOBAL_PRIOR_WIN_RATE = 0.5;

/** Bayesian shrinkage per docs/implementation-plan.md section 4. */
function shrinkToPrior(observed: number, sampleSize: number): number {
  return (sampleSize * observed + PRIOR_STRENGTH * GLOBAL_PRIOR_WIN_RATE) / (sampleSize + PRIOR_STRENGTH);
}

function confidenceFromSampleSize(sampleSize: number): number {
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
  const observedWinRate = 0.38 + keyedFloat(brawlerId, mapId, modeId, bucket, "wr") * 0.24; // 0.38-0.62
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
  const base = 0.32 + keyedFloat(first, second, mapId, modeId, bucket, "matchup") * 0.36; // 0.32-0.68
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

function getMetaStrength(brawlerId: string, patchId: string): number {
  if (!getBrawlerMeta(brawlerId)) return 0.5;
  return 0.35 + keyedFloat(brawlerId, patchId, "meta") * 0.3; // 0.35-0.65
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
};
