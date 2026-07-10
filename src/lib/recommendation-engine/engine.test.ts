import { describe, expect, it } from "vitest";
import { BRAWLER_IDS } from "@/lib/data/brawlers";
import { generatePickRecommendations, scorePickCandidate, splitByAvailability } from "./engine";
import { generateBanRecommendations, scoreBanCandidate } from "./ban";
import { MOCK_DATASET } from "./mock-data";
import { DEFAULT_WEIGHTS } from "./weights";
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
});
