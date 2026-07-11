# Importing real data from brawltime.ninja

This app can use real win-rate data for a map/mode/rank bracket, imported from a CSV you export by
hand from [brawltime.ninja](https://brawltime.ninja/dashboard). This directory is where you keep
your exported `.csv` files (not committed unless you want to — the *parsed* result lives in
`src/lib/recommendation-engine/real-data/generated-map-stats.json`, which is what the app actually
reads).

## Why manual export, not automatic fetching

This project's own policy (see `docs/data-sources.md`) is that we don't scrape third-party stat
sites automatically — their data ultimately comes from the same official Brawl Stars API, under
their own terms, and we have no license or agreement with brawltime.ninja to redistribute or
auto-poll their data. What we *can* do is use the CSV file **you** produce by clicking their own
"Export CSV" button in your own browser session — that's an explicit, user-initiated export, not
scraping. It's also the only option available in practice: this app's sandboxed dev/build
environment cannot reach brawltime.ninja over the network at all (it's outside this session's
network policy), so the import has to start from a file, not a live request.

## 1. Export a CSV from brawltime.ninja

1. Go to <https://brawltime.ninja/dashboard>.
2. Under **Configure Data Source**: Source = "All Battle Data", Metric = "Win Rate" (export it a
   second time with Metric = "Use Rate" if you want that too — the importer accepts either or
   both in one file if the export has both columns), Group By = "Brawler".
3. Under **Filter Data Source**: set **Brawler** = "Any Brawler", pick the **Map** you care about
   (or leave "All Maps" and do one export per map you want — the importer needs one map/mode/rank
   combination per run), set the mode filter to **Ranked**, and pick the season/date range and
   rank bracket you want (e.g. "Legendary I-Masters"). This mirrors the settings in the app's own
   screenshot walkthrough.
4. Click **Export CSV** and save the file into this folder, e.g.
   `data/brawltime/hard-rock-mine-gemgrab-legendary-masters.csv`.

## 2. Import it into the app

```bash
node scripts/import-brawltime-csv.mjs data/brawltime/hard-rock-mine-gemgrab-legendary-masters.csv \
  --map hard-rock-mine \
  --mode gem-grab \
  --rank legendary \
  --sample-size 5000 \
  --exported-at 2026-07-10 \
  --note "brawltime.ninja, Ranked, Legendary I-Masters, since 2026-06-22"
```

- `--map` / `--mode` must match the ids in `src/lib/data/maps.ts` / `src/lib/data/modes.ts`.
- `--rank` must match one of the ids in `src/lib/data/ranks.ts` (`diamond`, `mythic`, `legendary`,
  `masters`, or `all`). brawltime.ninja's rank filter is a *range* (e.g. "Legendary I-Masters"),
  which doesn't map to exactly one of this app's coarser buckets — pick the closest one and record
  the real range in `--note` so it's auditable later.
- `--sample-size` is a stand-in: brawltime.ninja's CSV export doesn't include a per-Brawler battle
  count, only a page-level total (e.g. "Sample Size: 2.81M Battles"). Rather than invent a precise
  number, pass a conservative shared estimate; it only affects how much the Bayesian-shrinkage math
  pulls the number toward 50% and how "high/moderate/low confidence" is displayed — the win rate
  itself comes straight from the export.
- Re-running the command for the same `--map --mode --rank` replaces the previous import for that
  combination (so refreshing after a new patch is just re-exporting and re-running).

## 3. What this does and doesn't cover

Only per-Brawler map/mode/rank **win rate** (and use rate, if present) becomes real. Enemy-matchup
scores, ally-synergy scores, role/archetype tags, and patch buff/nerf metadata are still the seeded
mock dataset described in `docs/data-sources.md` — brawltime.ninja's simple "Group By: Brawler"
export doesn't carry matchup-pair or synergy-pair data. The app labels this precisely: a
recommendation whose map-performance number came from your import says so directly ("real
brawltime.ninja data"), and the draft screen's rank/map banner turns green when the active
map/mode/rank combination has real data loaded, amber when it's still on the mock fallback.

## 4. Brawler name matching

The importer only recognizes the Brawlers already seeded in `src/lib/data/brawlers.ts` (105 as of
this writing — every Brawler named in a user-provided drafting guide, every Brawler appearing in
the real pick-rate export in step 5 below, and Nori, added because the step 6 exports included it).
Any CSV row for a Brawler outside that set is
skipped with a warning printed to the console; it isn't silently dropped without telling you. Both
import scripts resolve names to ids via `scripts/brawler-ids.mjs`, kept in sync with
`src/lib/data/brawlers.ts` by hand.

## 5. Importing pick-rate (popularity) data instead of win rate

If your export is a **global, non-map-specific pick-rate snapshot** (dashboard: Metric = "Pick
Rate" or "Use Rate", Map = "All Maps", Group By = "Brawler"), use the other importer instead —
this data doesn't get written into map win rate at all (see `docs/data-sources.md` §2d for why pick
rate and win rate are kept strictly separate):

```bash
node scripts/import-pickrate-csv.mjs data/brawltime/legendary-masters-pickrate.csv \
  --rank legendary,masters \
  --exported-at 2026-07-10 \
  --note "brawltime.ninja, Ranked pick rate, Legendary I-Masters"
```

`--rank` takes a comma-separated list because one export commonly spans a *range* of this app's
rank buckets (brawltime.ninja's "Legendary I-Masters" spans both `legendary` and `masters`) — the
same real numbers are written to each bucket named, with that fact recorded in `--note`. The result
lands in `src/lib/recommendation-engine/real-data/generated-pick-rates.json` as a 0-1 percentile
per Brawler per rank bucket, and shows up in recommendations as a `meta_popularity` reason on
Brawlers with real, high pick rate at the active rank bucket — never as a claim about win rate.

## 6. Importing per-mode win rate / pick rate / score data instead (a third, independent axis)

If your export gives **win rate, pick rate, AND a composite ranking score per Brawler for one
specific game mode** (all maps/ranks combined for that mode), use a third importer — this carries
genuinely more than step 5 above (which is pick-rate/use-rate only, no win rate):

```bash
node scripts/import-mode-stats-csv.mjs data/brawltime/mode-stats-gem-grab.csv \
  --mode gem-grab \
  --exported-at 2026-07-11 \
  --note "user-provided export, Ranked, Gem Grab, all maps, rank bracket unspecified"
```

Expected CSV columns: `Brawler`, `WinRate`, `PickRate`, `Score` (rates as either 0-1 fractions or
`"NN.NN%"` strings; Score as a raw number, higher = better). This is a genuinely different axis
from step 5 above: it's scoped to one *mode* (all ranks combined) instead of one *rank bucket* (all
modes combined) — the two are never averaged together. If the export you're working from doesn't
state which rank bracket it came from (this app's own seed data, six real exports covering Gem
Grab/Brawl Ball/Bounty/Heist/Hot Zone/Knockout, didn't), say so honestly in `--note` rather than
guessing one, and the resulting numbers are applied the same way regardless of the rank bucket
selected in the app.

The result lands in `src/lib/recommendation-engine/real-data/generated-mode-stats.json` with a
win-rate percentile, a pick-rate percentile, and a 1-indexed rank by the source's own composite
score. Win rate feeds a `modeWinRate` reason/warning (genuinely measured strength — this app's
single highest-weighted positive scoring term, per an explicit request to weight real per-mode data
more strongly than the mostly-mock map-level data); pick rate feeds `mode_popularity` (popularity,
kept strictly separate from win rate, same as `meta_popularity` above); the composite score is
stored only for "ranked #N of M" explanatory text, not as a fourth weighted term (it would just
double-count win rate + pick rate under a different name). `modeWinRate` also drives "initial
recommended bans" — before any picks/bans reveal enemy-specific signal, the ban list is dominated
by real per-mode win rate.
