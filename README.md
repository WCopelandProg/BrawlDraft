# BrawlDraft

BrawlDraft suggests picks and bans for Brawl Stars and explains why each one made the list.

**Stack:** TypeScript, Next.js, React, and Vitest. Draft state is stored locally in the browser.

## What it does

- Enforces turn order and legal actions across supported draft formats, with undo and reset.
- Combines map fit, team composition, matchups, and imported statistics in a deterministic scoring engine.
- Keeps real imported win/pick-rate data separate from mock values and hand-built heuristics.
- Includes unit tests for draft rules and recommendation behavior.

**Status:** Working prototype. Some inputs remain mocked or heuristic; the win-probability estimate is not calibrated against match outcomes. There is no live game-state integration.

**Start here:** [Run locally](#getting-started) · [Data sources](docs/data-sources.md) · [Architecture](docs/architecture.md) · [Limitations](#known-limitations)

> **This material is unofficial and is not endorsed by Supercell.** See
> [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/). BrawlDraft is
> advisory only. It never reads live game state and never controls Brawl Stars.

## What works now

The project covers **Phase 0 (research), Phase 1 (static prototype), and most of Phase 2 (the deterministic recommendation engine)** in `docs/implementation-plan.md`. Here’s what’s working, which data is mocked, and what’s still planned:

| Works today | Mock/seeded data | Not built yet |
|---|---|---|
| Configurable draft-rules engine (ban/pick legality, undo, reset, 3 verified Ranked formats) | All map/matchup/synergy statistics and "meta strength" numbers (`src/lib/recommendation-engine/mock-data.ts`) | Official Brawl Stars API integration (player lookup, live collection import) |
| Deterministic recommendation scoring (map/matchup/synergy/composition/role coverage/flexibility/confidence) with structured, non-LLM explanations | Brawler role/archetype tags (hand-curated, always labeled heuristic) | Statistical ingestion pipeline / real match data |
| Rank-bracket-sensitive scoring (a Brawler strong at low elo but an easy high-elo counter scores differently by bracket — working scoring logic with curated skew values) | Rank-skew values per Brawler (`BRAWLER_RANK_SKEW`) | Rank-segmented real match data to replace the curated skew guesses |
| Patch buff/nerf reactivity (recommendations shift immediately when a patch buffs/nerfs a Brawler) | Patch buff/nerf list (`MOCK_PATCH_HISTORY`) | Real, continuously updated patch feed + the pre/post-patch decay weighting from `docs/implementation-plan.md` §4 |
| Class/archetype drafting framework (Assassin/Tank/Speedster/Anti-Agro/Damage Dealer/Trapper/Support/Sharpshooter/Controller, with an Aggressive-beats-Passive-beats-Defensive-beats-Aggressive counter cycle and mode-specific first-pick fit), contributed by a user from their own drafting guide | Class assignment per Brawler (all 105 seeded Brawlers) | Two-ply "pick 2 sets up pick 3" lookahead (the current version leaves this out; see `docs/data-sources.md` §2c) |
| **Real pick-rate (popularity) data** for the Legendary and Masters rank buckets, imported from a user-provided brawltime.ninja export (all 104 Brawlers matched) | Everywhere else (`all`/`diamond`/`mythic` buckets still get a neutral value) | Real win-rate/matchup/synergy data. Pick rate measures popularity and is kept separate from measured win rate (see `docs/data-sources.md` §2d) |
| **Real per-mode win rate + pick rate + ranking score** for all 6 Ranked modes (Gem Grab, Brawl Ball, Bounty, Heist, Hot Zone, Knockout), imported from 6 user-provided exports. Real win rate is the single highest-weighted term in *pick* scoring; the composite score (this app's "S tier"/meta-relevance proxy) is the highest-weighted term in *ban* scoring, so "recommended bans" consistently targets the mode's actual best/most-played Brawlers while reducing the effect of small-sample win-rate outliers | Data grouped by mode, separately from the rank data above. It applies to every selected rank bucket because the source didn’t specify a rank | Rank-bracket-specific per-mode data (would need a source export that states both a mode and a rank bracket, see `docs/data-sources.md` §2e) |
| **Post-draft summary**: a 0-100 draft grade (picks + bans, judged with full hindsight against the enemy's actual final roster), a "what went well / tips for improvement" list, and a win-probability estimate for both teams | The 0-100 score/win-probability curve is this app's own heuristic combination of its existing scoring signals | A calibrated, statistically-validated win-probability model (would need real match outcomes to fit against, pick-rate data alone isn’t enough) |
| Guest-mode local profiles (rank bracket + available Brawlers remembered per profile, bulk unlock/lock/filter for fast setup) | — | Accounts/auth, official player-tag lookup |
| Local persistence of in-progress drafts (survives reload) | — | Screenshot/draft auto-detection (planned separately; see §14/Phase 6 of the original spec) |
| Mobile-first responsive UI, installable as a PWA | — | Service worker / offline caching strategy (nothing real to cache yet) |

Screens that show scores or statistics label the dataset version (`mock-2026.07.1`). `docs/data-sources.md` explains which values are imported, which are mocked, and how the data pipeline is planned to change.

## Documentation

- [`docs/discovery.md`](docs/discovery.md) — verified official API capabilities/limits, verified Ranked
  draft formats by rank tier, and the Supercell compliance/platform-risk report.
- [`docs/architecture.md`](docs/architecture.md) — stack choice, module boundaries, security model for
  the (future) official API key.
- [`docs/data-sources.md`](docs/data-sources.md) — source priority, real-vs-mock boundary, ingestion
  pipeline design.
- [`docs/implementation-plan.md`](docs/implementation-plan.md) — phased plan, database schema,
  draft-state TypeScript types, recommendation-scoring interface, assumptions/risks.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Phase 1/2 runs on the seeded dataset, with no environment variables or network calls. `.env.example` documents `BRAWL_STARS_API_KEY`, which is unused until Phase 3
(official API integration) and must never contain a real key in version control.

### Using the app

1. **Setup screen** (`/`): optionally create a profile (name + your available Brawlers), pick a
   Ranked format/mode/map/rank bracket, then **Start Draft**.
2. **Draft screen** (`/draft`): enter bans/picks as they happen in-game by searching and tapping a
   Brawler. The banner at the top always says whose turn/action is legal right now, and illegal
   actions (already-banned/picked Brawlers, wrong team, wrong action type) are simply not
   selectable. Recommendations for your team's current action appear below, with a plain-language
   reason and any warning for each. **Undo** removes the last action; **Reset** clears the whole
   draft without leaving the screen.
3. Your progress is saved automatically (`localStorage`). Reloading the page resumes the same
   draft; **Start a new draft** at the end returns to the setup screen.
4. Once every ban/pick is in, a **post-draft summary** appears: a 0-100 draft grade for your team,
   a win-probability estimate for both teams, and a "what went well / tips for improvement" list. See `docs/data-sources.md` §6 for exactly how the score and win probability are computed.

### Importing real data (optional, and partly already done)

By default all statistics are a seeded/labeled mock dataset, but this repo already includes three
real imports: a pick-rate export for Legendary/Masters Ranked (all 104 Brawlers matched at the
time), feeding a `meta_popularity` signal; 6 per-mode exports (one per Ranked mode) each carrying
real win rate, pick rate, and a composite ranking score, feeding `modeWinRate`/`modePopularity`
signals that are this app's single highest-weighted scoring terms (see `docs/data-sources.md` §2e);
and Nori, a newly-released Brawler added specifically because these exports included it. Win rate
and pick rate stay separate. They aren’t averaged into one number. To add real
per-Brawler win-rate data for a specific **map**/mode/rank bracket too, export a CSV from
[brawltime.ninja](https://brawltime.ninja)'s dashboard and run the other import script. See
`data/brawltime/README.md` for all three importers. The draft screen shows, per map/mode/rank,
whether it's currently backed by real imported map win-rate data (green) or still the mock fallback
(amber), and separately whether the active mode has real per-mode win/pick-rate data, independent
of each other.

### Testing

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run — draft-engine and recommendation-engine unit tests
```

Both the draft-rules engine (`src/lib/draft-engine`) and the recommendation engine
(`src/lib/recommendation-engine`) are plain TypeScript with no React/network dependency, so they run
under Vitest in Node with no browser or server needed. Current coverage: every seeded draft format's
turn order/legality/undo/reset/completion behavior, plus recommendation filtering, map/enemy/ally
sensitivity, early-vs-late pick weighting, low-sample confidence, and determinism.

Playwright end-to-end tests and API integration tests are planned for Phase 3+, when there’s a backend and network flow to test (see `docs/architecture.md` §1). The current UI uses mock data.

### Build

```bash
npm run build
npm start
```

## Deployment

There is no backend or database to provision for this version (all state is `localStorage`,
per-browser), so any static/Next.js host works. **Vercel** (the maintainers of Next.js) is the
easiest option and has a free tier that's enough for this app:

1. Push this repo to GitHub if it isn't already (this branch is already pushed).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project**, and
   import this repository.
3. Leave the defaults (Framework Preset: Next.js, no environment variables needed) and click
   **Deploy**. No `BRAWL_STARS_API_KEY` or any other env var is required for this build.
4. After a couple of minutes Vercel gives you a public URL like
   `https://brawl-draft.vercel.app`. Anyone with that link can open and use the app; no login or
   invite is required. Every future push to this branch auto-redeploys the same URL.

Profiles and drafts live in each visitor’s browser `localStorage`. They stay local to that browser and aren’t shared across people or devices (see "Known limitations" below).

When Phase 3 (official API integration) begins, note the hosting constraint in
`docs/architecture.md` §3: Supercell API keys are locked to a single egress IP, so that phase would
need a stable-IP host instead of a typical autoscaling serverless platform with rotating egress. This does not affect the current Phase 1/2 deployment above.

## Known limitations

- No live draft detection: the official Brawl Stars API has no endpoint for in-progress
  matches/bans/picks. This API limitation will remain (`docs/discovery.md` §1.3).
  BrawlDraft will continue to use manual entry.
- Most statistics shown are still seeded/mock; real data currently covers pick-rate popularity at
  two rank buckets plus real win rate/pick rate for all 6 modes (see table above). Map-specific
  win rate, matchup, and synergy remain mostly mock.
- Brawler role/class tags are hand-curated heuristics. There is no official source
  for them, and a number of the newer Brawlers' classes (including Nori, added mid-project) are
  inferred from context/web research rather than confirmed against the original reference image.
- The Brawler roster (105, including Nori) now covers essentially the full current game roster. All
  6 live Ranked modes are seeded (confirmed via web search); the specific map names per mode (4
  each, `maps.ts`) came from an AI assistant’s recollection and haven’t been checked against a
  live source. See `docs/data-sources.md` for exactly why and how to correct them.
- Ranked draft formats are verified as of the current season; Supercell can and does change these, so
  `docs/discovery.md` §2 should be re-checked each season.

## Future mobile-integration plan

The original plan explores draft detection from a screenshot that the user chooses to provide. It rules out accessibility-service automation and simulated input because those would automate gameplay. Screenshot detection remains a separate Phase 6 research task, after Phases 1–5. Its precision and recall must be measured and reach an acceptable level before it can join the core app.
