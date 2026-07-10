import type { RoleTag } from "./types";

/**
 * A simplified 9-class drafting framework contributed by a user (a hand-made drafting guide, not
 * official Supercell terminology). Each class belongs to one of three archetypes, which counter
 * each other in a fixed rock-paper-scissors-style cycle:
 *
 *   AGGRESSIVE (Assassins, Speedsters, Tanks — make space via burst damage / mobility / raw HP)
 *     beats PASSIVE (Controllers, Sharpshooters, Support — win via range/AOE/utility)
 *       beats DEFENSIVE (Anti-Agro, Damage Dealers, Trappers — win by punishing overextension)
 *         beats AGGRESSIVE
 *
 * This is a curated heuristic layer, like the rest of src/lib/data/brawlers.ts's role tags — it
 * has no official statistical source and is always surfaced as heuristic (docs/data-sources.md).
 * "tank", "assassin", "controller", and "support" already existed as RoleTags before this guide was
 * incorporated; "speedster", "anti_agro", "damage_dealer", "trapper", and "sharpshooter" are new.
 * Reusing RoleTag (rather than a parallel taxonomy) means the existing role-coverage/composition/
 * redundancy scoring machinery automatically picks up class coverage for free.
 */
export type Archetype = "aggressive" | "defensive" | "passive";

export const CLASS_TAGS: RoleTag[] = [
  "assassin",
  "tank",
  "speedster",
  "anti_agro",
  "damage_dealer",
  "trapper",
  "controller",
  "sharpshooter",
  "support",
];

export const ARCHETYPE_OF_CLASS: Partial<Record<RoleTag, Archetype>> = {
  assassin: "aggressive",
  tank: "aggressive",
  speedster: "aggressive",
  anti_agro: "defensive",
  damage_dealer: "defensive",
  trapper: "defensive",
  controller: "passive",
  sharpshooter: "passive",
  support: "passive",
};

/** What each archetype beats, per the guide's diagram. */
export const BEATS: Record<Archetype, Archetype> = {
  aggressive: "passive",
  passive: "defensive",
  defensive: "aggressive",
};

function archetypeBeatenBy(target: Archetype): Archetype {
  const found = (Object.keys(BEATS) as Archetype[]).find((a) => BEATS[a] === target);
  if (!found) throw new Error(`No archetype found that beats ${target}`);
  return found;
}

export interface ArchetypeWeights {
  aggressive: number;
  defensive: number;
  passive: number;
}

const NEUTRAL_WEIGHTS: ArchetypeWeights = { aggressive: 1 / 3, defensive: 1 / 3, passive: 1 / 3 };

/**
 * Converts a Brawler's per-tag role weights into a normalized archetype distribution. A Brawler
 * with no class tags at all gets a neutral (1/3, 1/3, 1/3) distribution rather than zeros, so it
 * neither counters nor is countered by anything.
 */
export function archetypeWeightsFromRoleWeights(getWeight: (tag: RoleTag) => number): ArchetypeWeights {
  const raw: ArchetypeWeights = { aggressive: 0, defensive: 0, passive: 0 };
  for (const tag of CLASS_TAGS) {
    const archetype = ARCHETYPE_OF_CLASS[tag];
    if (!archetype) continue;
    raw[archetype] += Math.max(0, getWeight(tag));
  }
  const total = raw.aggressive + raw.defensive + raw.passive;
  if (total <= 0) return { ...NEUTRAL_WEIGHTS };
  return {
    aggressive: raw.aggressive / total,
    defensive: raw.defensive / total,
    passive: raw.passive / total,
  };
}

export function averageArchetypeWeights(list: ArchetypeWeights[]): ArchetypeWeights {
  if (list.length === 0) return { ...NEUTRAL_WEIGHTS };
  const sum = list.reduce(
    (acc, w) => ({
      aggressive: acc.aggressive + w.aggressive,
      defensive: acc.defensive + w.defensive,
      passive: acc.passive + w.passive,
    }),
    { aggressive: 0, defensive: 0, passive: 0 },
  );
  return {
    aggressive: sum.aggressive / list.length,
    defensive: sum.defensive / list.length,
    passive: sum.passive / list.length,
  };
}

/**
 * 0-1, centered on 0.5 (neutral). Above 0.5 means the candidate's archetype mix favorably counters
 * the opposing team's archetype mix per the cycle above; below 0.5 means the candidate's own
 * archetype mix is the one the opponent's mix tends to beat.
 */
export function archetypeCounterValue(candidate: ArchetypeWeights, opponentTeam: ArchetypeWeights): number {
  const archetypes: Archetype[] = ["aggressive", "defensive", "passive"];
  let counterScore = 0;
  let riskScore = 0;
  for (const a of archetypes) {
    counterScore += candidate[a] * opponentTeam[BEATS[a]];
    riskScore += candidate[a] * opponentTeam[archetypeBeatenBy(a)];
  }
  return Math.min(1, Math.max(0, 0.5 + (counterScore - riskScore) / 2));
}

/**
 * Which classes make the strongest true first pick (spec section 6.5 / the user-provided guide:
 * "the 1st pick of each mode should be the strongest of the most important class in that game
 * mode"), derived from the guide's own worked examples for the modes this prototype seeds
 * (src/lib/data/modes.ts). Heist/Hot Zone/Bounty examples from the guide aren't wired in yet
 * because those modes aren't part of this prototype's seeded mode list — add them here the same
 * way once they are.
 */
export const MODE_PRIORITY_CLASSES: Record<string, RoleTag[]> = {
  "gem-grab": ["assassin", "support", "anti_agro"],
  "brawl-ball": ["anti_agro", "speedster", "controller"],
  knockout: ["sharpshooter", "support"],
};
