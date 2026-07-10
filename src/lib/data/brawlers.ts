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
  ],
  colt: [
    { tag: "marksman", weight: 0.8 },
    { tag: "sustained_damage", weight: 0.6 },
    { tag: "safe_first_pick", weight: 0.5 },
  ],
  bull: [
    { tag: "tank", weight: 0.9 },
    { tag: "burst_damage", weight: 0.6 },
  ],
  brock: [
    { tag: "marksman", weight: 0.7 },
    { tag: "wall_breaker", weight: 0.8 },
    { tag: "objective_pressure", weight: 0.5 },
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
  ],
  tick: [
    { tag: "thrower", weight: 0.7 },
    { tag: "area_denial", weight: 0.6 },
    { tag: "anti_assassin", weight: 0.4 },
  ],
  "8bit": [
    { tag: "sustained_damage", weight: 0.7 },
    { tag: "tank_counter", weight: 0.5 },
    { tag: "situational_last_pick", weight: 0.4 },
  ],
  rico: [
    { tag: "marksman", weight: 0.6 },
    { tag: "objective_pressure", weight: 0.6 },
    { tag: "wall_breaker", weight: 0.4 },
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
};
