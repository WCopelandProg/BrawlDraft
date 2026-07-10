export interface RankBucketMeta {
  id: string;
  name: string;
}

/**
 * Ordered low-to-high skill bracket. "all" is a special aggregate bucket (average across ranks),
 * not a real rank — it carries no skew (see rankBucketSkewPosition below).
 *
 * This list is intentionally coarse for the prototype (docs/data-sources.md section 2). A real
 * deployment would source rank buckets from the game's actual Ranked tier list.
 */
export const RANK_BUCKETS: RankBucketMeta[] = [
  { id: "all", name: "All ranks" },
  { id: "diamond", name: "Diamond" },
  { id: "mythic", name: "Mythic" },
  { id: "legendary", name: "Legendary" },
  { id: "masters", name: "Masters" },
];

const ORDERED_RANK_BUCKET_IDS = RANK_BUCKETS.filter((r) => r.id !== "all").map((r) => r.id);

export function getRankBucketMeta(id: string): RankBucketMeta | undefined {
  return RANK_BUCKETS.find((r) => r.id === id);
}

/**
 * Maps a rank bucket to a position from -1 (lowest tracked bracket) to +1 (highest), with 0 for
 * "all" or any unrecognized bucket. Used to scale a Brawler's curated rank skew (see
 * BRAWLER_RANK_SKEW in lib/data/brawlers.ts) — the mechanism that makes a Brawler who is strong at
 * low elo (easy stat-checks, opponents don't punish mistakes) but weak at high elo (easily
 * countered once players know how) actually show up differently across brackets, instead of only
 * varying by unstructured per-bucket noise.
 */
export function rankBucketSkewPosition(rankBucket: string): number {
  const idx = ORDERED_RANK_BUCKET_IDS.indexOf(rankBucket);
  if (idx === -1) return 0;
  const normalized = idx / (ORDERED_RANK_BUCKET_IDS.length - 1);
  return normalized * 2 - 1;
}
