import { BRAWLER_ROLE_FEATURES } from "@/lib/data/brawlers";
import type { RoleTag } from "./types";

/**
 * A second, independent classification framework a user shared with this project: a 7-class
 * reference image (Thrower / Tank / Space Maker / Anti-Tank / Support / Sniper / Control) plus a
 * companion drafting-strategy video explaining how the classes counter each other and when each is
 * safe to pick. Summarized here, not reproduced. It reuses this project's existing RoleTag values
 * rather than inventing new ones — "assassin" is the video's own name for "space maker", and
 * "tank_counter" is its name for "anti-tank".
 *
 * This is deliberately kept separate from the earlier Aggressive/Defensive/Passive archetype
 * system in archetypes.ts (a different user-provided guide) — both read the same underlying
 * RoleFeature tags without conflicting, and both contribute their own score term.
 */
export type CoreClass = "tank" | "assassin" | "tank_counter" | "controller" | "sharpshooter" | "thrower" | "support";

export const CORE_CLASS_TAGS: CoreClass[] = [
  "tank_counter",
  "assassin",
  "tank",
  "controller",
  "sharpshooter",
  "thrower",
  "support",
];

/**
 * Directed counter strength: CLASS_COUNTER_MATRIX[A][B] = how strongly class A beats class B, per
 * the video's stated relationships:
 *   - Anti-Tank (tank_counter) is the strongest class overall: it shuts down both Space Makers
 *     (its main purpose) and Tanks.
 *   - Tank beats Space Maker on a raw stat-check (more HP, similar damage, no way for the mobile
 *     Space Maker to burst through it).
 *   - Space Maker's mobility lets it run down Throwers, Snipers, and low-damage Control picks
 *     before they can use their range/utility.
 *   - Thrower can lob damage over walls at Tanks, who can't close the distance to punish it.
 *   - Sniper (real ones: Belle/Byron/Pierce/Bo-style) outranges Tank, Control, and even Anti-Tank.
 *   - Control punishes Anti-Tank at range/HP once it has established position.
 *   - Support has no direct counter target — its only real weakness is doing little damage itself.
 */
export const CLASS_COUNTER_MATRIX: Partial<Record<CoreClass, Partial<Record<CoreClass, number>>>> = {
  tank_counter: { assassin: 0.9, tank: 0.6 },
  tank: { assassin: 0.7 },
  assassin: { thrower: 0.8, sharpshooter: 0.5, controller: 0.4 },
  thrower: { tank: 0.5 },
  sharpshooter: { tank: 0.5, controller: 0.5, tank_counter: 0.4 },
  controller: { tank_counter: 0.5 },
  support: {},
};

/** The single class-tag with the highest curated weight for this Brawler, if any is present. */
export function dominantClass(getWeight: (tag: RoleTag) => number): CoreClass | undefined {
  let best: CoreClass | undefined;
  let bestWeight = 0;
  for (const tag of CORE_CLASS_TAGS) {
    const weight = getWeight(tag);
    if (weight > bestWeight) {
      bestWeight = weight;
      best = tag;
    }
  }
  return best;
}

/**
 * 0-1, centered on 0.5 (neutral): above 0.5 means the candidate's class favorably counters the
 * enemy's revealed classes per the matrix above; below 0.5 means the candidate's class is the one
 * being countered. Neutral when either side has no classified Brawler yet.
 */
export function classCounterValue(
  candidateClass: CoreClass | undefined,
  enemyClasses: Array<CoreClass | undefined>,
): number {
  const relevant = enemyClasses.filter((c): c is CoreClass => c !== undefined);
  if (!candidateClass || relevant.length === 0) return 0.5;
  let counter = 0;
  let risk = 0;
  for (const enemyClass of relevant) {
    counter += CLASS_COUNTER_MATRIX[candidateClass]?.[enemyClass] ?? 0;
    risk += CLASS_COUNTER_MATRIX[enemyClass]?.[candidateClass] ?? 0;
  }
  counter /= relevant.length;
  risk /= relevant.length;
  return Math.min(1, Math.max(0, 0.5 + (counter - risk) / 2));
}

/**
 * The video's mode-strategy split: Brawl Ball/Gem Grab/Hot Zone/Heist share one drafting template
 * (the best available Anti-Tank is nearly always the correct first pick, since real Snipers/
 * Control/Throwers besides the class's own named exceptions barely see play). Bounty/Knockout
 * behave differently — no single class dominates first pick, Throwers and Snipers are far more
 * viable, and Tanks lose most of their raw-stat-check value. Heist/Hot Zone/Bounty aren't part of
 * this prototype's original seeded mode list; see src/lib/data/modes.ts for the current set.
 */
export const AGGRO_META_MODE_IDS = new Set(["gem-grab", "brawl-ball", "hot-zone", "heist"]);
export const PASSIVE_META_MODE_IDS = new Set(["bounty", "knockout"]);

export function isAggroMetaMode(modeId: string): boolean {
  return AGGRO_META_MODE_IDS.has(modeId);
}

export function isPassiveMetaMode(modeId: string): boolean {
  return PASSIVE_META_MODE_IDS.has(modeId);
}

export interface ClassPositionFitInput {
  candidateClass: CoreClass | undefined;
  modeId: string;
  isFirstPick: boolean;
  isLastPick: boolean;
  allyDominantClasses: Array<CoreClass | undefined>;
}

/**
 * 0-1, centered on 0.5. Encodes the video's explicit draft-position rules for specific classes:
 *   - Thrower is a strong pick on the literal last pick and a serious liability any earlier — it
 *     gets run down by a Space Maker before its own strength (huge damage/utility once safe) ever
 *     comes online.
 *   - Control is a weak first pick everywhere — too little damage to survive a rush before it can
 *     set up position.
 *   - The best available Anti-Tank is a strong first pick specifically in the four "aggro-meta"
 *     modes (not Bounty/Knockout).
 *   - Anti-Tank and Space Maker reinforce each other (the video's core combo: Anti-Tank denies the
 *     enemy's Space Makers, which sets up your own Space Maker pick later) — a small bonus when
 *     the ally side already has one and the candidate is the other.
 */
export function classPositionFit(input: ClassPositionFitInput): number {
  const { candidateClass, modeId, isFirstPick, isLastPick, allyDominantClasses } = input;
  let value = 0.5;
  if (candidateClass === "thrower") {
    value += isLastPick ? 0.35 : -0.35;
  }
  if (candidateClass === "controller" && isFirstPick) {
    value -= 0.25;
  }
  if (candidateClass === "tank_counter" && isFirstPick && isAggroMetaMode(modeId)) {
    value += 0.3;
  }
  if (candidateClass === "assassin" && allyDominantClasses.includes("tank_counter")) {
    value += 0.15;
  }
  if (candidateClass === "tank_counter" && allyDominantClasses.includes("assassin")) {
    value += 0.15;
  }
  return Math.min(1, Math.max(0, value));
}

/** Human-readable label for each class, using the framework's own names (e.g. "Anti-Tank" for tank_counter). */
export const CLASS_DISPLAY_NAMES: Record<CoreClass, string> = {
  tank_counter: "Anti-Tank",
  assassin: "Space Maker",
  tank: "Tank",
  controller: "Control",
  sharpshooter: "Sniper",
  thrower: "Thrower",
  support: "Support",
};

/** A Brawler's single dominant class from its curated RoleFeature tags, for UI display. */
export function getBrawlerClass(brawlerId: string): CoreClass | undefined {
  const features = BRAWLER_ROLE_FEATURES[brawlerId] ?? [];
  return dominantClass((tag) => features.find((f) => f.tag === tag)?.weight ?? 0);
}

export function getBrawlerClassLabel(brawlerId: string): string | undefined {
  const cls = getBrawlerClass(brawlerId);
  return cls ? CLASS_DISPLAY_NAMES[cls] : undefined;
}
