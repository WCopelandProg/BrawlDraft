import type { RoleFeature } from "@/lib/recommendation-engine/types";

/**
 * Seeded by hand for the Phase 1/2 prototype (docs/data-sources.md section 2). A real deployment
 * replaces the id/name/rarity fields with a synced copy of GET /v1/brawlers in Phase 3. Role tags
 * have no official API source and remain hand-curated even after that sync — they are always
 * surfaced as heuristic, never as statistical, per spec section 6.2.
 */
export interface BrawlerMeta {
  id: string;
  name: string;
  rarity: string;
  /** Marks Brawlers deliberately seeded with a low mock sample size, to exercise low-confidence UI. */
  recentlyReleased?: boolean;
}

export const BRAWLERS: BrawlerMeta[] = [
  { id: "shelly", name: "Shelly", rarity: "Starting Brawler" },
  { id: "colt", name: "Colt", rarity: "Rare" },
  { id: "bull", name: "Bull", rarity: "Rare" },
  { id: "brock", name: "Brock", rarity: "Super Rare" },
  { id: "elprimo", name: "El Primo", rarity: "Super Rare" },
  { id: "barley", name: "Barley", rarity: "Super Rare" },
  { id: "poco", name: "Poco", rarity: "Rare" },
  { id: "rosa", name: "Rosa", rarity: "Super Rare" },
  { id: "jessie", name: "Jessie", rarity: "Rare" },
  { id: "nita", name: "Nita", rarity: "Starting Brawler" },
  { id: "dynamike", name: "Dynamike", rarity: "Rare" },
  { id: "tick", name: "Tick", rarity: "Epic" },
  { id: "8bit", name: "8-Bit", rarity: "Epic", recentlyReleased: true },
  { id: "rico", name: "Rico", rarity: "Epic" },
  { id: "penny", name: "Penny", rarity: "Epic" },
  { id: "darryl", name: "Darryl", rarity: "Super Rare" },
  // Added to cover the Brawlers named in a user-provided drafting guide (see
  // src/lib/recommendation-engine/archetypes.ts). Rarity isn't verified for these — it's cosmetic
  // display text only, never used in scoring — so it's marked "Unverified" rather than guessed.
  { id: "edgar", name: "Edgar", rarity: "Unverified" },
  { id: "gigi", name: "Gigi", rarity: "Unverified", recentlyReleased: true },
  { id: "alli", name: "Alli", rarity: "Unverified", recentlyReleased: true },
  { id: "frank", name: "Frank", rarity: "Unverified" },
  { id: "hank", name: "Hank", rarity: "Unverified" },
  { id: "bibi", name: "Bibi", rarity: "Unverified" },
  { id: "kaze", name: "Kaze", rarity: "Unverified", recentlyReleased: true },
  { id: "shade", name: "Shade", rarity: "Unverified" },
  { id: "otis", name: "Otis", rarity: "Unverified" },
  { id: "maisie", name: "Maisie", rarity: "Unverified" },
  { id: "chester", name: "Chester", rarity: "Unverified" },
  { id: "clancy", name: "Clancy", rarity: "Unverified" },
  { id: "amber", name: "Amber", rarity: "Unverified" },
  { id: "lumi", name: "Lumi", rarity: "Unverified" },
  { id: "lou", name: "Lou", rarity: "Unverified" },
  { id: "charlie", name: "Charlie", rarity: "Unverified" },
  { id: "ruffs", name: "Ruffs", rarity: "Unverified" },
  { id: "max", name: "Max", rarity: "Unverified" },
  { id: "belle", name: "Belle", rarity: "Unverified" },
  { id: "nani", name: "Nani", rarity: "Unverified" },
  { id: "angelo", name: "Angelo", rarity: "Unverified" },
  { id: "emz", name: "Emz", rarity: "Unverified" },
  { id: "mortis", name: "Mortis", rarity: "Unverified" },
  { id: "lily", name: "Lily", rarity: "Unverified" },
  { id: "gene", name: "Gene", rarity: "Unverified" },
  { id: "mina", name: "Mina", rarity: "Unverified" },
  { id: "gray", name: "Gray", rarity: "Unverified" },
  { id: "gus", name: "Gus", rarity: "Unverified" },
  { id: "pierce", name: "Pierce", rarity: "Unverified" },
  { id: "jaeyong", name: "JaeYong", rarity: "Unverified", recentlyReleased: true },
  { id: "finx", name: "Finx", rarity: "Unverified", recentlyReleased: true },
  { id: "bea", name: "Bea", rarity: "Unverified" },
  { id: "griff", name: "Griff", rarity: "Unverified" },
  { id: "stu", name: "Stu", rarity: "Unverified" },
  { id: "meeple", name: "Meeple", rarity: "Unverified" },
  { id: "sirius", name: "Sirius", rarity: "Unverified" },
  { id: "kit", name: "Kit", rarity: "Unverified" },
  // Added to match every Brawler appearing in a real, user-provided brawltime.ninja pick-rate
  // export (data/brawltime/legendary-masters-pickrate.csv) so that real data actually applies
  // broadly, not just to the guide's named Brawlers. Same "Unverified" rarity convention as above.
  { id: "crow", name: "Crow", rarity: "Unverified" },
  { id: "meg", name: "Meg", rarity: "Unverified" },
  { id: "starrnova", name: "Starr Nova", rarity: "Unverified", recentlyReleased: true },
  { id: "colette", name: "Colette", rarity: "Unverified" },
  { id: "surge", name: "Surge", rarity: "Unverified" },
  { id: "damian", name: "Damian", rarity: "Unverified", recentlyReleased: true },
  { id: "byron", name: "Byron", rarity: "Unverified" },
  { id: "piper", name: "Piper", rarity: "Unverified" },
  { id: "leon", name: "Leon", rarity: "Unverified" },
  { id: "najia", name: "Najia", rarity: "Unverified", recentlyReleased: true },
  { id: "bolt", name: "Bolt", rarity: "Unverified", recentlyReleased: true },
  { id: "kenji", name: "Kenji", rarity: "Unverified", recentlyReleased: true },
  { id: "cordelius", name: "Cordelius", rarity: "Unverified" },
  { id: "mico", name: "Mico", rarity: "Unverified" },
  { id: "chuck", name: "Chuck", rarity: "Unverified" },
  { id: "melodie", name: "Melodie", rarity: "Unverified" },
  { id: "carl", name: "Carl", rarity: "Unverified" },
  { id: "mandy", name: "Mandy", rarity: "Unverified" },
  { id: "bo", name: "Bo", rarity: "Unverified" },
  { id: "sprout", name: "Sprout", rarity: "Unverified" },
  { id: "spike", name: "Spike", rarity: "Unverified" },
  { id: "fang", name: "Fang", rarity: "Unverified" },
  { id: "tara", name: "Tara", rarity: "Unverified" },
  { id: "moe", name: "Moe", rarity: "Unverified", recentlyReleased: true },
  { id: "pearl", name: "Pearl", rarity: "Unverified", recentlyReleased: true },
  { id: "ash", name: "Ash", rarity: "Unverified" },
  { id: "buster", name: "Buster", rarity: "Unverified" },
  { id: "berry", name: "Berry", rarity: "Unverified" },
  { id: "lola", name: "Lola", rarity: "Unverified", recentlyReleased: true },
  { id: "squeak", name: "Squeak", rarity: "Unverified" },
  { id: "trunk", name: "Trunk", rarity: "Unverified", recentlyReleased: true },
  { id: "juju", name: "Juju", rarity: "Unverified", recentlyReleased: true },
  { id: "willow", name: "Willow", rarity: "Unverified" },
  { id: "buzz", name: "Buzz", rarity: "Unverified" },
  { id: "eve", name: "Eve", rarity: "Unverified" },
  { id: "rt", name: "R-T", rarity: "Unverified" },
  { id: "gale", name: "Gale", rarity: "Unverified" },
  { id: "ziggy", name: "Ziggy", rarity: "Unverified", recentlyReleased: true },
  { id: "glowy", name: "Glowy", rarity: "Unverified", recentlyReleased: true },
  { id: "sandy", name: "Sandy", rarity: "Unverified" },
  { id: "janet", name: "Janet", rarity: "Unverified" },
  { id: "larrylawrie", name: "Larry & Lawrie", rarity: "Unverified", recentlyReleased: true },
  { id: "bonnie", name: "Bonnie", rarity: "Unverified" },
  { id: "draco", name: "Draco", rarity: "Unverified", recentlyReleased: true },
  { id: "grom", name: "Grom", rarity: "Unverified" },
  { id: "doug", name: "Doug", rarity: "Unverified" },
  { id: "ollie", name: "Ollie", rarity: "Unverified", recentlyReleased: true },
  { id: "jacky", name: "Jacky", rarity: "Unverified" },
  { id: "mrp", name: "Mr. P", rarity: "Unverified" },
  { id: "pam", name: "Pam", rarity: "Unverified" },
  { id: "sam", name: "Sam", rarity: "Unverified" },
];

export const BRAWLER_IDS: string[] = BRAWLERS.map((b) => b.id);

export function getBrawlerMeta(id: string): BrawlerMeta | undefined {
  return BRAWLERS.find((b) => b.id === id);
}

/**
 * Curated, heuristic "rank skew" per Brawler: -1 means historically much stronger at low-elo
 * brackets (wins on raw stats/positioning mistakes opponents make, gets punished hard once
 * opponents play around it correctly), +1 means historically stronger at high-elo brackets
 * (rewards precise mechanics/awareness that low-elo opponents rarely have available to counter
 * it). 0 means no meaningful skew. This is exactly the "great at low elo, bad pick at high elo
 * due to easy counters" effect — modeled explicitly here rather than left to unstructured
 * per-bucket noise, so recommendations shift in a directionally sensible way across rank
 * brackets. Like all role/archetype metadata, this has no official statistical source and is
 * always surfaced as heuristic (see docs/data-sources.md section 2).
 */
export const BRAWLER_RANK_SKEW: Record<string, number> = {
  shelly: -0.3,
  colt: 0.2,
  bull: -0.4,
  brock: 0.1,
  elprimo: -0.3,
  barley: 0.0,
  poco: -0.2,
  rosa: -0.2,
  jessie: 0.0,
  nita: -0.1,
  dynamike: 0.1,
  tick: 0.2,
  "8bit": 0.0,
  rico: 0.2,
  penny: 0.0,
  darryl: -0.3,
};

export function getRankSkew(id: string): number {
  return BRAWLER_RANK_SKEW[id] ?? 0;
}

/**
 * Curated role tags (spec section 6.4). Weight is 0-1, subjective, and heuristic.
 *
 * The primary classification below (which of "tank" / "assassin" / "tank_counter" / "controller" /
 * "sharpshooter" / "thrower" / "support" each Brawler carries at high weight) follows a 7-class
 * drafting framework a user shared with this project: a categorized reference image covering 101
 * of these 104 Brawlers, plus a companion long-form drafting-strategy video explaining how the
 * classes interact. Both are summarized (not reproduced) here and drive:
 *   - the class label shown on each Brawler during drafting (see components/draft/BrawlerSelector),
 *   - the class-counter matrix in recommendation-engine/class-counters.ts (e.g. tank_counter beats
 *     both tank and assassin — "anti-tank" is that framework's own name for the tank_counter tag),
 *   - draft-position rules (thrower is only safe on the literal last pick; controller is never a
 *     safe first pick; a class-appropriate first pick matters most in non-Bounty/Knockout modes).
 * The 3 Brawlers the reference image didn't cover (starrnova, damian, bolt) keep an earlier
 * best-effort guess and are marked recentlyReleased above to reflect that extra uncertainty.
 * Secondary tags alongside the primary class reuse this project's earlier,
 * independent 9-class/archetype framework (RPS cycle in archetypes.ts) and older granular tags
 * (mobility, healer, area_denial, etc.) — both systems read the same tag list without conflicting.
 */
export const BRAWLER_ROLE_FEATURES: Record<string, RoleFeature[]> = {
  // --- Thrower (11) ---
  barley: [{ tag: "thrower", weight: 0.85 }, { tag: "area_denial", weight: 0.6 }, { tag: "controller", weight: 0.4 }],
  dynamike: [{ tag: "thrower", weight: 0.85 }, { tag: "area_denial", weight: 0.7 }, { tag: "wall_breaker", weight: 0.4 }],
  larrylawrie: [{ tag: "thrower", weight: 0.85 }, { tag: "controller", weight: 0.3 }],
  tick: [{ tag: "thrower", weight: 0.85 }, { tag: "area_denial", weight: 0.5 }, { tag: "anti_assassin", weight: 0.3 }],
  sprout: [{ tag: "thrower", weight: 0.85 }, { tag: "trapper", weight: 0.3 }],
  grom: [{ tag: "thrower", weight: 0.85 }, { tag: "area_denial", weight: 0.5 }],
  ziggy: [{ tag: "thrower", weight: 0.85 }, { tag: "safe_first_pick", weight: 0.3 }],
  sirius: [{ tag: "thrower", weight: 0.85 }, { tag: "controller", weight: 0.3 }],
  juju: [{ tag: "thrower", weight: 0.85 }, { tag: "controller", weight: 0.3 }],
  // Willow and Berry are the framework's own named exceptions: functionally thrower, but each
  // doubles as something throwers normally aren't (Willow: a genuine tank_counter; Berry: a
  // support/healer), which is why they're viable earlier than the rest of this class.
  willow: [{ tag: "thrower", weight: 0.7 }, { tag: "tank_counter", weight: 0.7 }],
  berry: [{ tag: "thrower", weight: 0.7 }, { tag: "support", weight: 0.6 }, { tag: "healer", weight: 0.5 }],

  // --- Tank (10) ---
  trunk: [{ tag: "tank", weight: 0.85 }, { tag: "area_denial", weight: 0.3 }],
  draco: [{ tag: "tank", weight: 0.85 }, { tag: "burst_damage", weight: 0.4 }],
  frank: [{ tag: "tank", weight: 0.9 }, { tag: "burst_damage", weight: 0.5 }],
  fang: [{ tag: "tank", weight: 0.85 }, { tag: "mobility", weight: 0.5 }],
  buster: [{ tag: "tank", weight: 0.85 }, { tag: "anti_assassin", weight: 0.4 }],
  elprimo: [{ tag: "tank", weight: 0.9 }, { tag: "mobility", weight: 0.4 }],
  hank: [{ tag: "tank", weight: 0.85 }, { tag: "area_denial", weight: 0.4 }],
  jacky: [{ tag: "tank", weight: 0.85 }, { tag: "area_denial", weight: 0.4 }],
  rosa: [{ tag: "tank", weight: 0.8 }, { tag: "bush_scout", weight: 0.5 }, { tag: "anti_assassin", weight: 0.4 }],
  ash: [{ tag: "tank", weight: 0.85 }, { tag: "burst_damage", weight: 0.4 }],

  // --- Space Maker / "assassin" tag (19). The framework's own name for this class is "space
  // maker": brawlers whose dash/mobility closes distance fast enough that thrower/sniper/
  // low-damage picks can't be played safely against them. Reuses the pre-existing "assassin" tag.
  bull: [{ tag: "assassin", weight: 0.8 }, { tag: "tank", weight: 0.5 }],
  bibi: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.5 }],
  ollie: [{ tag: "assassin", weight: 0.85 }, { tag: "damage_dealer", weight: 0.4 }],
  kenji: [{ tag: "assassin", weight: 0.85 }],
  mortis: [{ tag: "assassin", weight: 0.9 }, { tag: "mobility", weight: 0.6 }],
  shade: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.5 }],
  mina: [{ tag: "assassin", weight: 0.8 }, { tag: "controller", weight: 0.3 }],
  buzz: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.5 }],
  alli: [{ tag: "assassin", weight: 0.85 }, { tag: "burst_damage", weight: 0.4 }],
  carl: [{ tag: "assassin", weight: 0.8 }, { tag: "tank_counter", weight: 0.3 }],
  edgar: [{ tag: "assassin", weight: 0.9 }, { tag: "mobility", weight: 0.6 }],
  kaze: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.6 }],
  lily: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.5 }],
  mico: [{ tag: "assassin", weight: 0.8 }, { tag: "mobility", weight: 0.5 }],
  sam: [{ tag: "assassin", weight: 0.85 }, { tag: "tank", weight: 0.3 }],
  chuck: [{ tag: "assassin", weight: 0.8 }, { tag: "damage_dealer", weight: 0.4 }],
  gigi: [{ tag: "assassin", weight: 0.85 }, { tag: "mobility", weight: 0.4 }],
  melodie: [{ tag: "assassin", weight: 0.75 }, { tag: "damage_dealer", weight: 0.5 }, { tag: "support", weight: 0.3 }],
  darryl: [{ tag: "assassin", weight: 0.85 }, { tag: "tank", weight: 0.5 }],

  // --- Anti-Tank / "tank_counter" tag (26). The framework's single most important class: the
  // best available one is usually the correct first pick outside Bounty/Knockout, because it
  // shuts down both Tanks and Space Makers at once.
  chester: [{ tag: "tank_counter", weight: 0.9 }],
  nita: [{ tag: "tank_counter", weight: 0.7 }, { tag: "tank", weight: 0.4 }],
  moe: [{ tag: "tank_counter", weight: 0.85 }],
  rico: [{ tag: "tank_counter", weight: 0.85 }, { tag: "wall_breaker", weight: 0.4 }, { tag: "sharpshooter", weight: 0.4 }],
  tara: [{ tag: "tank_counter", weight: 0.8 }, { tag: "trapper", weight: 0.3 }],
  emz: [{ tag: "tank_counter", weight: 0.8 }, { tag: "area_denial", weight: 0.4 }],
  lou: [{ tag: "tank_counter", weight: 0.85 }, { tag: "trapper", weight: 0.3 }],
  finx: [{ tag: "tank_counter", weight: 0.8 }],
  ruffs: [{ tag: "tank_counter", weight: 0.85 }],
  sandy: [{ tag: "tank_counter", weight: 0.8 }, { tag: "anti_assassin", weight: 0.3 }],
  otis: [{ tag: "tank_counter", weight: 0.85 }, { tag: "controller", weight: 0.3 }],
  lumi: [{ tag: "tank_counter", weight: 0.8 }, { tag: "trapper", weight: 0.3 }],
  shelly: [{ tag: "tank_counter", weight: 0.8 }, { tag: "safe_first_pick", weight: 0.5 }, { tag: "burst_damage", weight: 0.4 }],
  surge: [{ tag: "tank_counter", weight: 0.75 }, { tag: "mobility", weight: 0.4 }],
  charlie: [{ tag: "tank_counter", weight: 0.8 }, { tag: "trapper", weight: 0.4 }],
  gale: [{ tag: "tank_counter", weight: 0.75 }, { tag: "area_denial", weight: 0.4 }],
  spike: [{ tag: "tank_counter", weight: 0.75 }, { tag: "thrower", weight: 0.4 }, { tag: "area_denial", weight: 0.4 }],
  // Cordelius is the framework's own named exception here: a solid anti-tank in general, but
  // notably unable to stop a pure safe-damage off-meta pick like Chuck the way other anti-tanks can.
  cordelius: [{ tag: "tank_counter", weight: 0.75 }, { tag: "controller", weight: 0.4 }],
  maisie: [{ tag: "tank_counter", weight: 0.75 }, { tag: "sharpshooter", weight: 0.3 }],
  colt: [{ tag: "tank_counter", weight: 0.7 }, { tag: "sharpshooter", weight: 0.5 }, { tag: "safe_first_pick", weight: 0.4 }],
  griff: [{ tag: "tank_counter", weight: 0.8 }, { tag: "damage_dealer", weight: 0.4 }],
  crow: [{ tag: "tank_counter", weight: 0.9 }, { tag: "mobility", weight: 0.3 }],
  "8bit": [{ tag: "tank_counter", weight: 0.8 }, { tag: "sustained_damage", weight: 0.5 }, { tag: "situational_last_pick", weight: 0.3 }],
  clancy: [{ tag: "tank_counter", weight: 0.85 }, { tag: "sustained_damage", weight: 0.4 }],
  colette: [{ tag: "tank_counter", weight: 0.8 }, { tag: "sharpshooter", weight: 0.3 }],
  meg: [{ tag: "tank_counter", weight: 0.75 }, { tag: "tank", weight: 0.3 }],

  // --- Support (7) ---
  kit: [{ tag: "support", weight: 0.85 }, { tag: "healer", weight: 0.3 }],
  max: [{ tag: "support", weight: 0.85 }, { tag: "mobility", weight: 0.4 }, { tag: "safe_first_pick", weight: 0.3 }],
  gray: [{ tag: "support", weight: 0.8 }, { tag: "sharpshooter", weight: 0.3 }],
  poco: [{ tag: "support", weight: 0.85 }, { tag: "healer", weight: 0.7 }],
  jaeyong: [{ tag: "support", weight: 0.75 }, { tag: "sharpshooter", weight: 0.3 }],
  doug: [{ tag: "support", weight: 0.85 }, { tag: "healer", weight: 0.6 }],
  glowy: [{ tag: "support", weight: 0.75 }],

  // --- Sniper / "sharpshooter" tag (11). Mostly a Bounty/Knockout niche per the framework — pure
  // snipers (Mandy, Piper) are rarely viable in the current meta; the hybrids (Belle, Byron, Gus,
  // RT) and the two exceptions (Angelo, Pierce) see far more play.
  mandy: [{ tag: "sharpshooter", weight: 0.85 }],
  rt: [{ tag: "sharpshooter", weight: 0.8 }, { tag: "tank", weight: 0.3 }],
  gus: [{ tag: "sharpshooter", weight: 0.6 }, { tag: "support", weight: 0.6 }, { tag: "healer", weight: 0.3 }],
  piper: [{ tag: "sharpshooter", weight: 0.75 }],
  brock: [{ tag: "sharpshooter", weight: 0.8 }, { tag: "wall_breaker", weight: 0.6 }, { tag: "objective_pressure", weight: 0.4 }],
  byron: [{ tag: "sharpshooter", weight: 0.6 }, { tag: "support", weight: 0.6 }, { tag: "healer", weight: 0.5 }],
  angelo: [{ tag: "sharpshooter", weight: 0.85 }, { tag: "objective_pressure", weight: 0.4 }],
  pierce: [{ tag: "sharpshooter", weight: 0.85 }, { tag: "damage_dealer", weight: 0.5 }],
  nani: [{ tag: "sharpshooter", weight: 0.85 }, { tag: "marksman", weight: 0.4 }],
  belle: [{ tag: "sharpshooter", weight: 0.8 }, { tag: "damage_dealer", weight: 0.4 }],
  bea: [{ tag: "sharpshooter", weight: 0.85 }, { tag: "marksman", weight: 0.4 }],

  // --- Control (17). Punishes mid-range Anti-Tanks via range/turret/HP advantage, but is weak to
  // real Snipers and Throwers and should not be a first pick (too little damage to survive a rush
  // before establishing position).
  amber: [{ tag: "controller", weight: 0.75 }, { tag: "damage_dealer", weight: 0.5 }, { tag: "area_denial", weight: 0.4 }],
  meeple: [{ tag: "controller", weight: 0.8 }, { tag: "trapper", weight: 0.4 }],
  leon: [{ tag: "controller", weight: 0.7 }, { tag: "assassin", weight: 0.4 }, { tag: "mobility", weight: 0.5 }],
  pam: [{ tag: "controller", weight: 0.7 }, { tag: "support", weight: 0.6 }, { tag: "healer", weight: 0.5 }],
  bo: [{ tag: "controller", weight: 0.75 }, { tag: "trapper", weight: 0.4 }, { tag: "sharpshooter", weight: 0.3 }],
  pearl: [{ tag: "controller", weight: 0.7 }, { tag: "tank", weight: 0.4 }],
  gene: [{ tag: "controller", weight: 0.75 }, { tag: "support", weight: 0.5 }, { tag: "anti_agro", weight: 0.4 }],
  stu: [{ tag: "controller", weight: 0.7 }, { tag: "speedster", weight: 0.6 }, { tag: "mobility", weight: 0.6 }],
  janet: [{ tag: "controller", weight: 0.75 }, { tag: "sharpshooter", weight: 0.4 }, { tag: "mobility", weight: 0.4 }],
  penny: [{ tag: "controller", weight: 0.8 }, { tag: "area_denial", weight: 0.5 }, { tag: "objective_pressure", weight: 0.4 }],
  jessie: [{ tag: "controller", weight: 0.8 }, { tag: "area_denial", weight: 0.4 }],
  squeak: [{ tag: "controller", weight: 0.75 }, { tag: "trapper", weight: 0.4 }],
  eve: [{ tag: "controller", weight: 0.75 }, { tag: "area_denial", weight: 0.5 }],
  lola: [{ tag: "controller", weight: 0.65 }, { tag: "assassin", weight: 0.4 }, { tag: "mobility", weight: 0.4 }],
  najia: [{ tag: "controller", weight: 0.7 }, { tag: "sharpshooter", weight: 0.3 }],
  bonnie: [{ tag: "controller", weight: 0.65 }, { tag: "sharpshooter", weight: 0.6 }],
  mrp: [{ tag: "controller", weight: 0.8 }, { tag: "support", weight: 0.4 }],

  // --- Not covered by the reference image (3 of 104) — kept as an earlier best-effort guess, see
  // the recentlyReleased markers above.
  starrnova: [{ tag: "support", weight: 0.6 }, { tag: "controller", weight: 0.4 }],
  damian: [{ tag: "damage_dealer", weight: 0.5 }, { tag: "tank_counter", weight: 0.3 }],
  bolt: [{ tag: "speedster", weight: 0.7 }, { tag: "assassin", weight: 0.4 }],
};
