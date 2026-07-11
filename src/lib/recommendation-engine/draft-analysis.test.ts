import { describe, expect, it } from "vitest";
import { analyzeDraft, scoreLabel } from "./draft-analysis";
import { HYBRID_DATASET } from "./hybrid-dataset";
import { MOCK_DATASET } from "./mock-data";
import type { DraftAnalysisInput } from "./draft-analysis";

function baseInput(overrides: Partial<DraftAnalysisInput> = {}): DraftAnalysisInput {
  return {
    mapId: "hard-rock-mine",
    modeId: "gem-grab",
    rankBucket: "all",
    allyPicks: [],
    enemyPicks: [],
    allyBans: [],
    enemyBans: [],
    ...overrides,
  };
}

describe("scoreLabel", () => {
  it("buckets scores into the expected labels", () => {
    expect(scoreLabel(95)).toBe("Excellent draft");
    expect(scoreLabel(70)).toBe("Strong draft");
    expect(scoreLabel(55)).toBe("Balanced draft");
    expect(scoreLabel(40)).toBe("Shaky draft");
    expect(scoreLabel(10)).toBe("Weak draft");
  });
});

describe("analyzeDraft — basic invariants", () => {
  it("returns a 0-100 integer score and a probability in [0.05, 0.95] for both teams", () => {
    const input = baseInput({
      allyPicks: ["shelly", "colt", "bull"],
      enemyPicks: ["nita", "poco", "brock"],
      allyBans: ["barley"],
      enemyBans: ["rosa"],
    });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    for (const team of [analysis.ally, analysis.enemy]) {
      expect(Number.isInteger(team.score)).toBe(true);
      expect(team.score).toBeGreaterThanOrEqual(0);
      expect(team.score).toBeLessThanOrEqual(100);
      expect(team.winProbability).toBeGreaterThanOrEqual(0.05);
      expect(team.winProbability).toBeLessThanOrEqual(0.95);
    }
  });

  it("win probabilities for both teams always sum to 1", () => {
    const input = baseInput({
      allyPicks: ["shelly", "colt", "bull"],
      enemyPicks: ["nita", "poco", "brock"],
    });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    expect(analysis.ally.winProbability + analysis.enemy.winProbability).toBeCloseTo(1, 10);
  });

  it("is deterministic for identical inputs", () => {
    const input = baseInput({ allyPicks: ["shelly", "colt"], enemyPicks: ["nita", "poco"] });
    expect(analyzeDraft(input, MOCK_DATASET)).toEqual(analyzeDraft(input, MOCK_DATASET));
  });

  it("does not throw and returns a neutral-ish score for an empty draft", () => {
    const analysis = analyzeDraft(baseInput(), MOCK_DATASET);
    expect(analysis.ally.score).toBe(50);
    expect(analysis.ally.winProbability).toBeCloseTo(0.5, 5);
  });
});

describe("analyzeDraft — real per-mode win rate drives the score and win prediction", () => {
  it("a team of real high-winrate Brawlers in Gem Grab scores higher than a team of real low-winrate Brawlers", () => {
    const input = baseInput({
      modeId: "gem-grab",
      allyPicks: ["mrp", "angelo", "willow"], // 76.9%, 71.1%, 66.7% real win rate in gem-grab
      enemyPicks: ["bonnie", "gray", "belle"], // 0%, 13.3%, 7.4% real win rate in gem-grab
    });
    const analysis = analyzeDraft(input, HYBRID_DATASET);
    expect(analysis.ally.score).toBeGreaterThan(analysis.enemy.score);
    expect(analysis.ally.winProbability).toBeGreaterThan(0.5);
    expect(analysis.enemy.winProbability).toBeLessThan(0.5);
  });

  it("surfaces a mode_win_rate strength for the real high-winrate team", () => {
    const input = baseInput({
      modeId: "gem-grab",
      allyPicks: ["mrp", "angelo", "willow"],
      enemyPicks: ["bonnie", "gray", "belle"],
    });
    const analysis = analyzeDraft(input, HYBRID_DATASET);
    expect(analysis.ally.strengths.some((r) => r.type === "mode_win_rate")).toBe(true);
  });
});

describe("analyzeDraft — structural tips", () => {
  it("flags a missing Anti-Tank when the enemy has a Tank/Space Maker and the ally doesn't have an Anti-Tank", () => {
    const input = baseInput({
      allyPicks: ["gray", "belle", "angelo"], // support / sharpshooter / sharpshooter — no tank_counter
      enemyPicks: ["frank", "bull", "jacky"], // tank / assassin / tank
    });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    expect(analysis.ally.tips.some((t) => t.message.toLowerCase().includes("anti-tank"))).toBe(true);
  });

  it("does not flag a missing Anti-Tank when the ally already has one", () => {
    const input = baseInput({
      allyPicks: ["willow", "belle", "angelo"], // willow is tank_counter-dominant
      enemyPicks: ["frank", "bull", "jacky"],
    });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    expect(analysis.ally.tips.some((t) => t.message.toLowerCase().includes("no anti-tank"))).toBe(false);
  });

  it("flags heavy redundancy when 3+ picks share the same dominant class", () => {
    const input = baseInput({
      allyPicks: ["gray", "belle", "angelo"], // all sharpshooter-dominant... gray is support-dominant actually
      enemyPicks: ["shelly", "colt", "bull"],
    });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    // belle + angelo are both sharpshooter; gray is support, so this specific trio isn't 3-of-a-kind —
    // use a trio that genuinely is instead.
    const redundantInput = baseInput({
      allyPicks: ["belle", "angelo", "byron"],
      enemyPicks: ["shelly", "colt", "bull"],
    });
    const redundantAnalysis = analyzeDraft(redundantInput, MOCK_DATASET);
    expect(redundantAnalysis.ally.tips.some((t) => t.type === "redundancy_warning")).toBe(true);
    expect(analysis).toBeDefined();
  });
});

describe("analyzeDraft — no-ban format", () => {
  it("still produces a valid grade when a team has no bans at all", () => {
    const input = baseInput({ allyPicks: ["shelly", "colt", "bull"], enemyPicks: ["nita", "poco", "brock"] });
    const analysis = analyzeDraft(input, MOCK_DATASET);
    expect(analysis.ally.score).toBeGreaterThanOrEqual(0);
    expect(analysis.ally.score).toBeLessThanOrEqual(100);
  });
});
