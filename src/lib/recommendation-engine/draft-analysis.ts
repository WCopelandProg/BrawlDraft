import { getBrawlerMeta } from "@/lib/data/brawlers";
import { scoreBanCandidate } from "./ban";
import { CLASS_DISPLAY_NAMES, dominantClass, type CoreClass } from "./class-counters";
import { scorePickCandidate } from "./engine";
import type { BrawlerRecommendation, DraftRecommendationContext, RecommendationDataset, RecommendationReason, RoleTag } from "./types";

/**
 * Post-draft summary (spec-adjacent, added per direct user request): once every ban/pick is in,
 * grade the draft 0-100, surface a plain-language "what went well / what to improve" list, and
 * estimate each team's win probability. Deliberately reuses scorePickCandidate/scoreBanCandidate —
 * the exact same scoring this app already surfaces live during the draft — rather than inventing a
 * second, parallel notion of "good pick." Every pick/ban is re-scored with full hindsight: the
 * complete final roster for both teams is already known, unlike the live in-draft recommendations
 * which only ever see what's been revealed so far.
 *
 * Like every other score in this app, this is a heuristic estimate built from curated/real signals
 * (see docs/data-sources.md), not a calibrated win-probability model — the UI must say so.
 */

export interface DraftAnalysisInput {
  mapId: string;
  modeId: string;
  rankBucket: string;
  allyPicks: string[];
  enemyPicks: string[];
  allyBans: string[];
  enemyBans: string[];
}

export interface TeamDraftGrade {
  /** 0-100, 0 = worst possible draft+bans, 100 = best possible, given the opposing team's actual final roster. */
  score: number;
  scoreLabel: string;
  /** 0-1 heuristic win-probability estimate for this team, clamped to [0.05, 0.95] (never a claim of certainty). */
  winProbability: number;
  /** What went well, most impactful first — same shape/rendering convention as pick-time reasons. */
  strengths: RecommendationReason[];
  /** What to improve, most impactful first — same shape/rendering convention as pick-time warnings. */
  tips: RecommendationReason[];
}

export interface DraftAnalysis {
  ally: TeamDraftGrade;
  enemy: TeamDraftGrade;
}

function roleWeight(dataset: RecommendationDataset, brawlerId: string, tag: RoleTag): number {
  return dataset.getRoleFeatures(brawlerId).find((f) => f.tag === tag)?.weight ?? 0;
}

function teamDominantClasses(dataset: RecommendationDataset, picks: string[]): CoreClass[] {
  return picks
    .map((id) => dominantClass((tag) => roleWeight(dataset, id, tag)))
    .filter((c): c is CoreClass => c !== undefined);
}

function brawlerName(id: string): string {
  return getBrawlerMeta(id)?.name ?? id;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent draft";
  if (score >= 65) return "Strong draft";
  if (score >= 50) return "Balanced draft";
  if (score >= 35) return "Shaky draft";
  return "Weak draft";
}

/**
 * Re-scores every one of a team's own picks with full hindsight (the complete final roster on
 * both sides is already known), evaluating each pick against the rest of its own final team, not
 * just the allies that had already been picked when it actually happened. picksSoFar is pinned to
 * the last-pick position deliberately: a post-draft grade should weight every pick as "judged with
 * everything now known," which is exactly what this app's late-pick weighting already means.
 */
function evaluateOwnPicks(
  ownPicks: string[],
  oppPicks: string[],
  ownBans: string[],
  oppBans: string[],
  base: Pick<DraftAnalysisInput, "mapId" | "modeId" | "rankBucket">,
  dataset: RecommendationDataset,
): { brawlerId: string; rec: BrawlerRecommendation }[] {
  const totalPicksInFormat = ownPicks.length + oppPicks.length;
  return ownPicks.map((brawlerId, i) => {
    const others = ownPicks.filter((_, idx) => idx !== i);
    const ctx: DraftRecommendationContext = {
      mapId: base.mapId,
      modeId: base.modeId,
      rankBucket: base.rankBucket,
      team: "ally",
      action: "pick",
      allyPicks: others,
      enemyPicks: oppPicks,
      allBanned: [...ownBans, ...oppBans],
      allPicked: [...others, ...oppPicks],
      picksSoFar: Math.max(0, totalPicksInFormat - 1),
      totalPicksInFormat,
    };
    return { brawlerId, rec: scorePickCandidate(brawlerId, ctx, dataset) };
  });
}

/**
 * Re-scores a team's own bans. Evaluated with no picks known yet (allyPicks/enemyPicks empty) —
 * this app's ban-enabled formats always resolve bans before any picks, so that's the historically
 * faithful information state, not an approximation.
 */
function evaluateOwnBans(
  ownBans: string[],
  oppBans: string[],
  base: Pick<DraftAnalysisInput, "mapId" | "modeId" | "rankBucket">,
  dataset: RecommendationDataset,
): { brawlerId: string; rec: BrawlerRecommendation }[] {
  return ownBans.map((brawlerId, i) => {
    const others = ownBans.filter((_, idx) => idx !== i);
    const ctx: DraftRecommendationContext = {
      mapId: base.mapId,
      modeId: base.modeId,
      rankBucket: base.rankBucket,
      team: "ally",
      action: "ban",
      allyPicks: [],
      enemyPicks: [],
      allBanned: [...others, ...oppBans],
      allPicked: [],
      picksSoFar: 0,
      totalPicksInFormat: 0,
    };
    return { brawlerId, rec: scoreBanCandidate(brawlerId, ctx, dataset) };
  });
}

/** Structural, composition-level tips that don't come from any single pick's own reason/warning list. */
function structuralTips(dataset: RecommendationDataset, ownPicks: string[], oppPicks: string[]): RecommendationReason[] {
  const tips: RecommendationReason[] = [];
  if (ownPicks.length === 0) return tips;

  const ownClasses = teamDominantClasses(dataset, ownPicks);
  const oppClasses = teamDominantClasses(dataset, oppPicks);

  const oppHasThreat = oppClasses.some((c) => c === "tank" || c === "assassin");
  if (oppHasThreat && !ownClasses.includes("tank_counter")) {
    tips.push({
      type: "class_counter",
      impact: -0.5,
      message: "Your final team has no Anti-Tank — a real gap against the enemy's Tank/Space Maker picks.",
    });
  }

  const classCounts = new Map<CoreClass, number>();
  for (const c of ownClasses) classCounts.set(c, (classCounts.get(c) ?? 0) + 1);
  for (const [cls, count] of classCounts) {
    if (count >= 3) {
      tips.push({
        type: "redundancy_warning",
        impact: -0.3,
        message: `Heavy on ${CLASS_DISPLAY_NAMES[cls]} — ${count} of your picks share this class, which one clean counter can punish repeatedly.`,
      });
    }
  }
  return tips;
}

/** Collapses per-pick/per-ban reasons or warnings into a team-level list: best/worst first, one entry per type, brawler-attributed. */
function collapseTeamReasons(
  entries: { brawlerId: string; rec: BrawlerRecommendation }[],
  pick: "reasons" | "warnings",
  extra: RecommendationReason[],
): RecommendationReason[] {
  const byType = new Map<string, RecommendationReason & { brawlerId?: string }>();
  for (const { brawlerId, rec } of entries) {
    for (const reason of rec[pick]) {
      const existing = byType.get(reason.type);
      const moreExtreme =
        pick === "reasons" ? reason.impact > (existing?.impact ?? -Infinity) : reason.impact < (existing?.impact ?? Infinity);
      if (!existing || moreExtreme) {
        byType.set(reason.type, { ...reason, brawlerId, message: `${brawlerName(brawlerId)}: ${reason.message}` });
      }
    }
  }
  for (const reason of extra) {
    byType.set(`${reason.type}-structural-${byType.size}`, reason);
  }
  const combined = [...byType.values()];
  combined.sort((a, b) => (pick === "reasons" ? b.impact - a.impact : a.impact - b.impact));
  return combined.slice(0, 4).map(({ brawlerId: _drop, ...reason }) => reason);
}

function gradeTeam(
  ownPicks: string[],
  oppPicks: string[],
  ownBans: string[],
  oppBans: string[],
  base: Pick<DraftAnalysisInput, "mapId" | "modeId" | "rankBucket">,
  dataset: RecommendationDataset,
): { grade: Omit<TeamDraftGrade, "winProbability">; pickAvg: number } {
  const pickEntries = evaluateOwnPicks(ownPicks, oppPicks, ownBans, oppBans, base, dataset);
  const banEntries = evaluateOwnBans(ownBans, oppBans, base, dataset);

  const pickAvg = average(pickEntries.map((e) => e.rec.score)) ?? 0.5;
  const banAvg = average(banEntries.map((e) => e.rec.score));
  const combined = banEntries.length > 0 ? 0.7 * pickAvg + 0.3 * (banAvg ?? 0.5) : pickAvg;
  const score = Math.round(clamp01(combined) * 100);

  const extraTips = structuralTips(dataset, ownPicks, oppPicks);
  const strengths = collapseTeamReasons([...pickEntries, ...banEntries], "reasons", []);
  const tips = collapseTeamReasons([...pickEntries, ...banEntries], "warnings", extraTips);

  return { grade: { score, scoreLabel: scoreLabel(score), strengths, tips }, pickAvg };
}

/** Converts a pick-quality gap into a bounded win-probability estimate — a heuristic curve, not a calibrated model. */
function winProbabilityFromPickAvgGap(diff: number): number {
  const k = 6;
  const raw = 1 / (1 + Math.exp(-k * diff));
  return Math.min(0.95, Math.max(0.05, raw));
}

export function analyzeDraft(input: DraftAnalysisInput, dataset: RecommendationDataset): DraftAnalysis {
  const base = { mapId: input.mapId, modeId: input.modeId, rankBucket: input.rankBucket };
  const allyResult = gradeTeam(input.allyPicks, input.enemyPicks, input.allyBans, input.enemyBans, base, dataset);
  const enemyResult = gradeTeam(input.enemyPicks, input.allyPicks, input.enemyBans, input.allyBans, base, dataset);

  const diff = allyResult.pickAvg - enemyResult.pickAvg;
  const allyWinProbability = winProbabilityFromPickAvgGap(diff);
  const enemyWinProbability = 1 - allyWinProbability;

  return {
    ally: { ...allyResult.grade, winProbability: allyWinProbability },
    enemy: { ...enemyResult.grade, winProbability: enemyWinProbability },
  };
}
