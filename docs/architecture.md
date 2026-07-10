# Architecture Decision Record

## 1. Technology stack

The repository was empty at the start of this project (no prior stack to preserve), so we start from
the spec's own preferred stack rather than inventing something exotic.

| Layer | Choice | Why |
|---|---|---|
| Frontend framework | Next.js (App Router) + TypeScript + React | Spec's stated preference; gives us file-based routing, server routes for the future API proxy, and a straightforward PWA path. |
| Styling | Tailwind CSS | Fast to build a dense, mobile-first UI with; no custom design system needed for MVP. |
| State (draft session) | Local React state + a plain reducer (`lib/draft-engine`), persisted to `localStorage` | The draft engine is pure TypeScript with zero framework dependency — it is unit-testable without React and reusable from a future backend. No global state library needed at this scale. |
| Server state / data fetching | Deferred to Phase 3 | MVP has no live backend calls yet (mock/seeded data only), so TanStack Query is not wired in until there's a real endpoint to call. Documented here so Phase 3 doesn't have to re-litigate the choice. |
| Backend (future, Phase 3+) | Next.js Route Handlers (`app/api/*/route.ts`) | Avoids standing up a second service for what is initially a thin authenticated proxy + cache in front of the official API. Revisit NestJS/FastAPI only if the ingestion pipeline (Phase 4) outgrows a monolith. |
| Database (future, Phase 3+) | PostgreSQL + Prisma | Matches spec; not provisioned in Phase 1 since there is nothing to persist server-side yet (no accounts, no ingested stats). |
| Testing | Vitest (unit: draft engine, recommendation engine) | Fast, ESM-native, zero-config with Vite/Next; avoids the extra Babel/ts-jest setup cost of Jest for a TS-only test surface. Playwright e2e and API integration tests are added once there is a real backend/UI flow worth covering end-to-end (Phase 3+). |
| PWA | `public/manifest.json` + standard meta tags | Enough for "installable" without a service-worker caching strategy that has nothing real to cache yet (no live API calls in Phase 1). Add a service worker in Phase 5 once there's real network traffic to make resilient. |

We deliberately did **not** add in Phase 1: a database, an ORM, a job scheduler, auth, or a server-state
library — none of them have a real job to do yet, and adding them now would be exactly the
"unnecessary infrastructure" the spec warns against.

## 2. Module boundaries

```
lib/draft-engine/        pure TS, no React, no network. Owns DraftFormat data + the reducer that
                          validates and applies ban/pick actions, undo, reset, completion.
lib/recommendation-engine/ pure TS, no React, no network. Owns scoring, weights, explanations.
                          Consumes a `Dataset` interface — in Phase 1/2 that's the seeded mock
                          dataset in lib/recommendation-engine/mock-data.ts; in Phase 4 the same
                          interface is implemented by a real Postgres-backed reader. The engine
                          itself never knows which one it's talking to.
lib/data/                 static reference data: brawlers, maps, modes, draft formats. This is the
                          "official game metadata" layer (§7 of the spec) — seeded by hand for now,
                          replaced by a synced copy of the official /v1/brawlers catalog in Phase 3.
lib/storage/              localStorage-backed persistence for guest profiles and in-progress drafts.
                          Swappable for an account-backed store later without touching the engines.
components/                React components only. No business logic — components call into the two
                          engines and render their output.
app/                       Next.js routes/pages. Thin: setup screen, draft screen.
docs/                      This discovery/architecture/data-sources/implementation-plan set.
```

This separation is what makes "the recommendation engine must not be tightly coupled to the UI"
(spec §6) and "draft rules... covered by unit tests" (§4) actually true rather than aspirational:
both engines have zero import from `react` or `next`, so they run under plain Vitest in Node.

## 3. Security model for the official API key (forward-looking, Phase 3)

Not implemented yet (Phase 1 has no live API calls), but decided now so Phase 3 doesn't have to
redesign this:

- The Brawl Stars API key lives only in a server-side environment variable (`BRAWL_STARS_API_KEY`),
  read by Next.js Route Handlers. It is never sent to the client bundle (no `NEXT_PUBLIC_` prefix,
  never returned in a response body).
- Because Supercell keys are IP-locked (see `docs/discovery.md` §1.2), the deployment target for the
  API-proxy routes must have a **stable egress IP**. This is a deployment-environment decision, not a
  code decision, but it constrains hosting choice: a typical multi-region serverless platform with
  rotating egress IPs will not work without a fixed NAT/egress gateway in front of it.
- All outbound calls to `api.brawlstars.com` are wrapped in a single client module that: validates
  player tags before sending them, retries with exponential backoff on 5xx/429, respects
  `X-RateLimit-*` response headers, and caches brawler-catalog responses (which change only on
  balance patches) far longer than player-lookup responses.
- `.env.example` documents the variable name and a comment explaining the IP-lock constraint; it
  never contains a real key.

## 4. File structure (Phase 1 delivery)

```
BrawlDraft/
├── docs/
│   ├── discovery.md
│   ├── architecture.md
│   ├── data-sources.md
│   └── implementation-plan.md
├── public/
│   └── manifest.json
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                 # Setup screen
│   │   ├── draft/page.tsx           # Draft screen
│   │   └── globals.css
│   ├── components/
│   │   ├── layout/AppFooter.tsx     # unofficial-content disclaimer, always visible
│   │   ├── setup/*                  # profile/format/mode/map pickers, start button
│   │   └── draft/*                  # ban/pick tracker, brawler selector, recommendation cards
│   ├── lib/
│   │   ├── draft-engine/
│   │   │   ├── types.ts
│   │   │   ├── formats.ts
│   │   │   ├── engine.ts
│   │   │   └── engine.test.ts
│   │   ├── recommendation-engine/
│   │   │   ├── types.ts
│   │   │   ├── weights.ts
│   │   │   ├── engine.ts
│   │   │   ├── explain.ts
│   │   │   ├── mock-data.ts         # explicitly labeled MOCK/seeded, not real statistics
│   │   │   └── engine.test.ts
│   │   ├── data/
│   │   │   ├── brawlers.ts
│   │   │   ├── maps.ts
│   │   │   └── modes.ts
│   │   └── storage/
│   │       ├── profiles.ts
│   │       └── draft-session.ts
│   └── types/
│       └── shared.ts
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
├── vitest.config.ts
└── README.md
```

Later phases add `src/app/api/*` route handlers, `prisma/schema.prisma`, `jobs/` for the ingestion
pipeline, and `e2e/` for Playwright — all additive, none of it requires restructuring what's built in
Phase 1.

## 5. Non-goals for this delivery

- No accounts/auth (guest-mode local storage only, per spec §3 "do not block core tool on auth").
- No live API calls, no database.
- No bundled Brawler art/icons (text-first UI; see `docs/discovery.md` §3.1).
- No screenshot recognition of any kind.
