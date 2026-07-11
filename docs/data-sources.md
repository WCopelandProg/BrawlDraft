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
   surfaces in the UI, per spec §6.2. This now also includes a simplified 9-class drafting
   framework (Assassin/Tank/Speedster/Anti-Agro/Damage Dealer/Trapper/Support/Sharpshooter/
   Controller, grouped into Aggressive/Defensive/Passive archetypes that counter each other in a
   fixed cycle) contributed by a user from their own hand-made drafting guide — see §2c below.
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
| Maps, modes | **Modes confirmed, maps best-effort.** The 6 modes in `src/lib/data/modes.ts` (Gem Grab, Brawl Ball, Bounty, Heist, Hot Zone, Knockout) are confirmed via web search (July 2026) as the actual live Ranked mode rotation — every Ranked match is a random one of these 6 on a random map from that mode's pool, 4 maps/mode (24 total). The specific map names in `src/lib/data/maps.ts` (4 per mode) could **not** be verified against a live source in this environment — brawlify.com, brawltime.ninja, and the Brawl Stars Fandom wiki all return HTTP 403 to automated fetches here — so they're this assistant's own best-effort recall of maps that have recurred across many past seasons, not a guaranteed-current list. Ranked maps rotate every season; edit `maps.ts` directly if one has since rotated out. |
| Draft formats | **Seeded from verified research** in `docs/discovery.md` §2 (three formats: no-ban free pick, Diamond simultaneous-ban turn pick, Mythic snake draft with captain). Marked with a `source: "verified-2026-07"` style note in config so it's obvious when it needs re-checking against live patch notes. |
| Map/mode win rates | **Mock by default, real where imported.** `src/lib/recommendation-engine/hybrid-dataset.ts` overlays real per-Brawler win/use rate rows (from a manually-exported brawltime.ninja CSV, see §2b) on top of the seeded mock dataset for whichever (map, mode, rank bucket) combinations have actually been imported; everything else still falls back to mock. `generated-map-stats.json` ships empty, so out of the box this is 100% mock until someone runs the import script. |
| Matchup rates, synergy rates | **100% mock/seeded** in `src/lib/recommendation-engine/mock-data.ts` — brawltime.ninja's simple per-Brawler export doesn't carry matchup-pair or ally-pair data, so there is no real-data path for these yet. Generated to be internally consistent (so the engine's math is testable) but not derived from any real match data. |
| Player Brawler collections | Not fetched (no live API integration yet). Setup screen supports manual entry of "available Brawlers" so the recommendation-filtering logic can be exercised and tested honestly without pretending to call a live API. |
| Rank-bracket skew (a Brawler being stronger at low elo but easily countered at high elo, or vice versa) | **Mechanism is real, inputs are curated.** `BRAWLER_RANK_SKEW` in `src/lib/data/brawlers.ts` is a hand-curated -1..+1 value per Brawler; `getMapStat`/`getMatchup` in the mock dataset apply it as a genuine, monotonic function of the selected rank bucket (see §2a below). The *shape* of the effect is real and tested; the specific skew numbers are heuristic guesses, not measured from real rank-segmented data. |
| Patch buff/nerf reactivity (a recent buff/nerf shifting a Brawler's recommendation) | **Mechanism is real, patch list is seeded.** `MOCK_PATCH_HISTORY` in `mock-data.ts` lists which Brawlers were buffed/nerfed per patch; `getMetaStrength`/`getMetaTrend` react to it immediately. In Phase 4 this same shape is populated from the real `balance_patches` table instead of being hand-written — no engine code changes when that happens. |
| Meta popularity (pick rate) | **Real**, as of this writing. `generated-pick-rates.json` holds a real, user-provided brawltime.ninja pick-rate-by-Brawler export (Ranked, Legendary I-Masters), imported into the `legendary` and `masters` rank buckets via `scripts/import-pickrate-csv.mjs`. This is genuinely measured popularity, not fabricated — see §2d below for exactly what it does and doesn't imply. |
| Mode win rate / mode popularity (win rate + pick rate + a composite ranking score, per game mode) | **Real**, as of this writing. `generated-mode-stats.json` holds 6 real, user-provided per-mode exports covering all 6 Ranked modes (Gem Grab, Brawl Ball, Bounty, Heist, Hot Zone, Knockout), imported via `scripts/import-mode-stats-csv.mjs`. Two distinct real signals from this one import — `modeWinRate` (genuinely measured strength) and `modePopularity` (pick-rate percentile) — plus a `scoreRank`/`scoreRankTotal` used only for explanatory "ranked #N" text, not as its own scoring term. This is this app's single highest-weighted positive scoring term (see §2e below and `weights.ts`) per an explicit user request to weight real per-mode data more strongly than the mostly-mock map-level data. |

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

### 2c. The class/archetype drafting framework

A user contributed a hand-made drafting guide (9 simplified classes — Assassin, Tank, Speedster,
Anti-Agro, Damage Dealer, Trapper, Support, Sharpshooter, Controller — grouped into three
archetypes that counter each other in a fixed cycle: Aggressive beats Passive, Passive beats
Defensive, Defensive beats Aggressive) and asked for it to inform recommendations alongside the
statistical data. This is implemented in `src/lib/recommendation-engine/archetypes.ts`:

- The 9 classes are folded into the existing `RoleTag` vocabulary (4 — tank, assassin, controller,
  support — already existed; speedster, anti_agro, damage_dealer, trapper, and sharpshooter are
  new) rather than kept as a parallel taxonomy, so the pre-existing role-coverage/
  composition-fit/redundancy scoring automatically treats "missing class" the same way it already
  treats "missing role" (the guide's 4th/5th-pick advice: fill whatever archetype your team lacks).
- A new `archetypeCounter` score term computes, for a candidate, how favorably its own
  aggressive/defensive/passive mix counters the enemy's revealed mix, using the guide's cycle. It's
  additive alongside the statistical `matchupValue` term, not a replacement for it — one is a
  curated heuristic about playstyle categories, the other is per-Brawler-pair statistical data
  (real where imported, mock otherwise). They can and sometimes will disagree; both are surfaced.
- A new `modeClassFit` term implements "the 1st pick of each mode should be the strongest of the
  most important class for that mode" — active *only* when `picksSoFar === 0` (the literal first
  action of the draft), using a per-mode priority-class list (`MODE_PRIORITY_CLASSES`) derived from
  the guide's own worked examples. Now covers all 6 seeded modes: Heist and Hot Zone follow Gem
  Grab/Brawl Ball's "aggro-meta" template (anti_agro/tank_counter-favored first pick), and Bounty
  follows Knockout's "passive-meta" template (sharpshooter/support favored), per the class-counters
  video summary's own mode-meta split (see `AGGRO_META_MODE_IDS`/`PASSIVE_META_MODE_IDS` in
  `class-counters.ts`).
- The redundancy penalty now decays toward the last pick (per the guide: "2 of the same class can
  sometimes overwhelm their natural counters... not a huge issue" late in the draft), the mirror of
  the existing counter-risk penalty, which *increases* toward the last pick.
- Adding the roster needed to make this framework usable required expanding
  `src/lib/data/brawlers.ts` from 16 to 54 Brawlers (every Brawler named in the guide). Their
  `rarity` field is marked `"Unverified"` rather than guessed — that field is cosmetic display text
  only and never used in scoring, so it was left honest rather than fabricated. A few Brawlers the
  guide names only as mode-first-pick examples, without stating a class outright (Mina, Gray, Gus,
  Pierce, JaeYong, Finx), have their class inferred from that mode context — heuristic on top of
  heuristic, flagged in a code comment in `brawlers.ts`.

**Known limitation, stated plainly**: the guide's pick-2/pick-3 advice ("pick 3 should hard-counter
the enemy's pick 1... pick 2 should cover pick 3's weakness") describes a *two-ply lookahead* — planning
pick 2 around a pick 3 that doesn't exist yet. This app's scorer is a single-ply, greedy-per-pick
scorer (score every legal candidate for the action happening right now); it does not search forward
over hypothetical future picks. In practice the existing draft-position weighting plus the new
archetype-counter term tend to produce complementary comps anyway (an early pick that's flexible
and uncommitted, later picks that increasingly favor direct counters), but this is a real,
acknowledged simplification, not a claim that multi-pick planning is implemented.

### 2d. Real pick-rate data (imported, live in this repo as of this writing)

A user provided a real CSV export from brawltime.ninja's dashboard: general pick rate by Brawler
for real Ranked matches, Legendary I-Masters, all maps/modes combined
(`data/brawltime/legendary-masters-pickrate.csv`). This was imported with:

```
node scripts/import-pickrate-csv.mjs data/brawltime/legendary-masters-pickrate.csv \
  --rank legendary,masters --exported-at 2026-07-10 \
  --note "brawltime.ninja, Ranked pick rate, Legendary I-Masters, provided by user 2026-07-10"
```

All 104 of this app's Brawlers matched a row in the export (a since-removed guide-derived
`ninja` entry — not a real Brawl Stars character — was the one exception before it was deleted from
the roster; it isn't the same entry as the export's `Najia`, which was added as its own Brawler
rather than guessed to be a rename, per the same no-fabrication rule as everything else in this
file). The result lives in
`src/lib/recommendation-engine/real-data/generated-pick-rates.json` and is genuinely real: every
number in it is exactly what the user pasted, converted to a 0-1 popularity percentile per rank
bucket (§2b's `computePercentiles`).

**What this real data does and does not claim.** Pick rate measures what real Legendary-Masters
players actually chose to play — that's a real, useful signal (it's evidence of what the current
competitive community considers worth picking), but it is popularity, not a measured win rate. A
heavily-picked Brawler is *not* thereby proven to be statistically strong (overpicked-but-mediocre
and underpicked-but-strong Brawlers both exist), so this data feeds its own `metaPopularity` score
term rather than being written into `adjustedWinRate`, and every recommendation it influences says
so explicitly in its own words ("... reflects real pick-rate data, not measured win rate"). This
is the same honesty boundary as everywhere else in this document — real data is used as exactly
what it is, not stretched to claim something stronger.

**Coverage**: this only affects the `legendary` and `masters` rank buckets (where the export
applies) — `all`/`diamond`/`mythic` still get a neutral 0.5 contribution from this term, since
applying a Legendary-Masters-specific popularity signal to lower brackets would be an unwarranted
generalization the data doesn't support.

### 2e. Real per-mode win rate / pick rate / score data (imported, live in this repo as of this writing)

A user provided 6 real per-mode exports — win rate, pick rate, and a source-computed composite
ranking score, per Brawler, one file per Ranked mode (all maps/ranks combined within that mode) —
`data/brawltime/mode-stats-{gem-grab,brawl-ball,bounty,heist,hot-zone,knockout}.csv`. This
supersedes an earlier, thinner per-mode import that only had a use-rate column (no win rate at
all); that file/script/JSON have been deleted rather than kept alongside a superset. Each mode was
imported with, e.g.:

```
node scripts/import-mode-stats-csv.mjs data/brawltime/mode-stats-gem-grab.csv \
  --mode gem-grab --exported-at 2026-07-11 \
  --note "user-provided export, Ranked, Gem Grab, all maps, rank bracket unspecified"
```

Every row across all 6 files matched a Brawler already in this app's roster (105 rows per mode,
including Nori — see below). The result lives in
`src/lib/recommendation-engine/real-data/generated-mode-stats.json`, with a win-rate percentile and
a pick-rate percentile computed per mode (`computePercentileFor`), plus a 1-indexed `scoreRank`
(best = 1) by the source's own composite score.

**Three real numbers, three different jobs — deliberately not merged into one:**
- `winRate` (raw 0-1 fraction) feeds a new `modeWinRate` score term — genuinely measured strength
  for this specific mode. This is now the single highest-weighted positive term in pick scoring
  (see `weights.ts`), by explicit user request to weight real per-mode data more strongly than the
  mostly-mock map-level `mapPerformance` term, which was reduced to make room for it rather than
  just stacked on top.
- `pickRate` (converted to a percentile) feeds `modePopularity` — popularity, not strength, kept
  as its own term for the same reason `meta_popularity` (§2d, rank-bucket-scoped) is never merged
  with it: a heavily-picked Brawler isn't thereby proven strong, and vice versa.
- `score` (the source's own composite ranking) is stored only for "ranked #N of M" explanatory text
  and to drive initial ban recommendations (see below) — it is deliberately **not** its own third
  weighted scoring term, since it's a derived function of win rate and pick rate this app already
  has as independent, more legible inputs; adding it as a fourth axis would just double-count the
  same underlying signal under a different name.

**Bans**: per an explicit user request ("initial recommended bans... should be the brawlers with
the highest winrates from the datasets"), `modeWinRate` is also the single highest-weighted term in
ban scoring (`DEFAULT_BAN_WEIGHTS.modeWinRate`, see `ban.ts`) — before any picks/bans reveal
enemy-specific signal, the ban list is driven primarily by this real, per-mode win rate. One honest
caveat worth knowing: a few of the resulting top "highest real win rate" bans are low-pick-rate
outliers (e.g. a rarely-played Brawler with a small real sample happening to have a very high win
rate) rather than the mode's most generally-relevant Brawler — that's an inherent small-sample-size
property of "rank purely by win rate," not a bug in how the number is read or applied.

**Coverage and its one honest gap.** All 6 Ranked modes now have real per-mode win rate and pick
rate data, applied regardless of the selected rank bucket. The source exports did not state which
rank bracket they were pulled from — rather than guess a bracket that was never given, this data is
applied the same way across every rank bucket for its mode, and `sourceNote` on every imported row
says "rank bracket unspecified" so this approximation stays auditable instead of silently presented
as bracket-specific.

**Nori.** A newly-released Brawler (confirmed via web research, July 2026: a Legendary-rarity
Assassin/Space Maker — fishing-rod attack with a hook-grapple and a charged leap over walls, high
mobility, a self-heal gadget) was added to the roster specifically because it appeared in all 6 of
these real per-mode exports; it wasn't covered by the original 7-class reference image (see §2c),
so its class tag is this assistant's own best-effort classification rather than confirmed against
that image.

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

The brawltime.ninja CSV imports (§2b map win rate, §2d pick rate) are deliberately **not** an
exception to that rule so much as a different activity entirely: a human uses the site's own
explicit "Export CSV" feature in their own browser session, and only the resulting file — never a
live request to the site — enters this project. No credentials, automation, or scheduled job talks
to brawltime.ninja. If that boundary ever needs to move (e.g. towards an automated refresh), it
would require actually reaching out to brawltime.ninja's maintainer for explicit permission/terms
first, at which point it would be documented here as a proper source-priority-#2 licensed dataset
instead of a manual §2b/§2d import.

## 6. Post-draft summary: how the 0-100 score and win prediction are computed

`src/lib/recommendation-engine/draft-analysis.ts` (added per direct user request) grades a
completed draft once every ban/pick is in. It is built entirely out of scoring this app already
does live during the draft — `scorePickCandidate`/`scoreBanCandidate` — not a second, parallel
notion of "good pick":

- **Score (0-100)**: every one of the user's own picks is re-scored with full hindsight (the
  complete final roster on both sides is already known, unlike the live in-draft recommendations,
  which only ever see what's been revealed so far) and averaged; every one of the user's own bans
  is separately re-scored the same way, evaluated with no picks known yet (this app's ban-enabled
  formats always resolve bans before any picks, so that's the historically faithful information
  state). The final score blends `0.7 * averagePickScore + 0.3 * averageBanScore` (pure pick
  quality if the format had no bans), scaled to 0-100.
- **Win probability**: both teams' average pick quality (each judged from its own perspective, not
  just the user's) feeds a logistic curve — `1 / (1 + e^(-6 * (allyAvg - enemyAvg)))` — clamped to
  `[0.05, 0.95]` so the app never claims false certainty. **This is a heuristic curve built from
  this app's own curated/real scoring signals, not a calibrated, statistically-validated
  win-probability model** — building one of those would need real match *outcomes* to fit against,
  which this project has never collected (see §4's ingestion-pipeline design, which remains
  unbuilt). The UI states this plainly next to the win-probability bar.
- **Tips and strengths**: the same `reasons`/`warnings` each pick/ban already carries (see
  `explain.ts`) are pooled across the whole team, deduplicated to one (the most impactful) entry
  per reason type, attributed to the Brawler that earned it, and capped to 4 each. Two purely
  structural checks are added on top, since they're properties of the whole composition rather than
  any single pick: a missing Anti-Tank against an enemy Tank/Space Maker pick, and 3+ picks sharing
  the same dominant class (a single hard counter can punish all of them at once).
