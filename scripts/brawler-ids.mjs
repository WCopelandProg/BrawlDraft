// Kept in sync with src/lib/data/brawlers.ts BRAWLER_IDS by hand — these import scripts have no
// TS/build step, so they can't import that file directly. Shared by every scripts/import-*.mjs so
// there is exactly one place to update when the roster changes.
export const BRAWLER_IDS = [
  "shelly", "colt", "bull", "brock", "elprimo", "barley", "poco", "rosa", "jessie", "nita",
  "dynamike", "tick", "8bit", "rico", "penny", "darryl", "edgar", "gigi", "alli", "frank", "hank",
  "bibi", "kaze", "shade", "otis", "maisie", "chester", "clancy", "amber", "lumi", "lou", "charlie",
  "ruffs", "max", "belle", "nani", "angelo", "emz", "mortis", "lily", "gene", "mina", "gray", "gus",
  "pierce", "jaeyong", "finx", "bea", "griff", "stu", "meeple", "sirius", "kit", "crow",
  "meg", "starrnova", "colette", "surge", "damian", "byron", "piper", "leon", "najia", "bolt",
  "kenji", "cordelius", "mico", "chuck", "melodie", "carl", "mandy", "bo", "sprout", "spike",
  "fang", "tara", "moe", "pearl", "ash", "buster", "berry", "lola", "squeak", "trunk", "juju",
  "willow", "buzz", "eve", "rt", "gale", "ziggy", "glowy", "sandy", "janet", "larrylawrie",
  "bonnie", "draco", "grom", "doug", "ollie", "jacky", "mrp", "pam", "sam", "nori",
];

export function normalizeBrawlerName(rawName) {
  return rawName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
}

/** Returns the matching Brawler id for a raw CSV name, or undefined if it's not in the roster. */
export function resolveBrawlerId(rawName) {
  const normalized = normalizeBrawlerName(rawName);
  return BRAWLER_IDS.includes(normalized) ? normalized : undefined;
}
