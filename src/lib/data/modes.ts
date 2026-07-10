export interface GameModeMeta {
  id: string;
  name: string;
}

/**
 * The 6 modes confirmed (via web search, July 2026) to be in the live Ranked rotation: a Ranked
 * match is always a random 3v3 mode on a random map from that mode's pool. Solo/Duo Showdown and
 * other non-3v3 modes are not part of Ranked and are intentionally excluded here.
 */
export const GAME_MODES: GameModeMeta[] = [
  { id: "gem-grab", name: "Gem Grab" },
  { id: "brawl-ball", name: "Brawl Ball" },
  { id: "bounty", name: "Bounty" },
  { id: "heist", name: "Heist" },
  { id: "hot-zone", name: "Hot Zone" },
  { id: "knockout", name: "Knockout" },
];

export function getGameModeMeta(id: string): GameModeMeta | undefined {
  return GAME_MODES.find((m) => m.id === id);
}
