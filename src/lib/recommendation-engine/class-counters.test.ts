import { describe, expect, it } from "vitest";
import {
  classCounterValue,
  classPositionFit,
  dominantClass,
  isAggroMetaMode,
  isPassiveMetaMode,
} from "./class-counters";
import type { RoleTag } from "./types";

function weightsOf(tag: RoleTag) {
  return (queryTag: RoleTag) => (queryTag === tag ? 1 : 0);
}

describe("dominantClass", () => {
  it("picks the highest-weighted class tag", () => {
    expect(dominantClass((tag) => (tag === "tank_counter" ? 0.9 : tag === "sharpshooter" ? 0.4 : 0))).toBe(
      "tank_counter",
    );
  });

  it("returns undefined when no class tag has any weight", () => {
    expect(dominantClass(() => 0)).toBeUndefined();
  });
});

describe("classCounterValue", () => {
  it("Anti-Tank (tank_counter) counters an enemy Space Maker (assassin) strongly", () => {
    expect(classCounterValue("tank_counter", ["assassin"])).toBeGreaterThan(0.5);
  });

  it("Anti-Tank counters an enemy Tank", () => {
    expect(classCounterValue("tank_counter", ["tank"])).toBeGreaterThan(0.5);
  });

  it("Tank counters an enemy Space Maker", () => {
    expect(classCounterValue("tank", ["assassin"])).toBeGreaterThan(0.5);
  });

  it("Space Maker counters an enemy Thrower", () => {
    expect(classCounterValue("assassin", ["thrower"])).toBeGreaterThan(0.5);
  });

  it("Thrower is countered by (loses to) an enemy Space Maker", () => {
    expect(classCounterValue("thrower", ["assassin"])).toBeLessThan(0.5);
  });

  it("is neutral when the enemy has no classified Brawlers yet", () => {
    expect(classCounterValue("tank_counter", [])).toBeCloseTo(0.5, 5);
  });

  it("is neutral when the candidate has no class", () => {
    expect(classCounterValue(undefined, ["tank"])).toBeCloseTo(0.5, 5);
  });

  it("averages across multiple enemy classes", () => {
    const value = classCounterValue("tank_counter", ["assassin", "tank"]);
    expect(value).toBeGreaterThan(0.5);
  });
});

describe("mode-meta grouping", () => {
  it("classifies the four aggro-meta modes correctly", () => {
    expect(isAggroMetaMode("brawl-ball")).toBe(true);
    expect(isAggroMetaMode("gem-grab")).toBe(true);
    expect(isAggroMetaMode("hot-zone")).toBe(true);
    expect(isAggroMetaMode("heist")).toBe(true);
  });

  it("classifies Bounty and Knockout as passive-meta modes, not aggro", () => {
    expect(isPassiveMetaMode("bounty")).toBe(true);
    expect(isPassiveMetaMode("knockout")).toBe(true);
    expect(isAggroMetaMode("bounty")).toBe(false);
    expect(isAggroMetaMode("knockout")).toBe(false);
  });
});

describe("classPositionFit", () => {
  const base = {
    modeId: "brawl-ball",
    isFirstPick: false,
    isLastPick: false,
    allyDominantClasses: [] as Array<import("./class-counters").CoreClass | undefined>,
  };

  it("penalizes a Thrower picked before the last pick", () => {
    const value = classPositionFit({ ...base, candidateClass: "thrower" });
    expect(value).toBeLessThan(0.5);
  });

  it("rewards a Thrower picked on the literal last pick", () => {
    const value = classPositionFit({ ...base, candidateClass: "thrower", isLastPick: true });
    expect(value).toBeGreaterThan(0.5);
  });

  it("penalizes Control as a first pick", () => {
    const value = classPositionFit({ ...base, candidateClass: "controller", isFirstPick: true });
    expect(value).toBeLessThan(0.5);
  });

  it("does not penalize Control outside the first pick", () => {
    const value = classPositionFit({ ...base, candidateClass: "controller", isFirstPick: false });
    expect(value).toBeCloseTo(0.5, 5);
  });

  it("rewards Anti-Tank as a first pick in an aggro-meta mode", () => {
    const value = classPositionFit({ ...base, candidateClass: "tank_counter", isFirstPick: true, modeId: "gem-grab" });
    expect(value).toBeGreaterThan(0.5);
  });

  it("does not reward Anti-Tank as a first pick in a passive-meta mode", () => {
    const value = classPositionFit({ ...base, candidateClass: "tank_counter", isFirstPick: true, modeId: "knockout" });
    expect(value).toBeCloseTo(0.5, 5);
  });

  it("rewards the Anti-Tank + Space Maker combo in both directions", () => {
    const spaceMakerAfterAntiTank = classPositionFit({
      ...base,
      candidateClass: "assassin",
      allyDominantClasses: ["tank_counter"],
    });
    const antiTankAfterSpaceMaker = classPositionFit({
      ...base,
      candidateClass: "tank_counter",
      allyDominantClasses: ["assassin"],
    });
    expect(spaceMakerAfterAntiTank).toBeGreaterThan(0.5);
    expect(antiTankAfterSpaceMaker).toBeGreaterThan(0.5);
  });
});
