export interface GameModeMeta {
  id: string;
  name: string;
}

/** Small representative seed set for the prototype, not the full current mode rotation. */
export const GAME_MODES: GameModeMeta[] = [
  { id: "gem-grab", name: "Gem Grab" },
  { id: "brawl-ball", name: "Brawl Ball" },
  { id: "knockout", name: "Knockout" },
];

export function getGameModeMeta(id: string): GameModeMeta | undefined {
  return GAME_MODES.find((m) => m.id === id);
}
