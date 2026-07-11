import { BRAWLER_IDS } from "@/lib/data/brawlers";
import { getRankBucketMeta, rankBucketSkewPosition } from "@/lib/data/ranks";
import {
  archetypeCounterValue,
  archetypeWeightsFromRoleWeights,
  averageArchetypeWeights,
  MODE_PRIORITY_CLASSES,
} from "./archetypes";
import { classCounterValue, classPositionFit, dominantClass, type CoreClass } from "./class-counters";
import { applyDraftPositionAdjustment, DEFAULT_WEIGHTS } from "./weights";
import { buildReasonsAndWarnings } from "./explain";
import type {
  BrawlerRecommendation,
  DraftRecommendationContext,
  PlayerAvailability,
  RecommendationDataset,
  RoleTag,
  ScoreWeights,
} from "./types";

// Includes the 9-class drafting-guide taxonomy (archetypes.ts) alongside the pre-existing
// finer-grained tags, so "fill the missing class" (the guide's 4th/5th-pick advice) reuses this
// same role-coverage/composition/redundancy machinery rather than needing bespoke logic.
const CORE_ROLES: RoleTag[] = [
  "tank",
  "tank_counter",
  "anti_assassin",
  "marksman",
  "healer",
  "support",
  "controller",
  "area_denial",
  "wall_breaker",
  "assassin",
  "speedster",
  "anti_agro",
  "damage_dealer",
  "trapper",
  "sharpshooter",
];

export function computeAvailability(
  brawlerId: string,
  playerPool: DraftRecommendationContext["playerPool"],
): PlayerAvailability {
  if (!playerPool) return "unlocked_eligible"; // guest mode
  if (playerPool.manuallyExcludedBrawlerIds?.includes(brawlerId)) return "manually_excluded";
  if (playerPool.temporarilyEligibleBrawlerIds?.includes(brawlerId)) return "temporarily_eligible";
  if (playerPool.underleveledBrawlerIds?.includes(brawlerId)) return "unlocked_underleveled";
  if (playerPool.unlockedBrawlerIds) {
    return playerPool.unlockedBrawlerIds.includes(brawlerId) ? "unlocked_eligible" : "not_unlocked";
  }
  return "unknown";
}

function roleWeight(dataset: RecommendationDataset, brawlerId: string, tag: RoleTag): number {
  const feature = dataset.getRoleFeatures(brawlerId).find((f) => f.tag === tag);
  return feature?.weight ?? 0;
}

function allyMaxRoleWeight(dataset: RecommendationDataset, allyIds: string[], tag: RoleTag): number {
  if (allyIds.length === 0) return 0;
  return Math.max(0, ...allyIds.map((id) => roleWeight(dataset, id, tag)));
}

export interface ScoreBreakdown {
  mapPerformance: number;
  matchupValue: number;
  allySynergy: number;
  compositionFit: number;
  roleCoverage: number;
  draftFlexibility: number;
  recentMetaStrength: number;
  playerComfort: number;
  statisticalConfidence: number;
  counterRisk: number;
  redundancy: number;
  strongestCounterTargetId?: string; // enemy this candidate counters best
  worstMatchupOpponentId?: string; // enemy this candidate loses hardest to
  bestSynergyAllyId?: string;
  missingRoleFilled?: RoleTag;
  dominantRedundantTag?: RoleTag;
  sampleSize: number;
  safeFirstPickWeight: number;
  /** -1..+1 signal for "this Brawler is notably rank-bracket sensitive at the requested bucket". */
  rankFitSignal: number;
  rankBucketLabel: string;
  metaTrend: "buffed" | "nerfed" | "stable";
  /** Whether mapPerformance came from a real imported brawltime.ninja export or the seeded mock. */
  mapStatSource: "mock" | "brawltime_export";
  /** 0-1, centered 0.5: how well this candidate's archetype counters the enemy's, per archetypes.ts. */
  archetypeCounter: number;
  /** 0-1: bonus for being a strong first-pick class for the current mode (only nonzero on pick 1). */
  modeClassFit: number;
  /** 0-1 if real pick-rate data exists for this rank bucket, else undefined (metaPopularity uses 0.5). */
  realPopularity?: number;
  metaPopularity: number;
  /** 0-1 if real per-mode use-rate data exists for this mode, else undefined (modePopularity uses 0.5). */
  realModePopularity?: number;
  modePopularity: number;
  /** The candidate's single dominant class per class-counters.ts (Thrower/Tank/Space Maker/Anti-Tank/Support/Sniper/Control). */
  candidateClass?: CoreClass;
  /** 0-1, centered 0.5: how well the candidate's class counters the enemy's revealed classes. */
  classCounter: number;
  /** 0-1, centered 0.5: draft-position/mode fit for the candidate's class (e.g. Thrower only safe last pick). */
  classPositionFit: number;
  /** Whether this candidate is being scored for the literal first or last pick action of the draft — used to phrase explanations situationally (e.g. "keeps later picks open" is only true when there is a later pick). */
  isFirstPick: boolean;
  isLastPick: boolean;
}

export function computeScoreBreakdown(
  candidateId: string,
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
): ScoreBreakdown {
  const mapStat = dataset.getMapStat(candidateId, ctx.mapId, ctx.modeId, ctx.rankBucket);
  const mapPerformance = mapStat?.adjustedWinRate ?? 0.5;

  let matchupValue = 0.5;
  let counterRisk = 0;
  let strongestCounterTargetId: string | undefined;
  let worstMatchupOpponentId: string | undefined;
  if (ctx.enemyPicks.length > 0) {
    const matchups = ctx.enemyPicks
      .map((enemyId) => ({ enemyId, rec: dataset.getMatchup(candidateId, enemyId, ctx.mapId, ctx.modeId, ctx.rankBucket) }))
      .filter((m): m is { enemyId: string; rec: NonNullable<typeof m.rec> } => Boolean(m.rec));
    if (matchups.length > 0) {
      matchupValue = matchups.reduce((sum, m) => sum + m.rec.adjustedMatchupRate, 0) / matchups.length;
      const best = matchups.reduce((a, b) => (b.rec.adjustedMatchupRate > a.rec.adjustedMatchupRate ? b : a));
      const worst = matchups.reduce((a, b) => (b.rec.adjustedMatchupRate < a.rec.adjustedMatchupRate ? b : a));
      strongestCounterTargetId = best.rec.adjustedMatchupRate > 0.55 ? best.enemyId : undefined;
      if (worst.rec.adjustedMatchupRate < 0.45) {
        worstMatchupOpponentId = worst.enemyId;
        counterRisk = Math.min(1, (0.5 - worst.rec.adjustedMatchupRate) / 0.3);
      }
    }
  }

  let allySynergy = 0.5;
  let bestSynergyAllyId: string | undefined;
  if (ctx.allyPicks.length > 0) {
    const synergies = ctx.allyPicks
      .map((allyId) => ({ allyId, rec: dataset.getSynergy(candidateId, allyId, ctx.mapId, ctx.modeId, ctx.rankBucket) }))
      .filter((s): s is { allyId: string; rec: NonNullable<typeof s.rec> } => Boolean(s.rec));
    if (synergies.length > 0) {
      allySynergy = synergies.reduce((sum, s) => sum + s.rec.adjustedSynergyRate, 0) / synergies.length;
      const best = synergies.reduce((a, b) => (b.rec.adjustedSynergyRate > a.rec.adjustedSynergyRate ? b : a));
      bestSynergyAllyId = best.rec.adjustedSynergyRate > 0.55 ? best.allyId : undefined;
    }
  }

  // Role coverage: reward filling roles the current ally picks barely express yet.
  let roleCoverage = 0;
  let missingRoleFilled: RoleTag | undefined;
  let bestMissingContribution = 0;
  for (const tag of CORE_ROLES) {
    const candidateWeight = roleWeight(dataset, candidateId, tag);
    if (candidateWeight <= 0) continue;
    const allyCoverage = allyMaxRoleWeight(dataset, ctx.allyPicks, tag);
    if (allyCoverage < 0.3) {
      const contribution = candidateWeight * (1 - allyCoverage);
      roleCoverage += contribution;
      if (contribution > bestMissingContribution) {
        bestMissingContribution = contribution;
        missingRoleFilled = tag;
      }
    }
  }
  roleCoverage = Math.min(1, roleCoverage / 1.2);

  // Composition fit: breadth of core roles covered by the team once this candidate joins.
  const rolesCoveredWithCandidate = new Set<RoleTag>();
  for (const tag of CORE_ROLES) {
    if (allyMaxRoleWeight(dataset, ctx.allyPicks, tag) >= 0.3) rolesCoveredWithCandidate.add(tag);
    if (roleWeight(dataset, candidateId, tag) >= 0.3) rolesCoveredWithCandidate.add(tag);
  }
  const compositionFit = rolesCoveredWithCandidate.size / CORE_ROLES.length;

  // Redundancy: candidate's single strongest tag already heavily covered by allies.
  const candidateFeatures = dataset.getRoleFeatures(candidateId);
  let redundancy = 0;
  let dominantRedundantTag: RoleTag | undefined;
  if (candidateFeatures.length > 0) {
    const dominant = candidateFeatures.reduce((a, b) => (b.weight > a.weight ? b : a));
    const allyCoverage = allyMaxRoleWeight(dataset, ctx.allyPicks, dominant.tag);
    if (allyCoverage > 0.6) {
      redundancy = allyCoverage;
      dominantRedundantTag = dominant.tag;
    }
  }

  // Flexibility: how many distinct roles the candidate meaningfully expresses.
  const meaningfulRoles = candidateFeatures.filter((f) => f.weight >= 0.3).length;
  const safeFirstPickWeight = roleWeight(dataset, candidateId, "safe_first_pick");
  const draftFlexibility = Math.min(1, (meaningfulRoles / 3) * 0.7 + safeFirstPickWeight * 0.3);

  const recentMetaStrength = dataset.getMetaStrength(candidateId, dataset.patchId);

  const availability = computeAvailability(candidateId, ctx.playerPool);
  const playerComfort =
    availability === "unlocked_eligible"
      ? 1
      : availability === "temporarily_eligible"
        ? 0.7
        : availability === "unlocked_underleveled"
          ? 0.5
          : 0.2;

  const sampleSize = mapStat?.sampleSize ?? 0;
  const statisticalConfidence = mapStat?.confidenceScore ?? 0.3;

  const rankFitSignal = dataset.getRankSkew(candidateId) * rankBucketSkewPosition(ctx.rankBucket);
  const rankBucketLabel = getRankBucketMeta(ctx.rankBucket)?.name ?? ctx.rankBucket;
  const metaTrend = dataset.getMetaTrend(candidateId, dataset.patchId);

  // Class/archetype counter (a user-provided drafting guide, see archetypes.ts): how well this
  // candidate's playstyle mix counters the enemy team's revealed playstyle mix. Neutral (0.5) when
  // no enemy Brawlers are picked yet.
  const candidateArchetype = archetypeWeightsFromRoleWeights((tag) => roleWeight(dataset, candidateId, tag));
  const enemyArchetype = averageArchetypeWeights(
    ctx.enemyPicks.map((id) => archetypeWeightsFromRoleWeights((tag) => roleWeight(dataset, id, tag))),
  );
  const archetypeCounter = archetypeCounterValue(candidateArchetype, enemyArchetype);

  // Mode-class fit ("the 1st pick of each mode should be the strongest of the most important
  // class in that mode"): only meaningful on the literal first pick of the draft.
  const priorityClasses = MODE_PRIORITY_CLASSES[ctx.modeId] ?? [];
  const modeClassFit =
    ctx.picksSoFar === 0 && priorityClasses.length > 0
      ? Math.max(0, ...priorityClasses.map((tag) => roleWeight(dataset, candidateId, tag)))
      : 0;

  // Class-counter matrix (class-counters.ts): Anti-Tank/Tank/Space Maker/Thrower/Sniper/Control/
  // Support, a second, independent user-provided framework from a reference image + companion
  // strategy video. Distinct from the archetype system above (different guide, same tag list).
  const candidateClass = dominantClass((tag) => roleWeight(dataset, candidateId, tag));
  const enemyClasses = ctx.enemyPicks.map((id) => dominantClass((tag) => roleWeight(dataset, id, tag)));
  const classCounter = classCounterValue(candidateClass, enemyClasses);

  const isFirstPick = ctx.action === "pick" && ctx.picksSoFar === 0;
  const isLastPick = ctx.action === "pick" && ctx.totalPicksInFormat - ctx.picksSoFar === 1;

  const allyClasses = ctx.allyPicks.map((id) => dominantClass((tag) => roleWeight(dataset, id, tag)));
  const classPositionFitValue = classPositionFit({
    candidateClass,
    modeId: ctx.modeId,
    isFirstPick,
    isLastPick,
    allyDominantClasses: allyClasses,
  });

  // Real pick-rate popularity (data/brawltime/README.md): undefined until a real export has been
  // imported for this exact rank bucket, in which case it's a genuine measured percentile — never
  // fabricated. Neutral (0.5) fallback so it contributes nothing when absent.
  const realPopularity = dataset.getRealPopularity(candidateId, ctx.rankBucket);
  const metaPopularity = realPopularity ?? 0.5;

  // Real per-mode use-rate popularity (data/brawltime/README.md §6): a second, independent real
  // popularity signal keyed by mode instead of rank bucket. Kept as its own term rather than
  // merged into metaPopularity above so a recommendation can explain which axis it came from.
  const realModePopularity = dataset.getModePopularity(candidateId, ctx.modeId);
  const modePopularity = realModePopularity ?? 0.5;

  return {
    mapPerformance,
    matchupValue,
    allySynergy,
    compositionFit,
    roleCoverage,
    draftFlexibility,
    recentMetaStrength,
    playerComfort,
    statisticalConfidence,
    counterRisk,
    redundancy,
    strongestCounterTargetId,
    worstMatchupOpponentId,
    bestSynergyAllyId,
    missingRoleFilled,
    dominantRedundantTag,
    sampleSize,
    safeFirstPickWeight,
    rankFitSignal,
    rankBucketLabel,
    metaTrend,
    mapStatSource: mapStat?.source ?? "mock",
    archetypeCounter,
    modeClassFit,
    realPopularity,
    metaPopularity,
    realModePopularity,
    modePopularity,
    candidateClass,
    classCounter,
    classPositionFit: classPositionFitValue,
    isFirstPick,
    isLastPick,
  };
}

function weightedScore(breakdown: ScoreBreakdown, weights: ScoreWeights): number {
  const positive =
    weights.mapPerformance * breakdown.mapPerformance +
    weights.matchupValue * breakdown.matchupValue +
    weights.allySynergy * breakdown.allySynergy +
    weights.compositionFit * breakdown.compositionFit +
    weights.roleCoverage * breakdown.roleCoverage +
    weights.draftFlexibility * breakdown.draftFlexibility +
    weights.recentMetaStrength * breakdown.recentMetaStrength +
    weights.playerComfort * breakdown.playerComfort +
    weights.statisticalConfidence * breakdown.statisticalConfidence +
    weights.archetypeCounter * breakdown.archetypeCounter +
    weights.modeClassFit * breakdown.modeClassFit +
    weights.metaPopularity * breakdown.metaPopularity +
    weights.modePopularity * breakdown.modePopularity +
    weights.classCounter * breakdown.classCounter +
    weights.classPositionFit * breakdown.classPositionFit;
  const penalty = weights.counterRiskPenalty * breakdown.counterRisk + weights.redundancyPenalty * breakdown.redundancy;
  return Math.min(1, Math.max(0, positive - penalty));
}

export function scorePickCandidate(
  candidateId: string,
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): BrawlerRecommendation {
  const positionFactor = ctx.totalPicksInFormat > 0 ? ctx.picksSoFar / ctx.totalPicksInFormat : 0;
  const adjustedWeights = applyDraftPositionAdjustment(weights, positionFactor);
  const breakdown = computeScoreBreakdown(candidateId, ctx, dataset);
  const score = weightedScore(breakdown, adjustedWeights);
  const availability = computeAvailability(candidateId, ctx.playerPool);
  const { reasons, warnings } = buildReasonsAndWarnings(candidateId, breakdown, adjustedWeights, availability);
  return {
    brawlerId: candidateId,
    action: "pick",
    score,
    confidence: breakdown.statisticalConfidence,
    availability,
    reasons,
    warnings,
  };
}

function legalCandidateIds(ctx: DraftRecommendationContext): string[] {
  const excluded = new Set([...ctx.allBanned, ...ctx.allPicked]);
  return BRAWLER_IDS.filter((id) => !excluded.has(id));
}

/**
 * Scores every legal (not banned/picked) candidate for a pick action, sorted best-first.
 * Includes Brawlers unavailable to the acting player (tagged accordingly) so callers can build
 * an "ideal but unavailable" section (spec section 9) — filter by `.availability` for the
 * primary fast-draft list (spec section 3, item 14).
 */
export function generatePickRecommendations(
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): BrawlerRecommendation[] {
  return legalCandidateIds(ctx)
    .map((id) => scorePickCandidate(id, ctx, dataset, weights))
    .sort((a, b) => b.score - a.score);
}

export function splitByAvailability(recommendations: BrawlerRecommendation[]): {
  available: BrawlerRecommendation[];
  unavailable: BrawlerRecommendation[];
} {
  const available: BrawlerRecommendation[] = [];
  const unavailable: BrawlerRecommendation[] = [];
  for (const rec of recommendations) {
    if (rec.availability === "not_unlocked" || rec.availability === "manually_excluded") {
      unavailable.push(rec);
    } else {
      available.push(rec);
    }
  }
  return { available, unavailable };
}
