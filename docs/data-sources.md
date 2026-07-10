# Data Source Plan

## 1. Source priority (per spec §8)

1. **Official Brawl Stars API and game metadata** — Brawler catalog, player collections, and (via
   continuous polling of consenting users' battle logs) our own accumulating match records. This is
   the only source we treat as ground truth for anything statistical.
2. **Properly licensed or explicitly permitted statistical datasets** — none identified or integrated
   yet. If one is found (e.g. a dataset with a clear license permitting redistribution/derivative use),
   it would be documented here with its license terms before use. **Not currently in use — no dataset
   has been vetted.**
3. **Anonymized match data contributed by users with consent** — architecturally supported by the
   schema in `docs/implementation-plan.md` (`matches`, `match_participants` keyed by internal IDs, not
   raw player tags in aggregate tables), but no collection mechanism is built yet (Phase 4).
4. **Curated metadata maintained within the project** — `brawler_role_features` (tags like "tank",
   "anti-assassin", "wall breaker") is necessarily hand-maintained; there is no official API field that
   labels Brawler roles. This is explicitly labeled **heuristic**, not statistical, everywhere it
   surfaces in the UI, per spec §6.2.
5. **Community sources** — used for exactly one thing so far: per-Brawler map/mode/rank win rate,
   manually exported by a human from brawltime.ninja's own "Export CSV" button and imported via
   `scripts/import-brawltime-csv.mjs` (see `data/brawltime/README.md` and §2b below). This is real
   match data, sourced from a community-run, independently-operated stats site (not Supercell), and
   is always labeled as such in the UI — never presented with the confidence of an official-API
   source, and never fetched automatically (see §5.1 for why not).

## 2. What is real vs. seeded today

Being explicit about this because the spec repeatedly warns against disguising mock behavior as
production behavior (§18, §19.14):

| Data | Status in this delivery |
|---|---|
| Brawler list, names, roles/tags | **Seeded by hand** in `src/lib/data/brawlers.ts`. A real deployment must replace/reconcile this against `GET /v1/brawlers` in Phase 3 — that endpoint gives us canonical IDs/names, but not roles/tags (see source #4 above), so role tags stay hand-maintained even after Phase 3. |
| Maps, modes | **Seeded by hand**, a small representative set for the prototype, not the full current map rotation. |
| Draft formats | **Seeded from verified research** in `docs/discovery.md` §2 (three formats: no-ban free pick, Diamond simultaneous-ban turn pick, Mythic snake draft with captain). Marked with a `source: "verified-2026-07"` style note in config so it's obvious when it needs re-checking against live patch notes. |
| Map/mode win rates | **Mock by default, real where imported.** `src/lib/recommendation-engine/hybrid-dataset.ts` overlays real per-Brawler win/use rate rows (from a manually-exported brawltime.ninja CSV, see §2b) on top of the seeded mock dataset for whichever (map, mode, rank bucket) combinations have actually been imported; everything else still falls back to mock. `generated-map-stats.json` ships empty, so out of the box this is 100% mock until someone runs the import script. |
| Matchup rates, synergy rates | **100% mock/seeded** in `src/lib/recommendation-engine/mock-data.ts` — brawltime.ninja's simple per-Brawler export doesn't carry matchup-pair or ally-pair data, so there is no real-data path for these yet. Generated to be internally consistent (so the engine's math is testable) but not derived from any real match data. |
| Player Brawler collections | Not fetched (no live API integration yet). Setup screen supports manual entry of "available Brawlers" so the recommendation-filtering logic can be exercised and tested honestly without pretending to call a live API. |
| Rank-bracket skew (a Brawler being stronger at low elo but easily countered at high elo, or vice versa) | **Mechanism is real, inputs are curated.** `BRAWLER_RANK_SKEW` in `src/lib/data/brawlers.ts` is a hand-curated -1..+1 value per Brawler; `getMapStat`/`getMatchup` in the mock dataset apply it as a genuine, monotonic function of the selected rank bucket (see §2a below). The *shape* of the effect is real and tested; the specific skew numbers are heuristic guesses, not measured from real rank-segmented data. |
| Patch buff/nerf reactivity (a recent buff/nerf shifting a Brawler's recommendation) | **Mechanism is real, patch list is seeded.** `MOCK_PATCH_HISTORY` in `mock-data.ts` lists which Brawlers were buffed/nerfed per patch; `getMetaStrength`/`getMetaTrend` react to it immediately. In Phase 4 this same shape is populated from the real `balance_patches` table instead of being hand-written — no engine code changes when that happens. |

No part of the Phase 1/2 delivery calls the network. This is intentional — it lets the draft engine
and recommendation engine be fully built and tested against the real constraints (formats, filtering,
scoring math) before taking on the added complexity and failure modes of a live integration.

### 2a. Rank-bracket and patch reactivity, in more detail

Two specific mechanisms exist now, in the seeded dataset, in response to a real product requirement
(a Brawler can be great at low elo and a trap pick at high elo once opponents know how to punish it,
and stats must react automatically when a patch buffs/nerfs a Brawler):

- **Rank skew** (`src/lib/data/ranks.ts` + `BRAWLER_RANK_SKEW`): rank buckets are ordered low-to-high
  (Diamond → Mythic → Legendary → Masters), each Brawler has a curated -1..+1 skew, and the mock
  win-rate/matchup functions apply `skew * bucketPosition` as an explicit, monotonic term — not as
  extra hash noise. That's what makes it possible to state, and test, "this Brawler's recommendation
  score is lower at Masters than at Diamond." The "all ranks" bucket is neutral (no skew applied),
  matching its role as an aggregate/default view. **What's still heuristic**: the specific -1..+1
  number per Brawler. Replacing it with truth requires rank-segmented real match data (the
  `rank_bucket` column already exists throughout the schema in `docs/implementation-plan.md` for
  exactly this reason).
- **Patch reactivity** (`MOCK_PATCH_HISTORY` in `mock-data.ts`): each patch entry lists which
  Brawlers were buffed or nerfed; `getMetaStrength` reads the current patch id and applies a
  deterministic adjustment, and `getMetaTrend` exposes "buffed"/"nerfed"/"stable" so the UI can
  explain *why* a score moved ("Recently buffed this patch — historical stats may understate current
  strength"). Adding a new patch is a one-line data change, not a code change — the mechanism this
  delivery was missing wasn't "can the system react to patches," it's "do we have a real, continuously
  updated feed of patch notes and post-patch match data," which remains Phase 4 work (see §4 below;
  in particular the `exp(-lambda * ageInDays)` decay of pre-patch matches described there is not yet
  implemented, since there's no real pre/post-patch match data to decay between in the mock dataset).

### 2b. Real map win-rate data via manual brawltime.ninja export

[brawltime.ninja](https://brawltime.ninja) is an independent, community-run Brawl Stars statistics
site (not affiliated with Supercell) that exposes an explicit **"Export CSV"** button on its
dashboard. That's meaningfully different from scraping: it's a user-initiated export of a file the
site itself chose to offer, not an automated bulk pull against their backend. This app's pipeline:

1. A human sets the dashboard's filters (map, mode = Ranked, rank bracket, season) and clicks
   **Export CSV** in their own browser — see `data/brawltime/README.md` for the exact settings.
2. `scripts/import-brawltime-csv.mjs` parses that file (Brawler name → this app's Brawler id, win
   rate, optionally use rate) and merges it into
   `src/lib/recommendation-engine/real-data/generated-map-stats.json`, keyed by
   `(brawlerId, mapId, modeId, rankBucket)`.
3. `hybrid-dataset.ts` reads that file and answers `getMapStat` from it when a real row exists for
   the requested lookup, falling back to the seeded mock dataset otherwise. The scoring engine
   itself never knows which one it got — same interface boundary as always
   (`docs/architecture.md` §2).
4. Every affected recommendation is labeled: the draft screen's header shows whether the *current*
   map/mode/rank combination is backed by real imported data or still mock, and any "map_strength"
   explanation for a real-data-backed record says so explicitly ("... (real brawltime.ninja data)").

What this does **not** do: it does not make an outbound network request to brawltime.ninja from
this app or its build process (confirmed — this sandboxed environment's network policy blocks that
host entirely, so it isn't even possible here), it does not cover matchup or synergy data (only
per-Brawler map win/use rate, since that's what the simple "Group By: Brawler" export contains),
and it does not run on any schedule — refreshing means re-exporting by hand and re-running the
script, same as the spec's own emphasis on never silently blending incompatible patches (§7.2):
each import is stamped with its own `exportedAt` date and is fully replaced (not merged/averaged)
the next time that same map/mode/rank combination is re-imported.

## 3. Statistical record shapes (for Phase 4 ingestion, designed now)

See `docs/implementation-plan.md` for the full schema. The important design decision here: aggregate
statistical rows are always keyed by `(brawler_id, map_id, game_mode_id, patch_id, rank_bucket)` (or
the matchup/synergy equivalent with a second Brawler), never just `brawler_id` — this is what makes
patch-isolation and rank-bracket-isolation possible later without a migration.

## 4. Ingestion pipeline (design only — not built in Phase 1)

Documented now so Phase 4 has a spec to build against, per the spec's own pipeline list (§8.1):

1. Refresh Brawler metadata from `/v1/brawlers` on a schedule (this changes rarely — balance patches).
2. Poll `battlelog` for a known set of consenting, opted-in player tags (this is the *only* legal way
   we can accumulate match history, since there is no bulk/firehose match feed — see
   `docs/discovery.md` §1.4).
3. Validate incoming battles: known Brawler IDs, known map/mode IDs, plausible team sizes, no
   duplicate battle records (battles have a timestamp + participant set we can hash for dedup).
4. Assign each battle to a `patch_id` by its timestamp against the `balance_patches` table.
5. Recompute aggregates (`brawler_map_stats`, `brawler_matchup_stats`, `brawler_synergy_stats`) using
   the Bayesian shrinkage estimate in `docs/implementation-plan.md` §4.
6. Run data-quality checks (§8.3 of the spec) before publishing.
7. Publish a new `dataset_versions` row only if checks pass; otherwise keep serving the last known-good
   version and log the rejected batch.

This pipeline is not implemented in this delivery. Building it prematurely, before there is a real
source of consenting battle data to feed it, would itself be exactly the kind of "fake production
behavior disguised as completed functionality" the spec warns against.

## 5. Explicit non-sources, and where the brawltime.ninja import fits

We will not **scrape or automatically poll** third-party stat sites, tier-list sites, or unofficial
API wrappers. Their own data ultimately derives from the same official API under their own terms,
automated bulk collection adds a legal/ToS risk with no statistical benefit over polling the
official API ourselves for consenting users (Phase 4), and — as a practical matter — this app's own
build/dev environment cannot reach third-party hosts like brawltime.ninja over the network at all.

The brawltime.ninja CSV import (§2b) is deliberately **not** an exception to that rule so much as a
different activity entirely: a human uses the site's own explicit "Export CSV" feature in their own
browser session, and only the resulting file — never a live request to the site — enters this
project. No credentials, automation, or scheduled job talks to brawltime.ninja. If that boundary
ever needs to move (e.g. towards an automated refresh), it would require actually reaching out to
brawltime.ninja's maintainer for explicit permission/terms first, at which point it would be
documented here as a proper source-priority-#2 licensed dataset instead of a manual §2b import.
