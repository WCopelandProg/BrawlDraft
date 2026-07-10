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

### Importing real map win-rate data (optional)

By default all statistics are a seeded/labeled mock dataset. To use real per-Brawler win-rate data
for a specific map/mode/rank bracket, export a CSV from [brawltime.ninja](https://brawltime.ninja)'s
dashboard and run the import script — see `data/brawltime/README.md` for the exact steps. The draft
screen shows, per map/mode/rank, whether it's currently backed by real imported data (green) or
still the mock fallback (amber).

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

Not yet deployed anywhere; there is no backend or database to provision for this delivery. When Phase
3 (official API integration) begins, note the hosting constraint in `docs/architecture.md` §3: Supercell
API keys are locked to a single egress IP, so the deployment target needs a stable IP, not a typical
autoscaling serverless platform with rotating egress.

## Known limitations

- No live draft detection — the official Brawl Stars API has no endpoint for in-progress
  matches/bans/picks. This is a permanent constraint, not a phase gap (`docs/discovery.md` §1.3).
  BrawlDraft is, and will remain, a fast-manual-entry tool.
- All statistics shown are seeded/mock, not real Brawl Stars match data (see table above).
- Brawler role tags are hand-curated heuristics, not statistics — there is no official source for them.
- Only a representative subset of Brawlers/maps/modes is seeded for this prototype, not the full
  current roster/rotation.
- Ranked draft formats are verified as of the current season; Supercell can and does change these, so
  `docs/discovery.md` §2 should be re-checked each season.

## Future mobile-integration plan

Per the original product spec, live/automated draft detection would only ever be possible via a
user-initiated screenshot (never accessibility-service automation or simulated input — that crosses
into automating gameplay, which is out of scope permanently, not just for now). That remains a
standalone research spike (Phase 6) with its own accuracy measurement, to be built only after Phase
1-5 are in place, and never merged into the core app until its precision/recall is measured and
acceptable.
