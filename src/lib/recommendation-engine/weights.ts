import type { ScoreWeights } from "./types";

/**
 * Starting values only, per spec section 6 — not permanent truth. In a future backend these
 * would be loaded from `recommendation_weight_versions` (docs/implementation-plan.md) so they
 * can be tuned without a code deploy. They are exported as a plain object here so Phase 3+ can
 * swap the source without changing any call site.
 */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  mapPerformance: 0.2,
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
    matchupValue: base.matchupValue * (0.6 + 0.8 * clamped),
    compositionFit: base.compositionFit * (0.6 + 0.8 * clamped),
    roleCoverage: base.roleCoverage * (0.6 + 0.8 * clamped),
    archetypeCounter: base.archetypeCounter * (0.6 + 0.8 * clamped),
    counterRiskPenalty: base.counterRiskPenalty * (0.7 + 0.6 * clamped),
    // The drafting guide is explicit that doubling up on a class late in the draft is fine ("not
    // a huge issue... 2 of the same class can sometimes overwhelm their natural counters") — so
    // redundancy is penalized most early (while flexibility still matters) and least by the last
    // pick, the mirror image of counterRiskPenalty above.
    redundancyPenalty: base.redundancyPenalty * (1.2 - 0.6 * clamped),
  };
}
