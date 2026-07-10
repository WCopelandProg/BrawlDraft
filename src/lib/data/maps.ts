export interface MapMeta {
  id: string;
  name: string;
  modeId: string;
}

/** Small representative seed set for the prototype, not the full current map rotation. */
export const MAPS: MapMeta[] = [
  { id: "hard-rock-mine", name: "Hard Rock Mine", modeId: "gem-grab" },
  { id: "undermine", name: "Undermine", modeId: "gem-grab" },
  { id: "sneaky-fields", name: "Sneaky Fields", modeId: "brawl-ball" },
  { id: "pinhole-punt", name: "Pinhole Punt", modeId: "brawl-ball" },
  { id: "goldarm-gulch", name: "Goldarm Gulch", modeId: "knockout" },
];

export function getMapMeta(id: string): MapMeta | undefined {
  return MAPS.find((m) => m.id === id);
}

export function mapsForMode(modeId: string): MapMeta[] {
  return MAPS.filter((m) => m.modeId === modeId);
}
