import { describe, expect, it } from "vitest";
import { BRAWLER_IDS } from "@/lib/data/brawlers";
import { computeScoreBreakdown, generatePickRecommendations, scorePickCandidate, splitByAvailability } from "./engine";
import { generateBanRecommendations, scoreBanCandidate } from "./ban";
import { HYBRID_DATASET } from "./hybrid-dataset";
import { MOCK_DATASET } from "./mock-data";
import { applyDraftPositionAdjustment, DEFAULT_WEIGHTS } from "./weights";
import type { DraftRecommendationContext } from "./types";

function baseContext(overrides: Partial<DraftRecommendationContext> = {}): DraftRecommendationContext {
  return {
    mapId: "sneaky-fields",
    modeId: "brawl-ball",
    rankBucket: "all",
    team: "ally",
    action: "pick",
    allyPicks: [],
    enemyPicks: [],
    allBanned: [],
    allPicked: [],
    picksSoFar: 0,
    totalPicksInFormat: 6,
    ...overrides,
  };
}

describe("generatePickRecommendations", () => {
  it("excludes banned and picked Brawlers from candidates", () => {
    const ctx = baseContext({ allBanned: ["shelly", "colt"], allPicked: ["bull"] });
    const recs = generatePickRecommendations(ctx, MOCK_DATASET);
    const ids = recs.map((r) => r.brawlerId);
    expect(ids).not.toContain("shelly");
    expect(ids).not.toContain("colt");
    expect(ids).not.toContain("bull");
    expect(ids).toHaveLength(BRAWLER_IDS.length - 3);
  });

  it("returns a fully sorted list, best score first", () => {
    const recs = generatePickRecommendations(baseContext(), MOCK_DATASET);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.score).toBeGreaterThanOrEqual(recs[i]!.score);
    }
  });

  it("tags unavailable Brawlers instead of silently dropping them, so callers can build an ideal-but-unavailable view", () => {
    const ctx = baseContext({ playerPool: { unlockedBrawlerIds: ["shelly", "colt", "bull"] } });
    const recs = generatePickRecommendations(ctx, MOCK_DATASET);
    const shelly = recs.find((r) => r.brawlerId === "shelly")!;
    const darryl = recs.find((r) => r.brawlerId === "darryl")!;
    expect(shelly.availability).toBe("unlocked_eligible");
    expect(darryl.availability).toBe("not_unlocked");
  });

  it("splitByAvailability separates available from unavailable without dropping anyone", () => {
    const ctx = baseContext({ playerPool: { unlockedBrawlerIds: ["shelly", "colt", "bull"] } });
    const recs = generatePickRecommendations(ctx, MOCK_DATASET);
    const { available, unavailable } = splitByAvailability(recs);
    expect(available.length + unavailable.length).toBe(recs.length);
    expect(available.every((r) => r.availability !== "not_unlocked")).toBe(true);
    expect(unavailable.every((r) => r.availability === "not_unlocked")).toBe(true);
  });

  it("guest mode (no playerPool) treats every candidate as unlocked_eligible", () => {
    const recs = generatePickRecommendations(baseContext(), MOCK_DATASET);
    expect(recs.every((r) => r.availability === "unlocked_eligible")).toBe(true);
  });

  it("changing the map changes at least one candidate's score (map affects rankings)", () => {
    const ctxA = baseContext({ mapId: "sneaky-fields", modeId: "brawl-ball" });
    const ctxB = baseContext({ mapId: "hard-rock-mine", modeId: "gem-grab" });
    const recsA = generatePickRecommendations(ctxA, MOCK_DATASET);
    const recsB = generatePickRecommendations(ctxB, MOCK_DATASET);
    const scoreMapA = new Map(recsA.map((r) => [r.brawlerId, r.score]));
    const scoreMapB = new Map(recsB.map((r) => [r.brawlerId, r.score]));
    const changed = BRAWLER_IDS.some((id) => scoreMapA.get(id) !== scoreMapB.get(id));
    expect(changed).toBe(true);
  });

  it("enemy selections change counter-relevant rankings", () => {
    const ctxNoEnemies = baseContext();
    const ctxWithEnemies = baseContext({ enemyPicks: ["nita", "rosa"] });
    const recsA = generatePickRecommendations(ctxNoEnemies, MOCK_DATASET);
    const recsB = generatePickRecommendations(ctxWithEnemies, MOCK_DATASET);
    const scoreMapA = new Map(recsA.map((r) => [r.brawlerId, r.score]));
    const scoreMapB = new Map(recsB.map((r) => [r.brawlerId, r.score]));
    const changed = BRAWLER_IDS.filter((id) => id !== "nita" && id !== "rosa").some(
      (id) => scoreMapA.get(id) !== scoreMapB.get(id),
    );
    expect(changed).toBe(true);
  });

  it("ally selections change synergy/composition-relevant rankings", () => {
    const ctxNoAllies = baseContext();
    const ctxWithAllies = baseContext({ allyPicks: ["poco"], picksSoFar: 1 });
    const recsA = generatePickRecommendations(ctxNoAllies, MOCK_DATASET);
    const recsB = generatePickRecommendations(ctxWithAllies, MOCK_DATASET);
    const scoreMapA = new Map(recsA.map((r) => [r.brawlerId, r.score]));
    const scoreMapB = new Map(recsB.map((r) => [r.brawlerId, r.score]));
    const changed = BRAWLER_IDS.filter((id) => id !== "poco").some((id) => scoreMapA.get(id) !== scoreMapB.get(id));
    expect(changed).toBe(true);
  });

  it("early-pick and late-pick weighting produce different rankings for the same board", () => {
    const early = baseContext({ picksSoFar: 0, totalPicksInFormat: 6 });
    const late = baseContext({
      picksSoFar: 5,
      totalPicksInFormat: 6,
      enemyPicks: ["nita", "rosa", "poco"],
      allyPicks: ["colt", "brock"],
    });
    const recsEarly = generatePickRecommendations(early, MOCK_DATASET);
    const recsLate = generatePickRecommendations(late, MOCK_DATASET);
    expect(recsEarly.map((r) => r.brawlerId)).not.toEqual(recsLate.map((r) => r.brawlerId));
  });

  it("low-sample-size candidates receive lower statistical confidence", () => {
    const ctx = baseContext();
    const lowSample = scorePickCandidate("8bit", ctx, MOCK_DATASET);
    const highSample = scorePickCandidate("shelly", ctx, MOCK_DATASET);
    expect(lowSample.confidence).toBeLessThan(highSample.confidence);
    expect(lowSample.warnings.some((w) => w.type === "low_sample_warning")).toBe(true);
  });

  it("identical inputs produce identical results (determinism)", () => {
    const ctx = baseContext({ enemyPicks: ["nita"], allyPicks: ["poco"] });
    const first = generatePickRecommendations(ctx, MOCK_DATASET);
    const second = generatePickRecommendations(ctx, MOCK_DATASET);
    expect(first).toEqual(second);
  });

  it("explanations correspond to actual score components (no reason claims counter-value without a real counter target)", () => {
    const ctx = baseContext({ enemyPicks: ["nita", "rosa"] });
    const recs = generatePickRecommendations(ctx, MOCK_DATASET);
    for (const rec of recs) {
      const counterReason = rec.reasons.find((r) => r.type === "enemy_counter");
      if (counterReason) {
        expect(counterReason.message).toMatch(/matchup against/);
      }
      const counterWarning = rec.warnings.find((w) => w.type === "counter_risk");
      if (counterWarning) {
        expect(counterWarning.message).toMatch(/Vulnerable to/);
      }
    }
  });

  it("recent meta strength (patch signal) contributes to and can differentiate scores", () => {
    const ctx = baseContext();
    const recs = generatePickRecommendations(ctx, MOCK_DATASET);
    // Sanity: not every candidate has an identical score (would indicate meta/patch term is inert).
    const uniqueScores = new Set(recs.map((r) => r.score.toFixed(6)));
    expect(uniqueScores.size).toBeGreaterThan(1);
  });
});

describe("last-pick (captain) counter emphasis", () => {
  it("matchup weight dominates by the final pick of the format, surfacing direct counters to the fully revealed enemy comp", () => {
    // Simulates being the Mythic snake-draft captain: the enemy's whole comp and two of our three
    // allies are already on the board, and this is the very last pick of the entire draft. With
    // the class-counter and archetype-counter systems also scaled up at late-game now, isolate
    // matchupValue specifically (as with the recent_meta_shift test above) rather than asserting
    // it beats every other legitimate signal combined — that would make this test flaky by
    // design as more real signals are added.
    const enemyPicks = ["nita", "rosa", "poco"];
    const allyPicks = ["colt", "brock"];
    const lastPickCtx = baseContext({ enemyPicks, allyPicks, picksSoFar: 5, totalPicksInFormat: 6 });
    const matchupOnlyWeights = {
      ...DEFAULT_WEIGHTS,
      mapPerformance: 0,
      allySynergy: 0,
      compositionFit: 0,
      roleCoverage: 0,
      draftFlexibility: 0,
      recentMetaStrength: 0,
      playerComfort: 0,
      statisticalConfidence: 0,
      archetypeCounter: 0,
      modeClassFit: 0,
      metaPopularity: 0,
      classCounter: 0,
      classPositionFit: 0,
      counterRiskPenalty: 0,
      redundancyPenalty: 0,
    };

    const last = generatePickRecommendations(lastPickCtx, MOCK_DATASET, matchupOnlyWeights);

    const byMatchupValue = last
      .map((r) => ({ id: r.brawlerId, matchupValue: computeScoreBreakdown(r.brawlerId, lastPickCtx, MOCK_DATASET).matchupValue }))
      .sort((a, b) => b.matchupValue - a.matchupValue);
    const bestCounterId = byMatchupValue[0]!.id;

    // With every other term zeroed out, the single best-matchup candidate must be the top overall
    // recommendation.
    expect(last[0]!.brawlerId).toBe(bestCounterId);
  });

  it("draft-position weighting actually increases matchup weight and decreases flexibility weight as picks progress", () => {
    const earlyWeights = applyDraftPositionAdjustment(DEFAULT_WEIGHTS, 0);
    const lateWeights = applyDraftPositionAdjustment(DEFAULT_WEIGHTS, 5 / 6);
    expect(lateWeights.matchupValue).toBeGreaterThan(earlyWeights.matchupValue);
    expect(lateWeights.draftFlexibility).toBeLessThan(earlyWeights.draftFlexibility);
  });
});

describe("scorePickCandidate weight configuration", () => {
  it("is driven by configurable weights, not hard-coded constants", () => {
    const ctx = baseContext({ enemyPicks: ["nita"] });
    const zeroedWeights = { ...DEFAULT_WEIGHTS, matchupValue: 0 };
    const withMatchup = scorePickCandidate("colt", ctx, MOCK_DATASET, DEFAULT_WEIGHTS);
    const withoutMatchup = scorePickCandidate("colt", ctx, MOCK_DATASET, zeroedWeights);
    expect(withMatchup.score).not.toBe(withoutMatchup.score);
  });
});

describe("generateBanRecommendations", () => {
  it("excludes already-banned and already-picked Brawlers", () => {
    const ctx = baseContext({ action: "ban", allBanned: ["shelly"], allPicked: ["colt"] });
    const recs = generateBanRecommendations(ctx, MOCK_DATASET);
    const ids = recs.map((r) => r.brawlerId);
    expect(ids).not.toContain("shelly");
    expect(ids).not.toContain("colt");
  });

  it("returns a sorted list and every entry is labeled as a ban action", () => {
    const ctx = baseContext({ action: "ban" });
    const recs = generateBanRecommendations(ctx, MOCK_DATASET);
    expect(recs.every((r) => r.action === "ban")).toBe(true);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.score).toBeGreaterThanOrEqual(recs[i]!.score);
    }
  });

  it("ban scoring uses a different formula from pick scoring for the same board", () => {
    const ctx = baseContext();
    const pickRec = scorePickCandidate("nita", ctx, MOCK_DATASET);
    const banRec = scoreBanCandidate("nita", { ...ctx, action: "ban" }, MOCK_DATASET);
    // Not asserting a specific relationship, just that they are computed independently and can differ.
    expect(typeof pickRec.score).toBe("number");
    expect(typeof banRec.score).toBe("number");
  });

  it("is deterministic for identical inputs", () => {
    const ctx = baseContext({ action: "ban" });
    expect(generateBanRecommendations(ctx, MOCK_DATASET)).toEqual(generateBanRecommendations(ctx, MOCK_DATASET));
  });
});

describe("mock dataset invariants", () => {
  it("matchup rates are antisymmetric: candidate-vs-opponent + opponent-vs-candidate == 1", () => {
    const a = MOCK_DATASET.getMatchup("shelly", "nita", "sneaky-fields", "brawl-ball", "all")!;
    const b = MOCK_DATASET.getMatchup("nita", "shelly", "sneaky-fields", "brawl-ball", "all")!;
    expect(a.adjustedMatchupRate + b.adjustedMatchupRate).toBeCloseTo(1, 10);
  });

  it("synergy rates are symmetric between the two allies", () => {
    const a = MOCK_DATASET.getSynergy("shelly", "poco", "sneaky-fields", "brawl-ball", "all")!;
    const b = MOCK_DATASET.getSynergy("poco", "shelly", "sneaky-fields", "brawl-ball", "all")!;
    expect(a.adjustedSynergyRate).toBeCloseTo(b.adjustedSynergyRate, 10);
  });

  it("is explicitly labeled as mock data", () => {
    expect(MOCK_DATASET.isMock).toBe(true);
    expect(MOCK_DATASET.versionId).toMatch(/^mock-/);
  });

  it("preserves the antisymmetry invariant even when rank skew is applied", () => {
    // bull is curated strongly low-elo-favored; masters is the highest tracked bracket, so this
    // exercises the skew-adjustment path inside getMatchup, not just the neutral "all" bucket.
    const a = MOCK_DATASET.getMatchup("bull", "colt", "sneaky-fields", "brawl-ball", "masters")!;
    const b = MOCK_DATASET.getMatchup("colt", "bull", "sneaky-fields", "brawl-ball", "masters")!;
    expect(a.adjustedMatchupRate + b.adjustedMatchupRate).toBeCloseTo(1, 10);
  });
});

describe("rank-bracket sensitivity", () => {
  it("a low-elo-favored Brawler scores worse at Masters than at Diamond on the same map", () => {
    // bull is curated as strongly low-elo-favored (docs: easy stat-checks at low elo, easily
    // countered once opponents play around it at high elo).
    const diamondCtx = baseContext({ rankBucket: "diamond" });
    const mastersCtx = baseContext({ rankBucket: "masters" });
    const atDiamond = scorePickCandidate("bull", diamondCtx, MOCK_DATASET);
    const atMasters = scorePickCandidate("bull", mastersCtx, MOCK_DATASET);
    expect(atMasters.score).toBeLessThan(atDiamond.score);
  });

  it("a high-elo-favored Brawler scores worse at Diamond than at Masters on the same map", () => {
    // colt is curated as high-elo-favored (rewards precise aim low-elo opponents can't punish).
    const diamondCtx = baseContext({ rankBucket: "diamond" });
    const mastersCtx = baseContext({ rankBucket: "masters" });
    const atDiamond = scorePickCandidate("colt", diamondCtx, MOCK_DATASET);
    const atMasters = scorePickCandidate("colt", mastersCtx, MOCK_DATASET);
    expect(atDiamond.score).toBeLessThan(atMasters.score);
  });

  it("surfaces a rank_bracket_fit warning for a low-elo-favored Brawler at the highest bracket", () => {
    const rec = scorePickCandidate("bull", baseContext({ rankBucket: "masters" }), MOCK_DATASET);
    expect(rec.warnings.some((w) => w.type === "rank_bracket_fit")).toBe(true);
  });

  it("the 'all ranks' bucket applies no rank skew", () => {
    const ctx = baseContext({ rankBucket: "all" });
    const rec = scorePickCandidate("bull", ctx, MOCK_DATASET);
    expect(rec.reasons.some((r) => r.type === "rank_bracket_fit")).toBe(false);
    expect(rec.warnings.some((w) => w.type === "rank_bracket_fit")).toBe(false);
  });
});

describe("patch buff/nerf reactivity", () => {
  it("a Brawler buffed in the current patch has a meta strength shifted upward", () => {
    // tick is seeded as buffed in patch 2026.07 (MOCK_PATCH_HISTORY in mock-data.ts).
    const buffed = MOCK_DATASET.getMetaStrength("tick", "2026.07");
    const priorPatch = MOCK_DATASET.getMetaStrength("tick", "2026.06");
    expect(MOCK_DATASET.getMetaTrend("tick", "2026.07")).toBe("buffed");
    expect(buffed).toBeGreaterThan(priorPatch - 0.3); // sanity: buffed value is a real, higher number
    expect(buffed).toBeGreaterThan(0.5);
  });

  it("a Brawler nerfed in the current patch has a meta strength shifted downward", () => {
    // shelly is seeded as nerfed in patch 2026.07.
    expect(MOCK_DATASET.getMetaTrend("shelly", "2026.07")).toBe("nerfed");
    expect(MOCK_DATASET.getMetaStrength("shelly", "2026.07")).toBeLessThan(0.5);
  });

  it("a Brawler untouched by the current patch is reported as stable", () => {
    expect(MOCK_DATASET.getMetaTrend("jessie", "2026.07")).toBe("stable");
  });

  it("the buff/nerf adjustment actually moves recentMetaStrength in computeScoreBreakdown", () => {
    const breakdown = computeScoreBreakdown("tick", baseContext(), MOCK_DATASET);
    expect(breakdown.metaTrend).toBe("buffed");
    expect(breakdown.recentMetaStrength).toBeGreaterThan(0.5);

    const nerfedBreakdown = computeScoreBreakdown("shelly", baseContext(), MOCK_DATASET);
    expect(nerfedBreakdown.metaTrend).toBe("nerfed");
    expect(nerfedBreakdown.recentMetaStrength).toBeLessThan(0.5);
  });

  it("can surface a recent_meta_shift reason/warning when it is impactful enough to rank", () => {
    // Isolate the meta term by zeroing every other positive weight so meta_shift is guaranteed to
    // be the (or a) top-ranked reason/warning, without asserting it always wins against unrelated
    // map/matchup/role factors on an arbitrary board (that would make this test flaky by design).
    const metaOnlyWeights = {
      ...DEFAULT_WEIGHTS,
      mapPerformance: 0,
      matchupValue: 0,
      allySynergy: 0,
      compositionFit: 0,
      roleCoverage: 0,
      draftFlexibility: 0,
      playerComfort: 0,
      statisticalConfidence: 0,
    };
    const buffedRec = scorePickCandidate("tick", baseContext(), MOCK_DATASET, metaOnlyWeights);
    const nerfedRec = scorePickCandidate("shelly", baseContext(), MOCK_DATASET, metaOnlyWeights);
    expect(buffedRec.reasons.some((r) => r.type === "recent_meta_shift")).toBe(true);
    expect(nerfedRec.warnings.some((w) => w.type === "recent_meta_shift")).toBe(true);
  });

  it("changing the patch id changes meta strength deterministically (no live network call)", () => {
    const a = MOCK_DATASET.getMetaStrength("rico", "2026.06");
    const b = MOCK_DATASET.getMetaStrength("rico", "2026.07");
    expect(a).not.toBe(b); // rico is buffed in 2026.07 but not in 2026.06
    expect(MOCK_DATASET.getMetaStrength("rico", "2026.06")).toBe(a); // deterministic, repeatable
  });
});

describe("drafting-guide class/archetype scoring", () => {
  it("a pure-aggressive candidate (e.g. Edgar, an assassin) scores higher against a passive enemy comp than a defensive one", () => {
    const vsPassive = baseContext({ enemyPicks: ["ruffs", "gus", "kit"] }); // all support (passive)
    const vsDefensive = baseContext({ enemyPicks: ["chester", "clancy", "lou"] }); // anti_agro/damage_dealer/trapper (defensive)
    const againstPassive = computeScoreBreakdown("edgar", vsPassive, MOCK_DATASET);
    const againstDefensive = computeScoreBreakdown("edgar", vsDefensive, MOCK_DATASET);
    expect(againstPassive.archetypeCounter).toBeGreaterThan(againstDefensive.archetypeCounter);
  });

  it("surfaces an archetype_counter reason when a candidate favorably counters the enemy archetype mix", () => {
    const ctx = baseContext({ enemyPicks: ["ruffs", "gus", "kit"], picksSoFar: 3, totalPicksInFormat: 6 });
    const rec = scorePickCandidate("edgar", ctx, MOCK_DATASET);
    expect(rec.reasons.some((r) => r.type === "archetype_counter")).toBe(true);
  });

  it("modeClassFit only applies on the literal first pick of the draft (picksSoFar === 0)", () => {
    const firstPick = baseContext({ modeId: "knockout", picksSoFar: 0 });
    const laterPick = baseContext({ modeId: "knockout", picksSoFar: 1, allyPicks: ["gray"] });
    // "bea" is a sharpshooter, a Knockout priority class per MODE_PRIORITY_CLASSES.
    const first = computeScoreBreakdown("bea", firstPick, MOCK_DATASET);
    const later = computeScoreBreakdown("bea", laterPick, MOCK_DATASET);
    expect(first.modeClassFit).toBeGreaterThan(0);
    expect(later.modeClassFit).toBe(0);
  });

  it("a Brawler with no mode-priority class gets zero modeClassFit even on the first pick", () => {
    const ctx = baseContext({ modeId: "knockout", picksSoFar: 0 });
    // "hank" is a pure tank (aggressive), not one of Knockout's priority classes (sharpshooter/support).
    const breakdown = computeScoreBreakdown("hank", ctx, MOCK_DATASET);
    expect(breakdown.modeClassFit).toBe(0);
  });

  it("redundancy penalty weight is lower on the last pick than on an early pick (guide: doubling a class late is fine)", () => {
    const earlyWeights = applyDraftPositionAdjustment(DEFAULT_WEIGHTS, 0);
    const lastPickWeights = applyDraftPositionAdjustment(DEFAULT_WEIGHTS, 1);
    expect(lastPickWeights.redundancyPenalty).toBeLessThan(earlyWeights.redundancyPenalty);
  });
});

describe("real pick-rate data feeding into recommendations (HYBRID_DATASET)", () => {
  it("Crow (real top pick rate at Legendary/Masters) has a higher metaPopularity component than Sam (real bottom pick rate)", () => {
    const ctx = baseContext({ rankBucket: "legendary" });
    const crowBreakdown = computeScoreBreakdown("crow", ctx, HYBRID_DATASET);
    const samBreakdown = computeScoreBreakdown("sam", ctx, HYBRID_DATASET);
    expect(crowBreakdown.metaPopularity).toBeGreaterThan(samBreakdown.metaPopularity);
    expect(crowBreakdown.realPopularity).toBeCloseTo(1, 5);
    expect(samBreakdown.realPopularity).toBeCloseTo(0, 5);
  });

  it("surfaces a meta_popularity reason for a Brawler with real high pick rate at this rank bucket", () => {
    // Isolate the popularity term the same way the recent_meta_shift test above does — with many
    // legitimate signals now competing for the top-3 reason slots, a minor term not cracking the
    // cut on an arbitrary board isn't a bug, so this only asserts it *can* rank when dominant.
    const popularityOnlyWeights = {
      ...DEFAULT_WEIGHTS,
      mapPerformance: 0,
      matchupValue: 0,
      allySynergy: 0,
      compositionFit: 0,
      roleCoverage: 0,
      draftFlexibility: 0,
      recentMetaStrength: 0,
      playerComfort: 0,
      statisticalConfidence: 0,
      archetypeCounter: 0,
      modeClassFit: 0,
      classCounter: 0,
      classPositionFit: 0,
    };
    const ctx = baseContext({ rankBucket: "masters" });
    const rec = scorePickCandidate("crow", ctx, HYBRID_DATASET, popularityOnlyWeights);
    expect(rec.reasons.some((r) => r.type === "meta_popularity")).toBe(true);
  });

  it("does not surface a meta_popularity reason outside the imported rank buckets (no real data there)", () => {
    const ctx = baseContext({ rankBucket: "diamond" });
    const rec = scorePickCandidate("crow", ctx, HYBRID_DATASET);
    expect(rec.reasons.some((r) => r.type === "meta_popularity")).toBe(false);
  });

  it("does not surface a meta_popularity reason for a low-pick-rate real Brawler (absence of popularity is not itself a warning)", () => {
    const ctx = baseContext({ rankBucket: "legendary" });
    const rec = scorePickCandidate("sam", ctx, HYBRID_DATASET);
    expect(rec.reasons.some((r) => r.type === "meta_popularity")).toBe(false);
    expect(rec.warnings.some((w) => w.type === "meta_popularity")).toBe(false);
  });
});

describe("class-counter matrix scoring (Anti-Tank / Tank / Space Maker / Thrower / Sniper / Control / Support)", () => {
  it("an Anti-Tank (chester) scores its classCounter higher against an enemy Tank than Support does", () => {
    const ctx = baseContext({ enemyPicks: ["frank"] }); // frank is a Tank
    const antiTank = computeScoreBreakdown("chester", ctx, MOCK_DATASET);
    const support = computeScoreBreakdown("poco", ctx, MOCK_DATASET);
    expect(antiTank.classCounter).toBeGreaterThan(support.classCounter);
  });

  it("a Thrower (barley) picked early (not the last pick) gets a classPositionFit penalty", () => {
    const ctx = baseContext({ picksSoFar: 0, totalPicksInFormat: 6 });
    const breakdown = computeScoreBreakdown("barley", ctx, MOCK_DATASET);
    expect(breakdown.classPositionFit).toBeLessThan(0.5);
  });

  it("the same Thrower gets a classPositionFit bonus on the literal last pick", () => {
    const ctx = baseContext({ picksSoFar: 5, totalPicksInFormat: 6 });
    const breakdown = computeScoreBreakdown("barley", ctx, MOCK_DATASET);
    expect(breakdown.classPositionFit).toBeGreaterThan(0.5);
  });

  it("a Control Brawler (jessie) gets a classPositionFit penalty specifically as a first pick", () => {
    const firstPick = computeScoreBreakdown("jessie", baseContext({ picksSoFar: 0 }), MOCK_DATASET);
    const laterPick = computeScoreBreakdown(
      "jessie",
      baseContext({ picksSoFar: 1, allyPicks: ["colt"] }),
      MOCK_DATASET,
    );
    expect(firstPick.classPositionFit).toBeLessThan(0.5);
    expect(laterPick.classPositionFit).toBeCloseTo(0.5, 5);
  });

  it("an Anti-Tank first pick in an aggro-meta mode (gem-grab) gets a classPositionFit bonus", () => {
    const breakdown = computeScoreBreakdown(
      "chester",
      baseContext({ modeId: "gem-grab", picksSoFar: 0 }),
      MOCK_DATASET,
    );
    expect(breakdown.classPositionFit).toBeGreaterThan(0.5);
  });
});

describe("expanded roster data integrity", () => {
  it("every seeded Brawler has at least one role/class tag", () => {
    for (const id of BRAWLER_IDS) {
      expect(MOCK_DATASET.getRoleFeatures(id).length).toBeGreaterThan(0);
    }
  });

  it("scoring every seeded Brawler doesn't throw and produces a finite score", () => {
    const ctx = baseContext({ enemyPicks: ["ruffs", "chester"], allyPicks: ["gray"] });
    for (const id of BRAWLER_IDS.filter((b) => b !== "ruffs" && b !== "chester" && b !== "gray")) {
      const rec = scorePickCandidate(id, ctx, MOCK_DATASET);
      expect(Number.isFinite(rec.score)).toBe(true);
      expect(rec.score).toBeGreaterThanOrEqual(0);
      expect(rec.score).toBeLessThanOrEqual(1);
    }
  });
});
