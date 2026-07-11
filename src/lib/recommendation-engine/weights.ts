import type { ScoreWeights } from "./types";

/**
 * Starting values only, per spec section 6 — not permanent truth. In a future backend these
 * would be loaded from `recommendation_weight_versions` (docs/implementation-plan.md) so they
 * can be tuned without a code deploy. They are exported as a plain object here so Phase 3+ can
 * swap the source without changing any call site.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  // Reduced from 0.2: this is mostly seeded/mock per-map data (real only where a specific
  // map/mode/rank CSV has been imported via scripts/import-brawltime-csv.mjs, which is rare) — now
  // that modeWinRate below carries genuinely real, mode-wide win rate, mapPerformance shouldn't
  // outweigh it just because it historically had the bigger number.
  mapPerformance: 0.12,
  matchupValue: 0.16,
  allySynergy: 0.14,
  compositionFit: 0.12,
  roleCoverage: 0.1,
  draftFlexibility: 0.08,
  recentMetaStrength: 0.06,
  playerComfort: 0.04,
  statisticalConfidence: 0.04,
  // Rock-paper-scissors class counter and mode-priority first-pick fit, from a user-provided
  // drafting guide (see archetypes.ts) — additive on top of the statistical terms above, not a
  // replacement for them.
  archetypeCounter: 0.1,
  modeClassFit: 0.06,
  // Real pick-rate popularity (data/brawltime/README.md) — a genuine measured percentile where a
  // real export has been imported for the requested rank bucket; a flat, non-differentiating 0.5
  // for every candidate otherwise (same "neutral until real data exists" pattern as
  // mapPerformance/matchupValue/allySynergy above when their own inputs are absent).
  metaPopularity: 0.08,
  // Real per-mode pick-rate popularity (scripts/import-mode-stats-csv.mjs) — a second, independent
  // real popularity signal, this one keyed by mode rather than rank bucket. Bumped up from an
  // earlier, thinner per-mode import per explicit user request to weight real per-mode data more
  // strongly. Same "neutral 0.5 until real data exists" fallback pattern as metaPopularity above.
  modePopularity: 0.1,
  // Real per-mode measured win rate (scripts/import-mode-stats-csv.mjs) — this app's single
  // strongest real-data term: actual measured win rate for this exact mode, not popularity and not
  // a mock number. Weighted the highest of any positive term by explicit user request ("more
  // strongly incorporate" the per-mode datasets) — see the mapPerformance comment above for why
  // that term was reduced to make room for this one rather than just stacking weight on top.
  modeWinRate: 0.22,
  // Class-counter matrix and draft-position/mode fit (Anti-Tank/Tank/Space Maker/Thrower/Sniper/
  // Control/Support), from a second, independent user-provided framework — see class-counters.ts.
  classCounter: 0.1,
  classPositionFit: 0.08,
  counterRiskPenalty: 0.15,
  redundancyPenalty: 0.1,
};

export const WEIGHTS_VERSION = "weights-2026.07-initial";

/**
 * Early picks should favor flexible, low-counter-exposure, generally strong Brawlers (little is
 * known about the enemy comp yet). Late picks should favor direct counter/synergy/composition
 * value (most of the draft is visible). Implemented as a linear blend between two weight
 * emphases rather than a step function, so recommendations change smoothly pick over pick
 * (spec section 6.5 / section 5 "recommendations change after every ban and pick").
 */
export function applyDraftPositionAdjustment(base: ScoreWeights, positionFactor: number): ScoreWeights {
  const clamped = Math.min(1, Math.max(0, positionFactor));
  return {
    ...base,
    draftFlexibility: base.draftFlexibility * (1.6 - 0.8 * clamped),
    mapPerformance: base.mapPerformance * (1.15 - 0.3 * clamped),
    // Same treatment as mapPerformance above and for the same reason: real overall strength in
    // this mode matters most when little else is known (first pick), and gradually cedes ground
    // to matchup-specific value as the draft reveals more of the enemy comp.
    modeWinRate: base.modeWinRate * (1.15 - 0.3 * clamped),
    matchupValue: base.matchupValue * (0.6 + 0.8 * clamped),
    compositionFit: base.compositionFit * (0.6 + 0.8 * clamped),
    roleCoverage: base.roleCoverage * (0.6 + 0.8 * clamped),
    archetypeCounter: base.archetypeCounter * (0.6 + 0.8 * clamped),
    classCounter: base.classCounter * (0.6 + 0.8 * clamped),
    counterRiskPenalty: base.counterRiskPenalty * (0.7 + 0.6 * clamped),
    // The drafting guide is explicit that doubling up on a class late in the draft is fine ("not
    // a huge issue... 2 of the same class can sometimes overwhelm their natural counters") — so
    // redundancy is penalized most early (while flexibility still matters) and least by the last
    // pick, the mirror image of counterRiskPenalty above.
    redundancyPenalty: base.redundancyPenalty * (1.2 - 0.6 * clamped),
  };
}
