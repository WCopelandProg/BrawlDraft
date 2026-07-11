import { BRAWLER_IDS } from "@/lib/data/brawlers";
import { computeScoreBreakdown, scorePickCandidate } from "./engine";
import { buildBanReasonsAndWarnings } from "./explain";
import type { BrawlerRecommendation, DraftRecommendationContext, ModeStatsDetail, RecommendationDataset } from "./types";

/**
 * Ban scoring is intentionally a different formula from pick scoring (spec section 6.6) — a good
 * ban is often a Brawler that's dangerous *for the enemy to have available*, not one our own team
 * necessarily wants. Starting weights, not permanent truth, same as DEFAULT_WEIGHTS.
 *
 * modeMetaScore (the source's own composite win-rate + pick-rate ranking, this app's real proxy
 * for "S tier") is weighted the highest of any positive term, by explicit user request: bans
 * should "consistently reflect... the best and most meta brawlers... the S tier and highest win
 * rate brawlers." An earlier version of this weighting used raw modeWinRate as the dominant term,
 * which surfaced rarely-played, small-sample outliers (a Brawler with a handful of real games and
 * a lucky win rate) instead of the mode's actual best/most-played Brawlers — modeMetaScore doesn't
 * have that failure mode, since a real tier-list-style composite already discounts low-pick-rate
 * noise. modeWinRate is kept as a smaller supporting signal, not removed outright.
 */
export const DEFAULT_BAN_WEIGHTS = {
  opponentMapStrength: 0.15,
  modeMetaScore: 0.4,
  modeWinRate: 0.15,
  threatToAvailablePool: 0.15,
  scarcityOfCounters: 0.1,
  flexibility: 0.1,
  recentMetaStrength: 0.05,
  ourOwnPickValue: 0.2, // subtracted: banning something we ourselves want to pick wastes the ban
};

export interface BanScoreBreakdown {
  opponentMapStrength: number;
  /** Real per-mode composite-score percentile where imported, neutral (0.5) otherwise — see getModeMetaPercentile. This app's "S tier" proxy and the dominant ban signal. */
  modeMetaScore: number;
  realModeMetaScore?: number;
  /** Real per-mode win rate where imported, neutral (0.5) otherwise — see getModeWinRate. */
  modeWinRate: number;
  realModeWinRate?: number;
  modeStatsDetail?: ModeStatsDetail;
  threatToAvailablePool: number;
  scarcityOfCounters: number;
  flexibility: number;
  recentMetaStrength: number;
  ourOwnPickValue: number;
  worstThreatenedAllyOptionId?: string;
}

function computeBanBreakdown(
  candidateId: string,
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
): BanScoreBreakdown {
  const mapStat = dataset.getMapStat(candidateId, ctx.mapId, ctx.modeId, ctx.rankBucket);
  const opponentMapStrength = mapStat?.adjustedWinRate ?? 0.5;

  const realModeMetaScore = dataset.getModeMetaPercentile(candidateId, ctx.modeId);
  const modeMetaScore = realModeMetaScore ?? 0.5;
  const realModeWinRate = dataset.getModeWinRate(candidateId, ctx.modeId);
  const modeWinRate = realModeWinRate ?? 0.5;
  const modeStatsDetail = dataset.getModeStatsDetail(candidateId, ctx.modeId);

  const excluded = new Set([...ctx.allBanned, ...ctx.allPicked, candidateId]);
  const ourRemainingPool = BRAWLER_IDS.filter((id) => !excluded.has(id));

  // How badly would this Brawler (if left available to the enemy) beat our remaining options?
  let threatToAvailablePool = 0.5;
  let worstThreatenedAllyOptionId: string | undefined;
  if (ourRemainingPool.length > 0) {
    const matchupsAgainstUs = ourRemainingPool
      .map((ourId) => ({ ourId, rec: dataset.getMatchup(candidateId, ourId, ctx.mapId, ctx.modeId, ctx.rankBucket) }))
      .filter((m): m is { ourId: string; rec: NonNullable<typeof m.rec> } => Boolean(m.rec));
    if (matchupsAgainstUs.length > 0) {
      threatToAvailablePool =
        matchupsAgainstUs.reduce((sum, m) => sum + m.rec.adjustedMatchupRate, 0) / matchupsAgainstUs.length;
      const worst = matchupsAgainstUs.reduce((a, b) => (b.rec.adjustedMatchupRate > a.rec.adjustedMatchupRate ? b : a));
      if (worst.rec.adjustedMatchupRate > 0.55) worstThreatenedAllyOptionId = worst.ourId;
    }
  }

  // How hard would it be for us to counter-pick this Brawler later if we don't ban it now?
  let scarcityOfCounters = 0.5;
  if (ourRemainingPool.length > 0) {
    const ourBestMatchup = Math.max(
      0,
      ...ourRemainingPool.map((ourId) => {
        const rec = dataset.getMatchup(ourId, candidateId, ctx.mapId, ctx.modeId, ctx.rankBucket);
        return rec?.adjustedMatchupRate ?? 0.5;
      }),
    );
    scarcityOfCounters = 1 - Math.min(1, Math.max(0, ourBestMatchup - 0.5) * 2);
  }

  const breakdown = computeScoreBreakdown(candidateId, ctx, dataset);
  const flexibility = breakdown.draftFlexibility;
  const recentMetaStrength = breakdown.recentMetaStrength;

  const ourPickPerspective = scorePickCandidate(
    candidateId,
    { ...ctx, team: "ally", action: "pick" },
    dataset,
  );
  const ourOwnPickValue = ourPickPerspective.score;

  return {
    opponentMapStrength,
    modeMetaScore,
    realModeMetaScore,
    modeWinRate,
    realModeWinRate,
    modeStatsDetail,
    threatToAvailablePool,
    scarcityOfCounters,
    flexibility,
    recentMetaStrength,
    ourOwnPickValue,
    worstThreatenedAllyOptionId,
  };
}

export function scoreBanCandidate(
  candidateId: string,
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
  weights = DEFAULT_BAN_WEIGHTS,
): BrawlerRecommendation {
  const breakdown = computeBanBreakdown(candidateId, ctx, dataset);
  const positive =
    weights.opponentMapStrength * breakdown.opponentMapStrength +
    weights.modeMetaScore * breakdown.modeMetaScore +
    weights.modeWinRate * breakdown.modeWinRate +
    weights.threatToAvailablePool * breakdown.threatToAvailablePool +
    weights.scarcityOfCounters * breakdown.scarcityOfCounters +
    weights.flexibility * breakdown.flexibility +
    weights.recentMetaStrength * breakdown.recentMetaStrength;
  const score = Math.min(1, Math.max(0, positive - weights.ourOwnPickValue * breakdown.ourOwnPickValue));

  const mapStat = dataset.getMapStat(candidateId, ctx.mapId, ctx.modeId, ctx.rankBucket);
  const { reasons, warnings } = buildBanReasonsAndWarnings(candidateId, breakdown, weights);

  return {
    brawlerId: candidateId,
    action: "ban",
    score,
    confidence: mapStat?.confidenceScore ?? 0.3,
    availability: "unknown", // ban targets are enemy-relevant; player availability isn't meaningful here
    reasons,
    warnings,
  };
}

function legalBanCandidateIds(ctx: DraftRecommendationContext): string[] {
  const excluded = new Set([...ctx.allBanned, ...ctx.allPicked]);
  return BRAWLER_IDS.filter((id) => !excluded.has(id));
}

export function generateBanRecommendations(
  ctx: DraftRecommendationContext,
  dataset: RecommendationDataset,
  weights = DEFAULT_BAN_WEIGHTS,
): BrawlerRecommendation[] {
  return legalBanCandidateIds(ctx)
    .map((id) => scoreBanCandidate(id, ctx, dataset, weights))
    .sort((a, b) => b.score - a.score);
}
