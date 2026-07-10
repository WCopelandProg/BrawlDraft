import type { DraftActionType, Team } from "@/lib/draft-engine/types";

export type RoleTag =
  | "tank"
  | "tank_counter"
  | "assassin"
  | "anti_assassin"
  | "marksman"
  | "thrower"
  | "controller"
  | "support"
  | "healer"
  | "wall_breaker"
  | "bush_scout"
  | "area_denial"
  | "mobility"
  | "burst_damage"
  | "sustained_damage"
  | "objective_pressure"
  | "safe_first_pick"
  | "situational_last_pick";

export interface RoleFeature {
  tag: RoleTag;
  /** 0-1, how strongly this Brawler expresses the role. Curated, not statistical (see docs/data-sources.md). */
  weight: number;
}

export interface MapStatRecord {
  brawlerId: string;
  mapId: string;
  modeId: string;
  patchId: string;
  rankBucket: string;
  sampleSize: number;
  adjustedWinRate: number; // 0-1, already shrinkage-adjusted upstream
  confidenceScore: number; // 0-1
}

export interface MatchupStatRecord {
  candidateBrawlerId: string;
  opponentBrawlerId: string;
  mapId: string;
  modeId: string;
  patchId: string;
  rankBucket: string;
  sampleSize: number;
  adjustedMatchupRate: number; // 0-1, probability candidate outperforms this specific opponent
}

export interface SynergyStatRecord {
  brawlerId: string;
  allyBrawlerId: string;
  mapId: string;
  modeId: string;
  patchId: string;
  rankBucket: string;
  sampleSize: number;
  adjustedSynergyRate: number; // 0-1
}

/**
 * The scoring engine only ever talks to this interface. In Phase 1/2 it is backed by the seeded
 * mock dataset (mock-data.ts). In Phase 4 the same interface would be backed by a Postgres-backed
 * reader over the tables in docs/implementation-plan.md, without the engine itself changing.
 */
export interface RecommendationDataset {
  versionId: string;
  patchId: string;
  isMock: boolean;
  getMapStat(brawlerId: string, mapId: string, modeId: string, rankBucket: string): MapStatRecord | undefined;
  getMatchup(
    candidateId: string,
    opponentId: string,
    mapId: string,
    modeId: string,
    rankBucket: string,
  ): MatchupStatRecord | undefined;
  getSynergy(
    brawlerId: string,
    allyId: string,
    mapId: string,
    modeId: string,
    rankBucket: string,
  ): SynergyStatRecord | undefined;
  getRoleFeatures(brawlerId: string): RoleFeature[];
  /** Static per-patch meta-strength signal, 0-1. Curated/seeded, see docs/data-sources.md. */
  getMetaStrength(brawlerId: string, patchId: string): number;
  /** Whether this Brawler was buffed/nerfed/unchanged in the given patch. Drives "recent_meta_shift" reasons. */
  getMetaTrend(brawlerId: string, patchId: string): "buffed" | "nerfed" | "stable";
  /**
   * Curated -1..+1 rank-bracket skew (see BRAWLER_RANK_SKEW in lib/data/brawlers.ts): negative
   * means stronger at low-elo brackets, positive means stronger at high-elo brackets. Already
   * baked into getMapStat/getMatchup for the requested rankBucket — exposed here separately only
   * so the engine can explain *why* (spec section 6.7: explanations must be grounded in real score
   * components, not just the final number).
   */
  getRankSkew(brawlerId: string): number;
}

export interface ScoreWeights {
  mapPerformance: number;
  matchupValue: number;
  allySynergy: number;
  compositionFit: number;
  roleCoverage: number;
  draftFlexibility: number;
  recentMetaStrength: number;
  playerComfort: number;
  statisticalConfidence: number;
  counterRiskPenalty: number;
  redundancyPenalty: number;
}

export type RecommendationReasonType =
  | "map_strength"
  | "enemy_counter"
  | "ally_synergy"
  | "role_coverage"
  | "safe_first_pick"
  | "flexibility"
  | "low_sample_warning"
  | "counter_risk"
  | "redundancy_warning"
  | "unavailable_to_player"
  | "rank_bracket_fit"
  | "recent_meta_shift"
  // Ban-specific reason types (spec section 6.6/6.7: ban scoring is a different formula from pick
  // scoring, so it gets its own vocabulary of reasons rather than being forced into the pick list).
  | "opponent_threat"
  | "scarce_counters"
  | "preserves_our_options";

export interface RecommendationReason {
  type: RecommendationReasonType;
  impact: number;
  message: string;
}

export type PlayerAvailability =
  | "unlocked_eligible"
  | "unlocked_underleveled"
  | "not_unlocked"
  | "temporarily_eligible"
  | "manually_excluded"
  | "unknown";

export interface BrawlerRecommendation {
  brawlerId: string;
  action: DraftActionType;
  score: number; // normalized 0-1
  confidence: number; // 0-1
  availability: PlayerAvailability;
  reasons: RecommendationReason[];
  warnings: RecommendationReason[];
}

export interface DraftRecommendationContext {
  mapId: string;
  modeId: string;
  rankBucket: string;
  team: Team;
  action: DraftActionType;
  allyPicks: string[];
  enemyPicks: string[];
  allBanned: string[];
  allPicked: string[];
  /** How many total picks (both teams) have already happened, used for early/late-pick weighting. */
  picksSoFar: number;
  totalPicksInFormat: number;
  /**
   * Availability of the acting team's Brawler pool. All omitted/undefined means guest mode:
   * every known Brawler is treated as unlocked_eligible (spec section 3, "guest mode should work").
   */
  playerPool?: {
    unlockedBrawlerIds?: string[];
    underleveledBrawlerIds?: string[];
    manuallyExcludedBrawlerIds?: string[];
    temporarilyEligibleBrawlerIds?: string[];
  };
}
