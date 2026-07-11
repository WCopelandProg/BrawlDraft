#!/usr/bin/env node
/**
 * Imports a real, user-provided "win rate / pick rate / score by Brawler" CSV for a single game
 * mode (all maps, all ranks combined for that mode) into
 * src/lib/recommendation-engine/real-data/generated-mode-stats.json.
 *
 * This is richer than scripts/import-pickrate-csv.mjs (rank-bucket-scoped, pick-rate only): it
 * carries an actual measured win rate per mode, not just popularity, plus the source's own
 * composite ranking score used only for "ranked #N" explanatory text and ban-priority ordering —
 * see real-data/types.ts for why score isn't fed into pick scoring as its own weighted term.
 *
 * The source CSVs this was built against didn't state a rank bracket, so — rather than guess one
 * — this is applied uniformly across every rank bucket for the given mode (see
 * data/brawltime/README.md section 6 for the honesty rationale).
 *
 * Usage:
 *   node scripts/import-mode-stats-csv.mjs <path-to-csv> \
 *     --mode gem-grab \
 *     [--exported-at 2026-07-11] [--note "..., Gem Grab, rank bracket unspecified"]
 *
 * Expected CSV columns: Brawler, WinRate, PickRate, Score (WinRate/PickRate as 0-1 fractions or
 * "NN.NN%" strings; Score as a raw number, higher = better).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parseCsv, findColumnIndex, parseArgs } from "./import-brawltime-csv.mjs";
import { resolveBrawlerId } from "./brawler-ids.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(
  __dirname,
  "../src/lib/recommendation-engine/real-data/generated-mode-stats.json",
);

function parseFractionOrPercent(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw.trim().replace(/%/g, ""));
  if (Number.isNaN(n)) return undefined;
  // Accept either a 0-1 fraction (0.0538) or an explicit percentage string (5.38%) — the % strip
  // above already normalizes "5.38%" to "5.38", so anything above 1.5 is treated as 0-100 scale.
  return n > 1.5 ? n / 100 : n;
}

function parseScoreValue(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return undefined;
  const n = Number.parseFloat(raw.trim());
  return Number.isNaN(n) ? undefined : n;
}

/** Percentile rank (0 = lowest, 1 = highest) of `key` within the same mode's entries. */
function computePercentileFor(entries, key) {
  const sorted = [...entries].sort((a, b) => a[key] - b[key]);
  const n = sorted.length;
  const percentileById = new Map();
  sorted.forEach((entry, index) => {
    percentileById.set(entry.brawlerId, n > 1 ? index / (n - 1) : 1);
  });
  return percentileById;
}

/** 1-indexed rank by score, descending (1 = highest score = best in this mode). */
function computeScoreRanks(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const rankById = new Map();
  sorted.forEach((entry, index) => rankById.set(entry.brawlerId, index + 1));
  return rankById;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args._[0];
  if (!csvPath || !args.mode) {
    console.error(
      'Usage: node scripts/import-mode-stats-csv.mjs <file.csv> --mode <modeId> [--exported-at YYYY-MM-DD] [--note "..."]',
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
  const winRateCol = findColumnIndex(header, /win.?rate/i);
  const pickRateCol = findColumnIndex(header, /pick.?rate/i);
  const scoreCol = findColumnIndex(header, /score/i);
  if (brawlerCol === -1 || winRateCol === -1 || pickRateCol === -1 || scoreCol === -1) {
    console.error(
      `Could not find required columns in header: ${JSON.stringify(header)}. Expected "Brawler", "WinRate", "PickRate", and "Score" columns.`,
    );
    process.exit(1);
  }

  const modeId = args.mode;
  const exportedAt = args["exported-at"] || new Date().toISOString().slice(0, 10);
  const sourceNote = args.note || `brawltime.ninja-style mode stats export, mode=${modeId}, rank bracket unspecified`;

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
    const winRate = parseFractionOrPercent(row[winRateCol]);
    const pickRate = parseFractionOrPercent(row[pickRateCol]);
    const score = parseScoreValue(row[scoreCol]);
    if (winRate === undefined || pickRate === undefined || score === undefined) continue;
    parsed.push({ brawlerId, winRate, pickRate, score });
  }

  if (unmatched.length > 0) {
    console.warn(
      `Skipped ${unmatched.length} row(s) for Brawlers not in this app's seeded roster (src/lib/data/brawlers.ts): ${[...new Set(unmatched)].join(", ")}`,
    );
  }

  const winRatePercentileById = computePercentileFor(parsed, "winRate");
  const pickRatePercentileById = computePercentileFor(parsed, "pickRate");
  const scoreRankById = computeScoreRanks(parsed);
  const total = parsed.length;

  let existing = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  }
  const keep = existing.filter((r) => r.modeId !== modeId);
  const imported = parsed.map((entry) => ({
    brawlerId: entry.brawlerId,
    modeId,
    winRate: entry.winRate,
    pickRate: entry.pickRate,
    score: entry.score,
    winRatePercentile: winRatePercentileById.get(entry.brawlerId),
    pickRatePercentile: pickRatePercentileById.get(entry.brawlerId),
    scoreRank: scoreRankById.get(entry.brawlerId),
    scoreRankTotal: total,
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

export { parseFractionOrPercent, parseScoreValue, computePercentileFor, computeScoreRanks };
