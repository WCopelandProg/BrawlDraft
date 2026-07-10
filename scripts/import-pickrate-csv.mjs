#!/usr/bin/env node
/**
 * Imports a real, user-provided "pick rate by Brawler" CSV — a global (not map-specific) snapshot
 * across all Ranked matches within some rank range (e.g. brawltime.ninja's dashboard with Group
 * By: Brawler, Metric: Pick Rate / Use Rate) — into
 * src/lib/recommendation-engine/real-data/generated-pick-rates.json.
 *
 * Like scripts/import-brawltime-csv.mjs, this never contacts brawltime.ninja itself: it only
 * parses a file a human already exported in their own browser.
 *
 * Pick rate is popularity, not measured win rate. This script does NOT write into
 * generated-map-stats.json / adjustedWinRate — see hybrid-dataset.ts for how pick rate is used as
 * its own, honestly-labeled signal.
 *
 * Usage:
 *   node scripts/import-pickrate-csv.mjs <path-to-csv> \
 *     --rank legendary,masters \
 *     [--exported-at 2026-07-10] [--note "brawltime.ninja, Ranked, Legendary I-Masters"]
 *
 * --rank accepts a comma-separated list because a single export commonly spans a *range* of this
 * app's rank buckets (e.g. brawltime.ninja's "Legendary I-Masters" spans both "legendary" and
 * "masters") — the same real numbers are written for each bucket named, with that fact recorded
 * in --note so it's auditable, not presented as independently-measured per-bucket data.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCsv, findColumnIndex, parseArgs } from "./import-brawltime-csv.mjs";
import { resolveBrawlerId } from "./brawler-ids.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(
  __dirname,
  "../src/lib/recommendation-engine/real-data/generated-pick-rates.json",
);

function parsePickRateValue(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw.trim().replace(/%/g, ""));
  if (Number.isNaN(n)) return undefined;
  // brawltime.ninja pick-rate exports are already a 0-1 fraction (e.g. 0.053), unlike win-rate
  // exports which are usually 0-100 — no rescaling heuristic needed here.
  return n;
}

/** Computes each entry's percentile rank (0 = lowest pick rate, 1 = highest) within the same list. */
export function computePercentiles(entries) {
  const sorted = [...entries].sort((a, b) => a.pickRate - b.pickRate);
  const n = sorted.length;
  const percentileById = new Map();
  sorted.forEach((entry, index) => {
    percentileById.set(entry.brawlerId, n > 1 ? index / (n - 1) : 1);
  });
  return entries.map((entry) => ({ ...entry, popularityPercentile: percentileById.get(entry.brawlerId) }));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args._[0];
  if (!csvPath || !args.rank) {
    console.error(
      'Usage: node scripts/import-pickrate-csv.mjs <file.csv> --rank <rankBucketId>[,<rankBucketId>...] [--exported-at YYYY-MM-DD] [--note "..."]',
    );
    process.exit(1);
  }

  const raw = readFileSync(csvPath, "utf8");
  const rows = parseCsv(raw);
  if (rows.length < 2) {
    console.error("CSV has no data rows.");
    process.exit(1);
  }

  const header = rows[0];
  const brawlerCol = findColumnIndex(header, /brawler/i);
  const pickRateCol = findColumnIndex(header, /pick.?rate/i);
  if (brawlerCol === -1 || pickRateCol === -1) {
    console.error(
      `Could not find required columns in header: ${JSON.stringify(header)}. Expected a "Brawler" column and a "Pick Rate" column.`,
    );
    process.exit(1);
  }

  const exportedAt = args["exported-at"] || new Date().toISOString().slice(0, 10);
  const sourceNote = args.note || "brawltime.ninja pick-rate export";
  const rankBuckets = args.rank.split(",").map((r) => r.trim()).filter(Boolean);

  const parsed = [];
  const unmatched = [];
  for (const row of rows.slice(1)) {
    const rawName = row[brawlerCol];
    if (!rawName) continue;
    const brawlerId = resolveBrawlerId(rawName);
    if (!brawlerId) {
      unmatched.push(rawName);
      continue;
    }
    const pickRate = parsePickRateValue(row[pickRateCol]);
    if (pickRate === undefined) continue;
    parsed.push({ brawlerId, pickRate });
  }

  if (unmatched.length > 0) {
    console.warn(
      `Skipped ${unmatched.length} row(s) for Brawlers not in this app's seeded roster (src/lib/data/brawlers.ts): ${[...new Set(unmatched)].join(", ")}`,
    );
  }

  const withPercentiles = computePercentiles(parsed);

  let existing = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  }
  const keep = existing.filter((r) => !rankBuckets.includes(r.rankBucket));
  const imported = rankBuckets.flatMap((rankBucket) =>
    withPercentiles.map((entry) => ({
      brawlerId: entry.brawlerId,
      rankBucket,
      pickRate: entry.pickRate,
      popularityPercentile: entry.popularityPercentile,
      exportedAt,
      sourceNote,
    })),
  );
  const next = [...keep, ...imported].sort(
    (a, b) => a.rankBucket.localeCompare(b.rankBucket) || a.brawlerId.localeCompare(b.brawlerId),
  );
  writeFileSync(OUTPUT_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Imported ${imported.length} row(s) (${withPercentiles.length} Brawlers x ${rankBuckets.length} rank bucket(s)) into ${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parsePickRateValue };
