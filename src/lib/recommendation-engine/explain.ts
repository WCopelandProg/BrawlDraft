import { getBrawlerMeta } from "@/lib/data/brawlers";
import type { ScoreBreakdown } from "./engine";
import type { BanScoreBreakdown } from "./ban";
import type { DEFAULT_BAN_WEIGHTS } from "./ban";
import type { PlayerAvailability, RecommendationReason, ScoreWeights } from "./types";

/**
 * Deterministic, templated explanations only (spec section 6.7) — never LLM-generated. Every
 * message here is produced directly from a score component so it can never contradict the score.
 */

const LOW_SAMPLE_THRESHOLD = 0.4;

function brawlerName(id: string): string {
  return getBrawlerMeta(id)?.name ?? id;
}

function roleLabel(tag: string): string {
  return tag.replace(/_/g, " ");
}

export function buildReasonsAndWarnings(
  candidateId: string,
  b: ScoreBreakdown,
  weights: ScoreWeights,
  availability: PlayerAvailability,
): { reasons: RecommendationReason[]; warnings: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];
  const warnings: RecommendationReason[] = [];

  const mapImpact = weights.mapPerformance * (b.mapPerformance - 0.5) * 2;
  if (mapImpact > 0.02) {
    const provenance = b.mapStatSource === "brawltime_export" ? " (real brawltime.ninja data)" : "";
    reasons.push({
      type: "map_strength",
      impact: mapImpact,
      message: `Strong performance on this map/mode (adjusted win rate ${(b.mapPerformance * 100).toFixed(0)}%)${provenance}.`,
    });
  }

  const matchupImpact = weights.matchupValue * (b.matchupValue - 0.5) * 2;
  if (matchupImpact > 0.02 && b.strongestCounterTargetId) {
    reasons.push({
      type: "enemy_counter",
      impact: matchupImpact,
      message: `Favorable historical matchup against ${brawlerName(b.strongestCounterTargetId)}.`,
    });
  }

  const synergyImpact = weights.allySynergy * (b.allySynergy - 0.5) * 2;
  if (synergyImpact > 0.02 && b.bestSynergyAllyId) {
    reasons.push({
      type: "ally_synergy",
      impact: synergyImpact,
      message: `Strong synergy alongside ${brawlerName(b.bestSynergyAllyId)}.`,
    });
  }

  const roleImpact = weights.roleCoverage * b.roleCoverage;
  if (roleImpact > 0.02 && b.missingRoleFilled) {
    reasons.push({
      type: "role_coverage",
      impact: roleImpact,
      message: `Adds the team's missing ${roleLabel(b.missingRoleFilled)} role.`,
    });
  }

  const flexImpact = weights.draftFlexibility * b.draftFlexibility;
  if (b.safeFirstPickWeight > 0.5 && flexImpact > 0.02) {
    reasons.push({
      type: "safe_first_pick",
      impact: flexImpact,
      message: "Versatile, low-risk pick with few hard counters visible yet.",
    });
  } else if (flexImpact > 0.02) {
    reasons.push({
      type: "flexibility",
      impact: flexImpact,
      message: "Flexible across multiple roles, keeping later picks open.",
    });
  }

  if (b.rankFitSignal > 0.15) {
    reasons.push({
      type: "rank_bracket_fit",
      impact: b.rankFitSignal * 0.06,
      message: `Tends to perform especially well at the ${b.rankBucketLabel} bracket.`,
    });
  } else if (b.rankFitSignal < -0.15) {
    warnings.push({
      type: "rank_bracket_fit",
      impact: b.rankFitSignal * 0.06,
      message: `Tends to underperform at the ${b.rankBucketLabel} bracket — easier for opponents to play around at this skill level.`,
    });
  }

  const metaImpact = weights.recentMetaStrength * (b.recentMetaStrength - 0.5) * 2;
  if (b.metaTrend === "buffed" && metaImpact > 0.01) {
    reasons.push({
      type: "recent_meta_shift",
      impact: metaImpact,
      message: "Recently buffed this patch — historical stats may understate current strength.",
    });
  } else if (b.metaTrend === "nerfed" && metaImpact < -0.01) {
    warnings.push({
      type: "recent_meta_shift",
      impact: metaImpact,
      message: "Recently nerfed this patch — historical stats may overstate current strength.",
    });
  }

  const counterRiskImpact = weights.counterRiskPenalty * b.counterRisk;
  if (counterRiskImpact > 0.02 && b.worstMatchupOpponentId) {
    warnings.push({
      type: "counter_risk",
      impact: -counterRiskImpact,
      message: `Vulnerable to ${brawlerName(b.worstMatchupOpponentId)}, a strong counter still available to the enemy.`,
    });
  }

  const redundancyImpact = weights.redundancyPenalty * b.redundancy;
  if (redundancyImpact > 0.02 && b.dominantRedundantTag) {
    warnings.push({
      type: "redundancy_warning",
      impact: -redundancyImpact,
      message: `Team already has strong ${roleLabel(b.dominantRedundantTag)} coverage; this pick may be redundant.`,
    });
  }

  if (b.statisticalConfidence < LOW_SAMPLE_THRESHOLD) {
    warnings.push({
      type: "low_sample_warning",
      impact: -(LOW_SAMPLE_THRESHOLD - b.statisticalConfidence),
      message: `Limited sample size (n=${b.sampleSize}) on this map/mode — confidence reduced.`,
    });
  }

  if (availability === "not_unlocked" || availability === "manually_excluded" || availability === "unlocked_underleveled") {
    warnings.push({
      type: "unavailable_to_player",
      impact: -1,
      message:
        availability === "not_unlocked"
          ? "Not unlocked for this player — shown for reference only."
          : availability === "manually_excluded"
            ? "Manually excluded by the player."
            : "Unlocked but underleveled — may underperform relative to this score.",
    });
  }

  reasons.sort((a, b2) => b2.impact - a.impact);
  warnings.sort((a, b2) => a.impact - b2.impact);

  return { reasons: reasons.slice(0, 3), warnings: warnings.slice(0, 2) };
}

export function buildBanReasonsAndWarnings(
  candidateId: string,
  b: BanScoreBreakdown,
  weights: typeof DEFAULT_BAN_WEIGHTS,
): { reasons: RecommendationReason[]; warnings: RecommendationReason[] } {
  const reasons: RecommendationReason[] = [];
  const warnings: RecommendationReason[] = [];

  const mapImpact = weights.opponentMapStrength * (b.opponentMapStrength - 0.5) * 2;
  if (mapImpact > 0.02) {
    reasons.push({
      type: "map_strength",
      impact: mapImpact,
      message: `Dominant on this map/mode (adjusted win rate ${(b.opponentMapStrength * 100).toFixed(0)}%) — a strong general ban.`,
    });
  }

  const threatImpact = weights.threatToAvailablePool * (b.threatToAvailablePool - 0.5) * 2;
  if (threatImpact > 0.02 && b.worstThreatenedAllyOptionId) {
    reasons.push({
      type: "opponent_threat",
      impact: threatImpact,
      message: `Threatens ${brawlerName(b.worstThreatenedAllyOptionId)}, one of our strongest remaining options.`,
    });
  }

  const scarcityImpact = weights.scarcityOfCounters * b.scarcityOfCounters;
  if (scarcityImpact > 0.02) {
    reasons.push({
      type: "scarce_counters",
      impact: scarcityImpact,
      message: "Few reliable counters remain in the available pool if left unbanned.",
    });
  }

  const flexImpact = weights.flexibility * b.flexibility;
  if (flexImpact > 0.02) {
    reasons.push({
      type: "flexibility",
      impact: flexImpact,
      message: "Flexible enough to be a strong opposing first pick on many maps.",
    });
  }

  const ownPickImpact = weights.ourOwnPickValue * b.ourOwnPickValue;
  if (ownPickImpact > 0.08) {
    warnings.push({
      type: "preserves_our_options",
      impact: -ownPickImpact,
      message: "We may want to pick this ourselves — banning it gives up that option.",
    });
  }

  reasons.sort((a, c) => c.impact - a.impact);
  warnings.sort((a, c) => a.impact - c.impact);

  return { reasons: reasons.slice(0, 3), warnings: warnings.slice(0, 2) };
}
