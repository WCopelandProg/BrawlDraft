# BrawlDraft

A companion web app that recommends bans and picks during Brawl Stars Ranked drafts.

> **This material is unofficial and is not endorsed by Supercell.** See
> [Supercell's Fan Content Policy](https://supercell.com/en/fan-content-policy/). BrawlDraft is
> advisory only — it never reads live game state and never controls Brawl Stars.

## What this delivery actually is

This is the **Phase 0 (discovery) + Phase 1 (static prototype) + most of Phase 2 (deterministic
recommendation engine)** delivery, per the phased plan in `docs/implementation-plan.md`. Concretely:

| Works today | Mock/seeded data | Not built yet |
|---|---|---|
| Configurable draft-rules engine (ban/pick legality, undo, reset, 3 verified Ranked formats) | All map/matchup/synergy statistics and "meta strength" numbers (`src/lib/recommendation-engine/mock-data.ts`) | Official Brawl Stars API integration (player lookup, live collection import) |
| Deterministic recommendation scoring (map/matchup/synergy/composition/role coverage/flexibility/confidence) with structured, non-LLM explanations | Brawler role/archetype tags (hand-curated, always labeled heuristic) | Statistical ingestion pipeline / real match data |
| Rank-bracket-sensitive scoring (a Brawler strong at low elo but an easy high-elo counter scores differently by bracket — real mechanism, curated skew values) | Rank-skew values per Brawler (`BRAWLER_RANK_SKEW`) | Rank-segmented real match data to replace the curated skew guesses |
| Patch buff/nerf reactivity (recommendations shift immediately when a patch buffs/nerfs a Brawler) | Patch buff/nerf list (`MOCK_PATCH_HISTORY`) | Real, continuously updated patch feed + the pre/post-patch decay weighting from `docs/implementation-plan.md` §4 |
| Class/archetype drafting framework (Assassin/Tank/Speedster/Anti-Agro/Damage Dealer/Trapper/Support/Sharpshooter/Controller, with an Aggressive-beats-Passive-beats-Defensive-beats-Aggressive counter cycle and mode-specific first-pick fit), contributed by a user from their own drafting guide | Class assignment per Brawler (all 104 seeded Brawlers) | Two-ply "pick 2 sets up pick 3" lookahead (this is a known, stated simplification — see `docs/data-sources.md` §2c) |
| **Real pick-rate (popularity) data** for the Legendary and Masters rank buckets, imported from a user-provided brawltime.ninja export (all 104 Brawlers matched) | Everywhere else (`all`/`diamond`/`mythic` buckets still get a neutral value) | Real win-rate/matchup/synergy data — pick rate is popularity, not measured win rate, and is never conflated with it (see `docs/data-sources.md` §2d) |
| **Real per-mode use-rate data** for all 6 Ranked modes, imported from 6 user-provided brawltime.ninja exports | A distinct axis from the row above (mode-scoped, not rank-bucket-scoped) — applied the same regardless of selected rank bucket since the source didn't state one | Rank-bracket-specific per-mode data (would need a source export that states both a mode and a rank bracket, see `docs/data-sources.md` §2e) |
| Guest-mode local profiles (rank bracket + available Brawlers remembered per profile, bulk unlock/lock/filter for fast setup) | — | Accounts/auth, official player-tag lookup |
| Local persistence of in-progress drafts (survives reload) | — | Screenshot/draft auto-detection (deliberately out of scope — see §14/Phase 6 of the original spec) |
| Mobile-first responsive UI, installable as a PWA | — | Service worker / offline caching strategy (nothing real to cache yet) |

Every screen that shows a score or statistic labels the active dataset version
(`mock-2026.07.1`) so it's never confused with real data. See `docs/data-sources.md` for the exact
real-vs-mock boundary and the plan for closing that gap.

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

No environment variables are required to run Phase 1/2 — everything runs on the seeded dataset with
zero network calls. `.env.example` documents `BRAWL_STARS_API_KEY`, which is unused until Phase 3
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
3. Your progress is saved automatically (`localStorage`) — reloading the page resumes the same
   draft; **Start a new draft** at the end returns to the setup screen.

### Importing real data (optional, and partly already done)

By default all statistics are a seeded/labeled mock dataset, but this repo already includes two real
imports: a user-provided brawltime.ninja pick-rate export for Legendary/Masters Ranked (all 104
Brawlers matched), feeding a `meta_popularity` signal, and 6 user-provided per-mode use-rate
exports (one per Ranked mode), feeding a separate `mode_popularity` signal — both honestly labeled
as popularity, never as win rate. To add real per-Brawler **win-rate** data for a specific
map/mode/rank bracket too, export a CSV from [brawltime.ninja](https://brawltime.ninja)'s dashboard
and run the other import script — see `data/brawltime/README.md` for all three. The draft screen
shows, per map/mode/rank, whether it's currently backed by real imported win-rate data (green) or
still the mock fallback (amber), and separately whether the active mode has real use-rate data,
independent of the pick-rate and win-rate signals.

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

Playwright end-to-end tests and API integration tests are deferred to Phase 3+, once there is a real
backend/network path worth covering end-to-end (see `docs/architecture.md` §1) — building them against
Phase 1's mock-only UI would just be testing the mocks.

### Build

```bash
npm run build
npm start
```

## Deployment

There is no backend or database to provision for this delivery (all state is `localStorage`,
per-browser), so any static/Next.js host works. **Vercel** (the maintainers of Next.js) is the
easiest option and has a free tier that's enough for this app:

1. Push this repo to GitHub if it isn't already (this branch is already pushed).
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, click **Add New → Project**, and
   import this repository.
3. Leave the defaults (Framework Preset: Next.js, no environment variables needed) and click
   **Deploy**. No `BRAWL_STARS_API_KEY` or any other env var is required for this build.
4. After a couple of minutes Vercel gives you a public URL like
   `https://brawl-draft.vercel.app` — anyone with that link can open and use the app; no login or
   invite is required. Every future push to this branch auto-redeploys the same URL.

Note that because state lives in each visitor's own browser `localStorage`, profiles/drafts are
**not shared** between different people or devices visiting the link — everyone gets their own
private, local set of profiles and in-progress drafts, which is the intended behavior for this
build (see "Known limitations" below).

When Phase 3 (official API integration) begins, note the hosting constraint in
`docs/architecture.md` §3: Supercell API keys are locked to a single egress IP, so that phase would
need a stable-IP host instead of a typical autoscaling serverless platform with rotating egress —
this does not affect the current Phase 1/2 deployment above.

## Known limitations

- No live draft detection — the official Brawl Stars API has no endpoint for in-progress
  matches/bans/picks. This is a permanent constraint, not a phase gap (`docs/discovery.md` §1.3).
  BrawlDraft is, and will remain, a fast-manual-entry tool.
- Most statistics shown are still seeded/mock; real data currently covers pick-rate popularity at
  two rank buckets (see table above) — win rate, matchup, and synergy remain mock.
- Brawler role/class tags are hand-curated heuristics, not statistics — there is no official source
  for them, and a number of the newer Brawlers' classes are inferred from context rather than confirmed.
- The Brawler roster (104) now covers essentially the full current game roster. All 6 live Ranked
  modes are seeded (confirmed via web search); the specific map names per mode (4 each, `maps.ts`)
  are this assistant's best-effort recall, not independently verified against a live source in this
  environment — see `docs/data-sources.md` for exactly why and how to correct them.
- Ranked draft formats are verified as of the current season; Supercell can and does change these, so
  `docs/discovery.md` §2 should be re-checked each season.

## Future mobile-integration plan

Per the original product spec, live/automated draft detection would only ever be possible via a
user-initiated screenshot (never accessibility-service automation or simulated input — that crosses
into automating gameplay, which is out of scope permanently, not just for now). That remains a
standalone research spike (Phase 6) with its own accuracy measurement, to be built only after Phase
1-5 are in place, and never merged into the core app until its precision/recall is measured and
acceptable.
