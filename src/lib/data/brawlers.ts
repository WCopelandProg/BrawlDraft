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
  { id: "ninja", name: "Ninja", rarity: "Unverified", recentlyReleased: true },
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

/** Curated role tags (spec section 6.4). Weight is 0-1, subjective, and heuristic. */
export const BRAWLER_ROLE_FEATURES: Record<string, RoleFeature[]> = {
  shelly: [
    { tag: "safe_first_pick", weight: 0.8 },
    { tag: "burst_damage", weight: 0.5 },
    { tag: "tank_counter", weight: 0.4 },
    { tag: "damage_dealer", weight: 0.6 },
  ],
  colt: [
    { tag: "marksman", weight: 0.8 },
    { tag: "sustained_damage", weight: 0.6 },
    { tag: "safe_first_pick", weight: 0.5 },
    { tag: "damage_dealer", weight: 0.6 },
    { tag: "sharpshooter", weight: 0.5 },
  ],
  bull: [
    { tag: "tank", weight: 0.9 },
    { tag: "burst_damage", weight: 0.6 },
  ],
  brock: [
    { tag: "marksman", weight: 0.7 },
    { tag: "wall_breaker", weight: 0.8 },
    { tag: "objective_pressure", weight: 0.5 },
    { tag: "sharpshooter", weight: 0.7 },
  ],
  elprimo: [
    { tag: "tank", weight: 0.8 },
    { tag: "assassin", weight: 0.4 },
    { tag: "mobility", weight: 0.4 },
  ],
  barley: [
    { tag: "thrower", weight: 0.9 },
    { tag: "area_denial", weight: 0.7 },
    { tag: "bush_scout", weight: 0.3 },
    { tag: "controller", weight: 0.6 },
  ],
  poco: [
    { tag: "support", weight: 0.7 },
    { tag: "healer", weight: 0.8 },
    { tag: "sustained_damage", weight: 0.3 },
  ],
  rosa: [
    { tag: "tank", weight: 0.6 },
    { tag: "bush_scout", weight: 0.6 },
    { tag: "anti_assassin", weight: 0.5 },
    { tag: "anti_agro", weight: 0.3 },
  ],
  jessie: [
    { tag: "controller", weight: 0.6 },
    { tag: "area_denial", weight: 0.5 },
    { tag: "support", weight: 0.3 },
  ],
  nita: [
    { tag: "tank", weight: 0.5 },
    { tag: "controller", weight: 0.4 },
    { tag: "burst_damage", weight: 0.4 },
  ],
  dynamike: [
    { tag: "thrower", weight: 0.9 },
    { tag: "area_denial", weight: 0.8 },
    { tag: "wall_breaker", weight: 0.5 },
    { tag: "controller", weight: 0.7 },
  ],
  tick: [
    { tag: "thrower", weight: 0.7 },
    { tag: "area_denial", weight: 0.6 },
    { tag: "anti_assassin", weight: 0.4 },
    { tag: "controller", weight: 0.6 },
  ],
  "8bit": [
    { tag: "sustained_damage", weight: 0.7 },
    { tag: "tank_counter", weight: 0.5 },
    { tag: "situational_last_pick", weight: 0.4 },
    { tag: "damage_dealer", weight: 0.6 },
  ],
  rico: [
    { tag: "marksman", weight: 0.6 },
    { tag: "objective_pressure", weight: 0.6 },
    { tag: "wall_breaker", weight: 0.4 },
    { tag: "sharpshooter", weight: 0.6 },
  ],
  penny: [
    { tag: "controller", weight: 0.5 },
    { tag: "area_denial", weight: 0.6 },
    { tag: "objective_pressure", weight: 0.5 },
  ],
  darryl: [
    { tag: "tank", weight: 0.7 },
    { tag: "assassin", weight: 0.5 },
    { tag: "mobility", weight: 0.6 },
  ],

  // --- Brawlers added to cover a user-provided drafting guide (archetypes.ts). Class-tag weights
  // below follow the guide's explicit examples where given; a few (Mina, Gray, Gus, Pierce,
  // JaeYong, Ninja, Finx) aren't explicitly classified in the guide and are inferred from the
  // mode context it gives them in — heuristic on top of heuristic, and treated with appropriately
  // lower confidence (see recentlyReleased markers above for the least-certain ones).
  edgar: [{ tag: "assassin", weight: 0.9 }, { tag: "mobility", weight: 0.6 }, { tag: "burst_damage", weight: 0.6 }],
  gigi: [{ tag: "assassin", weight: 0.8 }, { tag: "mobility", weight: 0.5 }],
  alli: [{ tag: "assassin", weight: 0.7 }, { tag: "burst_damage", weight: 0.5 }],
  frank: [{ tag: "tank", weight: 0.9 }, { tag: "burst_damage", weight: 0.5 }],
  hank: [{ tag: "tank", weight: 0.8 }, { tag: "area_denial", weight: 0.4 }],
  bibi: [{ tag: "speedster", weight: 0.8 }, { tag: "burst_damage", weight: 0.6 }],
  kaze: [{ tag: "speedster", weight: 0.9 }, { tag: "mobility", weight: 0.7 }],
  shade: [{ tag: "speedster", weight: 0.8 }, { tag: "assassin", weight: 0.4 }],
  otis: [{ tag: "anti_agro", weight: 0.9 }, { tag: "controller", weight: 0.3 }],
  maisie: [{ tag: "anti_agro", weight: 0.7 }, { tag: "sharpshooter", weight: 0.4 }],
  chester: [{ tag: "anti_agro", weight: 0.8 }, { tag: "damage_dealer", weight: 0.4 }],
  clancy: [{ tag: "damage_dealer", weight: 0.8 }, { tag: "sustained_damage", weight: 0.5 }],
  amber: [{ tag: "damage_dealer", weight: 0.8 }, { tag: "sustained_damage", weight: 0.6 }, { tag: "area_denial", weight: 0.4 }],
  lumi: [{ tag: "trapper", weight: 0.8 }, { tag: "controller", weight: 0.3 }],
  lou: [{ tag: "trapper", weight: 0.8 }, { tag: "controller", weight: 0.4 }],
  charlie: [{ tag: "trapper", weight: 0.9 }, { tag: "mobility", weight: 0.3 }],
  ruffs: [{ tag: "support", weight: 0.9 }, { tag: "safe_first_pick", weight: 0.4 }],
  max: [{ tag: "support", weight: 0.7 }, { tag: "mobility", weight: 0.5 }, { tag: "safe_first_pick", weight: 0.3 }],
  belle: [{ tag: "sharpshooter", weight: 0.9 }, { tag: "marksman", weight: 0.6 }],
  nani: [{ tag: "sharpshooter", weight: 0.8 }, { tag: "marksman", weight: 0.5 }],
  angelo: [{ tag: "sharpshooter", weight: 0.9 }, { tag: "objective_pressure", weight: 0.4 }],
  emz: [{ tag: "controller", weight: 0.8 }, { tag: "area_denial", weight: 0.5 }],
  mortis: [{ tag: "assassin", weight: 0.9 }, { tag: "mobility", weight: 0.7 }],
  lily: [{ tag: "assassin", weight: 0.8 }, { tag: "mobility", weight: 0.6 }],
  gene: [{ tag: "anti_agro", weight: 0.7 }, { tag: "support", weight: 0.5 }],
  mina: [{ tag: "controller", weight: 0.6 }, { tag: "damage_dealer", weight: 0.5 }],
  gray: [{ tag: "sharpshooter", weight: 0.6 }, { tag: "damage_dealer", weight: 0.6 }],
  gus: [{ tag: "support", weight: 0.8 }, { tag: "healer", weight: 0.6 }],
  pierce: [{ tag: "sharpshooter", weight: 0.7 }, { tag: "damage_dealer", weight: 0.5 }],
  jaeyong: [{ tag: "damage_dealer", weight: 0.6 }, { tag: "sharpshooter", weight: 0.4 }],
  ninja: [{ tag: "sharpshooter", weight: 0.5 }, { tag: "mobility", weight: 0.4 }],
  finx: [{ tag: "controller", weight: 0.6 }, { tag: "support", weight: 0.4 }],
  bea: [{ tag: "sharpshooter", weight: 0.9 }, { tag: "marksman", weight: 0.6 }],
  griff: [{ tag: "damage_dealer", weight: 0.8 }, { tag: "sustained_damage", weight: 0.5 }],
  stu: [{ tag: "speedster", weight: 0.8 }, { tag: "mobility", weight: 0.7 }],
  meeple: [{ tag: "trapper", weight: 0.8 }, { tag: "controller", weight: 0.3 }],
  sirius: [{ tag: "controller", weight: 0.8 }, { tag: "anti_assassin", weight: 0.4 }],
  kit: [{ tag: "support", weight: 0.8 }, { tag: "healer", weight: 0.3 }],

  // --- Brawlers added to cover a real user-provided pick-rate export (see comment above in
  // BRAWLERS). Same caveat as the guide-derived entries: these are best-effort class guesses,
  // not confirmed, and the least-certain ones are marked recentlyReleased above.
  crow: [{ tag: "assassin", weight: 0.8 }, { tag: "speedster", weight: 0.5 }],
  meg: [{ tag: "tank", weight: 0.8 }, { tag: "damage_dealer", weight: 0.5 }],
  starrnova: [{ tag: "support", weight: 0.6 }, { tag: "controller", weight: 0.4 }],
  colette: [{ tag: "damage_dealer", weight: 0.8 }, { tag: "sharpshooter", weight: 0.4 }],
  surge: [{ tag: "speedster", weight: 0.6 }, { tag: "damage_dealer", weight: 0.6 }],
  damian: [{ tag: "damage_dealer", weight: 0.5 }],
  byron: [{ tag: "support", weight: 0.8 }, { tag: "healer", weight: 0.6 }],
  piper: [{ tag: "sharpshooter", weight: 0.9 }],
  leon: [{ tag: "assassin", weight: 0.9 }, { tag: "mobility", weight: 0.6 }],
  najia: [{ tag: "sharpshooter", weight: 0.5 }],
  bolt: [{ tag: "speedster", weight: 0.7 }],
  kenji: [{ tag: "assassin", weight: 0.6 }],
  cordelius: [{ tag: "controller", weight: 0.7 }, { tag: "trapper", weight: 0.4 }],
  mico: [{ tag: "speedster", weight: 0.7 }, { tag: "assassin", weight: 0.4 }],
  chuck: [{ tag: "speedster", weight: 0.8 }],
  melodie: [{ tag: "damage_dealer", weight: 0.6 }, { tag: "support", weight: 0.4 }],
  carl: [{ tag: "damage_dealer", weight: 0.6 }, { tag: "tank_counter", weight: 0.5 }],
  mandy: [{ tag: "sharpshooter", weight: 0.8 }],
  bo: [{ tag: "trapper", weight: 0.7 }, { tag: "sharpshooter", weight: 0.4 }],
  sprout: [{ tag: "controller", weight: 0.7 }, { tag: "trapper", weight: 0.5 }],
  spike: [{ tag: "thrower", weight: 0.7 }, { tag: "controller", weight: 0.6 }],
  fang: [{ tag: "speedster", weight: 0.7 }, { tag: "assassin", weight: 0.5 }],
  tara: [{ tag: "controller", weight: 0.7 }, { tag: "trapper", weight: 0.4 }],
  moe: [{ tag: "controller", weight: 0.5 }, { tag: "damage_dealer", weight: 0.4 }],
  pearl: [{ tag: "tank", weight: 0.6 }, { tag: "damage_dealer", weight: 0.5 }],
  ash: [{ tag: "tank", weight: 0.7 }, { tag: "damage_dealer", weight: 0.5 }],
  buster: [{ tag: "tank", weight: 0.6 }, { tag: "anti_agro", weight: 0.4 }],
  berry: [{ tag: "support", weight: 0.7 }, { tag: "healer", weight: 0.6 }],
  lola: [{ tag: "assassin", weight: 0.5 }, { tag: "mobility", weight: 0.5 }],
  squeak: [{ tag: "controller", weight: 0.7 }, { tag: "trapper", weight: 0.4 }],
  trunk: [{ tag: "tank", weight: 0.6 }, { tag: "damage_dealer", weight: 0.5 }],
  juju: [{ tag: "controller", weight: 0.6 }],
  willow: [{ tag: "controller", weight: 0.7 }, { tag: "trapper", weight: 0.5 }],
  buzz: [{ tag: "assassin", weight: 0.7 }, { tag: "mobility", weight: 0.6 }],
  eve: [{ tag: "controller", weight: 0.7 }, { tag: "area_denial", weight: 0.5 }],
  rt: [{ tag: "tank", weight: 0.5 }, { tag: "controller", weight: 0.5 }],
  gale: [{ tag: "controller", weight: 0.7 }, { tag: "area_denial", weight: 0.5 }],
  ziggy: [{ tag: "support", weight: 0.5 }],
  glowy: [{ tag: "support", weight: 0.5 }],
  sandy: [{ tag: "support", weight: 0.6 }, { tag: "anti_agro", weight: 0.5 }],
  janet: [{ tag: "sharpshooter", weight: 0.7 }, { tag: "mobility", weight: 0.4 }],
  larrylawrie: [{ tag: "controller", weight: 0.5 }, { tag: "tank", weight: 0.4 }],
  bonnie: [{ tag: "sharpshooter", weight: 0.8 }],
  draco: [{ tag: "damage_dealer", weight: 0.5 }],
  grom: [{ tag: "thrower", weight: 0.7 }, { tag: "area_denial", weight: 0.6 }],
  doug: [{ tag: "support", weight: 0.7 }, { tag: "healer", weight: 0.6 }],
  ollie: [{ tag: "damage_dealer", weight: 0.5 }],
  jacky: [{ tag: "tank", weight: 0.7 }, { tag: "area_denial", weight: 0.4 }],
  mrp: [{ tag: "controller", weight: 0.7 }, { tag: "support", weight: 0.4 }],
  pam: [{ tag: "support", weight: 0.8 }, { tag: "healer", weight: 0.7 }],
  sam: [{ tag: "assassin", weight: 0.6 }, { tag: "tank", weight: 0.4 }],
};
