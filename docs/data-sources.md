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
5. **Community sources** — not used in this delivery. If ever used, must be legally usable and clearly
   labeled as such in the UI (e.g. "community-sourced, unverified" tag), never presented with the same
   confidence as (1)-(3).

## 2. What is real vs. seeded today

Being explicit about this because the spec repeatedly warns against disguising mock behavior as
production behavior (§18, §19.14):

| Data | Status in this delivery |
|---|---|
| Brawler list, names, roles/tags | **Seeded by hand** in `src/lib/data/brawlers.ts`. A real deployment must replace/reconcile this against `GET /v1/brawlers` in Phase 3 — that endpoint gives us canonical IDs/names, but not roles/tags (see source #4 above), so role tags stay hand-maintained even after Phase 3. |
| Maps, modes | **Seeded by hand**, a small representative set for the prototype, not the full current map rotation. |
| Draft formats | **Seeded from verified research** in `docs/discovery.md` §2 (three formats: no-ban free pick, Diamond simultaneous-ban turn pick, Mythic snake draft with captain). Marked with a `source: "verified-2026-07"` style note in config so it's obvious when it needs re-checking against live patch notes. |
| Map/mode win rates, matchup rates, synergy rates, confidence scores | **100% mock/seeded** in `src/lib/recommendation-engine/mock-data.ts`, generated to be internally consistent (so the engine's math is testable) but **not derived from any real match data**. Every recommendation surfaced in the UI carries a visible "seeded/mock dataset" version string so this is never confused with real statistics. |
| Player Brawler collections | Not fetched (no live API integration yet). Setup screen supports manual entry of "available Brawlers" so the recommendation-filtering logic can be exercised and tested honestly without pretending to call a live API. |

No part of the Phase 1/2 delivery calls the network. This is intentional — it lets the draft engine
and recommendation engine be fully built and tested against the real constraints (formats, filtering,
scoring math) before taking on the added complexity and failure modes of a live integration.

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

## 5. Explicit non-sources

We will not scrape or ingest data from third-party stat sites, tier-list sites, or unofficial API
wrappers (e.g. community Brawl Stars stats trackers). Their own data ultimately derives from the same
official API under their own terms, and re-scraping them adds a legal/ToS layer of risk with no
statistical benefit over polling the official API ourselves for consenting users. This may be revisited
only if a specific dataset is found to be explicitly licensed for reuse (source priority #2).
