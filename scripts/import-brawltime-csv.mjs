#!/usr/bin/env node
/**
 * Imports a CSV exported by hand from brawltime.ninja's dashboard "Export CSV" button into
 * src/lib/recommendation-engine/real-data/generated-map-stats.json, which the app reads at build
 * time via hybrid-dataset.ts. This is NOT a scraper: brawltime.ninja is never contacted by this
 * script. A human exports the file in their own browser (see data/brawltime/README.md for the
 * exact dashboard settings to use), then runs this script by hand to bring it into the app.
 *
 * Usage:
 *   node scripts/import-brawltime-csv.mjs <path-to-csv> \
 *     --map hard-rock-mine --mode gem-grab --rank legendary \
 *     [--sample-size 3000] [--exported-at 2026-07-10] [--note "brawltime.ninja, Legendary I-Masters"]
 *
 * Known map/mode ids are the same ones used throughout the app: see src/lib/data/maps.ts and
 * src/lib/data/modes.ts. --rank must be one of the ids in src/lib/data/ranks.ts (e.g. "diamond",
 * "mythic", "legendary", "masters"). brawltime.ninja's own rank filter is a *range* (e.g.
 * "Legendary I-Masters"); pick whichever single bucket in this app's coarser list the export
 * best represents, and say so in --note.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { normalizeBrawlerName, resolveBrawlerId } from "./brawler-ids.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(
  __dirname,
  "../src/lib/recommendation-engine/real-data/generated-map-stats.json",
);

function parseCsv(text) {
  // Minimal RFC4180-ish parser: handles quoted fields containing commas, escaped quotes ("").
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function parseRateValue(raw) {
  if (raw === undefined || raw === null || raw.trim() === "") return undefined;
  const cleaned = raw.trim().replace(/%/g, "").replace(/,/g, "");
  const n = Number.parseFloat(cleaned);
  if (Number.isNaN(n)) return undefined;
  // Heuristic: exported percentages are usually "54.3" or "54.3%" (0-100 scale); occasionally a
  // fraction like "0.543" (0-1 scale). Anything clearly above 1.5 is treated as a 0-100 percentage.
  return n > 1.5 ? n / 100 : n;
}

function findColumnIndex(headerRow, pattern) {
  return headerRow.findIndex((h) => pattern.test(h.trim()));
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      args[key] = value;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvPath = args._[0];
  if (!csvPath || !args.map || !args.mode || !args.rank) {
    console.error(
      "Usage: node scripts/import-brawltime-csv.mjs <file.csv> --map <mapId> --mode <modeId> --rank <rankBucketId> [--sample-size N] [--exported-at YYYY-MM-DD] [--note \"...\"]",
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
  const useRateCol = findColumnIndex(header, /use.?rate/i);

  if (brawlerCol === -1 || winRateCol === -1) {
    console.error(
      `Could not find required columns in header: ${JSON.stringify(header)}. Expected a "Brawler" column and a "Win Rate" column.`,
    );
    process.exit(1);
  }

  const sampleSize = args["sample-size"] ? Number.parseInt(args["sample-size"], 10) : 3000;
  const exportedAt = args["exported-at"] || new Date().toISOString().slice(0, 10);
  const sourceNote = args.note || "brawltime.ninja export";

  const imported = [];
  const unmatched = [];
  for (const row of rows.slice(1)) {
    const rawName = row[brawlerCol];
    if (!rawName) continue;
    const brawlerId = resolveBrawlerId(rawName);
    if (!brawlerId) {
      unmatched.push(rawName);
      continue;
    }
    const winRate = parseRateValue(row[winRateCol]);
    if (winRate === undefined) continue;
    const useRate = useRateCol !== -1 ? parseRateValue(row[useRateCol]) : undefined;
    imported.push({
      brawlerId,
      mapId: args.map,
      modeId: args.mode,
      rankBucket: args.rank,
      winRate,
      ...(useRate !== undefined ? { useRate } : {}),
      sampleSize,
      exportedAt,
      sourceNote,
    });
  }

  if (unmatched.length > 0) {
    console.warn(
      `Skipped ${unmatched.length} row(s) for Brawlers not in this app's seeded roster (src/lib/data/brawlers.ts): ${[...new Set(unmatched)].join(", ")}`,
    );
  }

  let existing = [];
  if (existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8"));
  }
  const keep = existing.filter(
    (r) => !(r.mapId === args.map && r.modeId === args.mode && r.rankBucket === args.rank),
  );
  const next = [...keep, ...imported].sort(
    (a, b) =>
      a.mapId.localeCompare(b.mapId) ||
      a.modeId.localeCompare(b.modeId) ||
      a.rankBucket.localeCompare(b.rankBucket) ||
      a.brawlerId.localeCompare(b.brawlerId),
  );
  writeFileSync(OUTPUT_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(`Imported ${imported.length} row(s) into ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

// Only run when executed directly (`node scripts/import-brawltime-csv.mjs ...`), not when imported
// by tests — parseCsv/parseRateValue/normalizeBrawlerName are exported below for unit testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseCsv, parseRateValue, normalizeBrawlerName, findColumnIndex, parseArgs };
