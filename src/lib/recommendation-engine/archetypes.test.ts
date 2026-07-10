import { describe, expect, it } from "vitest";
import {
  archetypeCounterValue,
  archetypeWeightsFromRoleWeights,
  averageArchetypeWeights,
  BEATS,
} from "./archetypes";
import type { RoleTag } from "./types";

function pureWeights(tag: RoleTag) {
  return (queryTag: RoleTag) => (queryTag === tag ? 1 : 0);
}

describe("archetype counter cycle", () => {
  it("encodes exactly the rock-paper-scissors cycle from the guide", () => {
    expect(BEATS.aggressive).toBe("passive");
    expect(BEATS.passive).toBe("defensive");
    expect(BEATS.defensive).toBe("aggressive");
  });

  it("a pure aggressive Brawler (e.g. an assassin) counters a pure passive team (e.g. all support)", () => {
    const aggressive = archetypeWeightsFromRoleWeights(pureWeights("assassin"));
    const passive = archetypeWeightsFromRoleWeights(pureWeights("support"));
    expect(archetypeCounterValue(aggressive, passive)).toBeCloseTo(1, 5);
  });

  it("a pure aggressive Brawler is countered by a pure defensive team", () => {
    const aggressive = archetypeWeightsFromRoleWeights(pureWeights("tank"));
    const defensive = archetypeWeightsFromRoleWeights(pureWeights("trapper"));
    expect(archetypeCounterValue(aggressive, defensive)).toBeCloseTo(0, 5);
  });

  it("a pure passive Brawler counters a pure defensive team", () => {
    const passive = archetypeWeightsFromRoleWeights(pureWeights("controller"));
    const defensive = archetypeWeightsFromRoleWeights(pureWeights("damage_dealer"));
    expect(archetypeCounterValue(passive, defensive)).toBeCloseTo(1, 5);
  });

  it("a pure defensive Brawler counters a pure aggressive team", () => {
    const defensive = archetypeWeightsFromRoleWeights(pureWeights("anti_agro"));
    const aggressive = archetypeWeightsFromRoleWeights(pureWeights("speedster"));
    expect(archetypeCounterValue(defensive, aggressive)).toBeCloseTo(1, 5);
  });

  it("same archetype on both sides is neutral", () => {
    const a = archetypeWeightsFromRoleWeights(pureWeights("assassin"));
    const b = archetypeWeightsFromRoleWeights(pureWeights("tank")); // also aggressive
    expect(archetypeCounterValue(a, b)).toBeCloseTo(0.5, 5);
  });

  it("no opponent picks yet (neutral distribution) produces a neutral counter value", () => {
    const a = archetypeWeightsFromRoleWeights(pureWeights("assassin"));
    expect(archetypeCounterValue(a, averageArchetypeWeights([]))).toBeCloseTo(0.5, 5);
  });

  it("a Brawler with no class tags gets a neutral archetype distribution", () => {
    const none = archetypeWeightsFromRoleWeights(() => 0);
    expect(none.aggressive).toBeCloseTo(1 / 3, 5);
    expect(none.defensive).toBeCloseTo(1 / 3, 5);
    expect(none.passive).toBeCloseTo(1 / 3, 5);
  });
});

describe("averageArchetypeWeights", () => {
  it("averages multiple Brawlers' archetype distributions", () => {
    const assassin = archetypeWeightsFromRoleWeights(pureWeights("assassin")); // pure aggressive
    const support = archetypeWeightsFromRoleWeights(pureWeights("support")); // pure passive
    const avg = averageArchetypeWeights([assassin, support]);
    expect(avg.aggressive).toBeCloseTo(0.5, 5);
    expect(avg.passive).toBeCloseTo(0.5, 5);
    expect(avg.defensive).toBeCloseTo(0, 5);
  });
});
