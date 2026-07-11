#!/usr/bin/env node
/**
 * Imports a real, user-provided "use rate by Brawler" CSV for a single game mode (all maps, all
 * ranks combined for that mode) into
 * src/lib/recommendation-engine/real-data/generated-mode-userates.json.
 *
 * This is a different axis from scripts/import-pickrate-csv.mjs, which imports a single
 * *rank-bucket*-scoped snapshot across all modes/maps combined. This script instead imports a
 * *mode*-scoped snapshot with no rank-bucket breakdown in the source data — the CSVs this was
 * built against didn't state which rank bracket they were pulled from, so the resulting
 * popularity percentile is stored per-mode only and applied the same way regardless of the
 * selected rank bucket, rather than guessing a bracket that was never stated (see
 * data/brawltime/README.md section 6 for the honesty rationale).
 *
 * Usage:
 *   node scripts/import-mode-userate-csv.mjs <path-to-csv> \
 *     --mode gem-grab \
 *     [--exported-at 2026-07-10] [--note "brawltime.ninja, Ranked, Gem Grab, rank bracket unspecified"]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCsv, findColumnIndex, parseArgs } from "./import-brawltime-csv.mjs";
import { resolveBrawlerId } from "./brawler-ids.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(
  __dirname,
  "../src/lib/recommendation-engine/real-data/generated-mode-userates.json",
);

function parseUseRateValue(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw.trim().replace(/%/g, ""));
  if (Number.isNaN(n)) return undefined;
  // Same as import-pickrate-csv.mjs: these exports are already a 0-1 fraction, not 0-100.
  return n;
}

/** Computes each entry's percentile rank (0 = lowest use rate, 1 = highest) within the same mode. */
export function computeModePercentiles(entries) {
  const sorted = [...entries].sort((a, b) => a.useRate - b.useRate);
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
  if (!csvPath || !args.mode) {
    console.error(
      'Usage: node scripts/import-mode-userate-csv.mjs <file.csv> --mode <modeId> [--exported-at YYYY-MM-DD] [--note "..."]',
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
  const useRateCol = findColumnIndex(header, /(use|pick).?rate/i);
  if (brawlerCol === -1 || useRateCol === -1) {
    console.error(
      `Could not find required columns in header: ${JSON.stringify(header)}. Expected a "Brawler" column and a "Use Rate" column.`,
    );
    process.exit(1);
  }

  const modeId = args.mode;
  const exportedAt = args["exported-at"] || new Date().toISOString().slice(0, 10);
  const sourceNote = args.note || `brawltime.ninja use-rate export, mode=${modeId}, rank bracket unspecified`;

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
    const useRate = parseUseRateValue(row[useRateCol]);
    if (useRate === undefined) continue;
    parsed.push({ brawlerId, useRate });
  }

  if (unmatched.length > 0) {
    console.warn(
      `Skipped ${unmatched.length} row(s) for Brawlers not in this app's seeded roster (src/lib/data/brawlers.ts): ${[...new Set(unmatched)].join(", ")}`,
    );
  }

  const withPercentiles = computeModePercentiles(parsed);

  let existing = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  }
  const keep = existing.filter((r) => r.modeId !== modeId);
  const imported = withPercentiles.map((entry) => ({
    brawlerId: entry.brawlerId,
    modeId,
    useRate: entry.useRate,
    popularityPercentile: entry.popularityPercentile,
    exportedAt,
    sourceNote,
  }));
  const next = [...keep, ...imported].sort(
    (a, b) => a.modeId.localeCompare(b.modeId) || a.brawlerId.localeCompare(b.brawlerId),
  );
  writeFileSync(OUTPUT_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(
    `Imported ${imported.length} row(s) for mode "${modeId}" into ${path.relative(process.cwd(), OUTPUT_PATH)}.`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseUseRateValue };
