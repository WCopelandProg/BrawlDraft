export interface MapMeta {
  id: string;
  name: string;
  modeId: string;
}

/**
 * Map names below are a best-effort list of maps that have recurred across many past seasons for
 * each Ranked mode, compiled from this assistant's own knowledge since the live map-rotation sites
 * (brawlify.com, brawltime.ninja, the Brawl Stars Fandom wiki) all block automated fetches from
 * this environment (confirmed 403 on every attempt). Web search does confirm the current rotation
 * shape — 6 Ranked modes, 4 maps each, 24 total (source: web search, July 2026) — but could not
 * return a verifiable, current map-by-map list. Ranked maps rotate every season, so treat these as
 * a reasonable starting seed, not a guaranteed-current list — edit this file directly if a map
 * here has since rotated out.
 */
export const MAPS: MapMeta[] = [
  { id: "hard-rock-mine", name: "Hard Rock Mine", modeId: "gem-grab" },
  { id: "undermine", name: "Undermine", modeId: "gem-grab" },
  { id: "crystal-arcade", name: "Crystal Arcade", modeId: "gem-grab" },
  { id: "double-swoosh", name: "Double Swoosh", modeId: "gem-grab" },

  { id: "sneaky-fields", name: "Sneaky Fields", modeId: "brawl-ball" },
  { id: "pinhole-punt", name: "Pinhole Punt", modeId: "brawl-ball" },
  { id: "backyard-bowl", name: "Backyard Bowl", modeId: "brawl-ball" },
  { id: "triple-dribble", name: "Triple Dribble", modeId: "brawl-ball" },

  { id: "snake-prairie", name: "Snake Prairie", modeId: "bounty" },
  { id: "shooting-star", name: "Shooting Star", modeId: "bounty" },
  { id: "layer-cake", name: "Layer Cake", modeId: "bounty" },
  { id: "dry-season", name: "Dry Season", modeId: "bounty" },

  { id: "safe-zone", name: "Safe Zone", modeId: "heist" },
  { id: "kaboom-canyon", name: "Kaboom Canyon", modeId: "heist" },
  { id: "hot-potato", name: "Hot Potato", modeId: "heist" },
  { id: "gg-mine", name: "G.G. Mine", modeId: "heist" },

  { id: "parallel-play", name: "Parallel Play", modeId: "hot-zone" },
  { id: "ring-of-fire", name: "Ring of Fire", modeId: "hot-zone" },
  { id: "dueling-beetles", name: "Dueling Beetles", modeId: "hot-zone" },
  { id: "split", name: "Split", modeId: "hot-zone" },

  { id: "goldarm-gulch", name: "Goldarm Gulch", modeId: "knockout" },
  { id: "belles-rock", name: "Belle's Rock", modeId: "knockout" },
  { id: "new-horizons", name: "New Horizons", modeId: "knockout" },
  { id: "flaring-phoenix", name: "Flaring Phoenix", modeId: "knockout" },
];

export function getMapMeta(id: string): MapMeta | undefined {
  return MAPS.find((m) => m.id === id);
}

export function mapsForMode(modeId: string): MapMeta[] {
  return MAPS.filter((m) => m.modeId === modeId);
}
