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
