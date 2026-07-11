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
  | "situational_last_pick"
  // The 9-class simplified drafting framework from a user-provided strategy guide (see
  // src/lib/recommendation-engine/archetypes.ts). "tank", "assassin", "controller", and "support"
  // above already cover 4 of the 9 classes; these 5 are new.
  | "speedster"
  | "anti_agro"
  | "damage_dealer"
  | "trapper"
  | "sharpshooter";

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
  /**
   * Provenance of this specific record. "mock" is the seeded/synthetic dataset
   * (mock-data.ts). "brawltime_export" means it was parsed from a real, user-exported CSV from
   * brawltime.ninja's dashboard (see data/brawltime/README.md) — real match data, not fabricated,
   * but community-sourced rather than official (spec/data-sources.md source priority #5).
   */
  source?: "mock" | "brawltime_export";
  exportedAt?: string;
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
  /**
   * 0-1 percentile popularity from real, user-imported pick-rate data for this exact rank bucket
   * (see data/brawltime/README.md and scripts/import-pickrate-csv.mjs), or undefined when no real
   * data has been imported for that bucket. This is popularity, not measured win rate — never
   * conflated with getMapStat's adjustedWinRate.
   */
  getRealPopularity(brawlerId: string, rankBucket: string): number | undefined;
  /**
   * 0-1 percentile from real, user-imported per-mode use-rate data (see
   * scripts/import-mode-userate-csv.mjs and data/brawltime/README.md), or undefined when no real
   * data has been imported for that mode. A different axis from getRealPopularity above (mode-
   * scoped rather than rank-bucket-scoped) — the two are never averaged together, only ever
   * surfaced as separate, separately-labeled signals.
   */
  getModePopularity(brawlerId: string, modeId: string): number | undefined;
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
  /** Rock-paper-scissors-style class counter (aggressive/defensive/passive), see archetypes.ts. */
  archetypeCounter: number;
  /** Bonus for a strong first-pick class for the current mode (only active on pick 1 of the draft). */
  modeClassFit: number;
  /** Real pick-rate popularity for this rank bucket where imported, neutral (0.5) otherwise. */
  metaPopularity: number;
  /** Real per-mode use-rate popularity where imported, neutral (0.5) otherwise. See class-counters.ts-adjacent getModePopularity. */
  modePopularity: number;
  /** Class-counter matrix (Anti-Tank/Tank/Space Maker/Thrower/Sniper/Control/Support), see class-counters.ts. */
  classCounter: number;
  /** Draft-position/mode fit for the candidate's class (e.g. Thrower only safe last pick), see class-counters.ts. */
  classPositionFit: number;
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
  | "archetype_counter"
  | "mode_class_fit"
  | "meta_popularity"
  | "mode_popularity"
  | "class_counter"
  | "class_position_fit"
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
