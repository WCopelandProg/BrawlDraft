# Implementation Plan

## 1. Phased plan (mirrors spec §13, restated as commitments for this codebase)

| Phase | Scope | Status |
|---|---|---|
| 0 — Discovery | API capability report, Ranked format verification, compliance report, this plan | **Done** (`docs/discovery.md`, this file) |
| 1 — Static prototype | Setup + draft screens, draft-rules engine, mock recommendation data, undo/reset, local persistence | **This delivery** |
| 2 — Deterministic recommendation engine | Real scoring math (map/mode/counter/synergy/composition/position/confidence) against a seeded local dataset, structured explanations, full tests | **This delivery** (folded into Phase 1 — the spec explicitly says to build this against a seeded dataset before ingestion exists, so there's no reason to gate it behind a separate PR) |
| 3 — Official API integration | Secure backend proxy, player-tag lookup, collection import, caching, rate-limit handling | Not started — requires a real API key and a deployment target with a stable egress IP (see `docs/architecture.md` §3) |
| 4 — Statistical pipeline | Match ingestion from consenting users, validation, patch assignment, aggregation, shrinkage, dataset publishing/rollback | Not started — requires Phase 3 plus a consent/collection mechanism |
| 5 — Production hardening | Monitoring, analytics, accessibility review, PWA polish, backups | Not started |
| 6 — Mobile companion research | Split-screen/PiP companion, user-authorized screenshot parsing | Not started, and will remain a separate research spike per spec §2.2/§14 — never merged into core until accuracy is measured |

## 2. Database schema (design for Phase 3/4 — not provisioned in Phase 1)

No database is running in this delivery (see `docs/architecture.md` §1 for why). This is the schema
Phase 3/4 will implement in Prisma, written now so later work has a target and so the seeded mock data
in Phase 1/2 already matches the shape it will eventually be read from.

```sql
-- Official game metadata
CREATE TABLE brawlers (
  id            TEXT PRIMARY KEY,          -- stable slug, e.g. "shelly"
  external_id   INTEGER,                   -- official API numeric id, once synced
  name          TEXT NOT NULL,
  rarity        TEXT,
  released_at   DATE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE brawler_role_features (       -- curated, heuristic fallback (spec §6.2/§6.4)
  brawler_id    TEXT REFERENCES brawlers(id),
  tag           TEXT NOT NULL,             -- "tank" | "anti_assassin" | "wall_breaker" | ...
  weight        REAL NOT NULL DEFAULT 1.0, -- how strongly this Brawler expresses the tag
  source        TEXT NOT NULL DEFAULT 'curated',
  PRIMARY KEY (brawler_id, tag)
);

CREATE TABLE maps (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  game_mode_id  TEXT REFERENCES game_modes(id),
  active        BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE game_modes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL
);

CREATE TABLE balance_patches (
  id            TEXT PRIMARY KEY,          -- e.g. "2026.07"
  released_at   DATE NOT NULL,
  notes         TEXT,
  major_rework_brawler_ids TEXT[]          -- Brawlers whose pre-patch data should be excluded, not decayed
);

-- Draft-rules configuration (data-driven, per spec §4)
CREATE TABLE draft_formats (
  id            TEXT PRIMARY KEY,          -- e.g. "ranked-mythic-snake-draft-captain"
  name          TEXT NOT NULL,
  team_size     INTEGER NOT NULL,
  definition    JSONB NOT NULL,            -- serialized DraftFormat (see TS types below)
  verified_at   DATE NOT NULL,             -- when this was last checked against live Ranked rules
  active        BOOLEAN NOT NULL DEFAULT true
);

-- Player data
CREATE TABLE players (
  id              TEXT PRIMARY KEY,        -- normalized player tag, "#" stripped, uppercased
  name            TEXT,
  last_synced_at  TIMESTAMPTZ,
  consented_to_match_collection BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE player_brawlers (
  player_id     TEXT REFERENCES players(id),
  brawler_id    TEXT REFERENCES brawlers(id),
  power_level    INTEGER,
  trophies       INTEGER,
  unlocked       BOOLEAN NOT NULL DEFAULT true,
  manually_excluded BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (player_id, brawler_id)
);

-- Match statistics (only ever populated from consenting battlelog polling, per data-sources.md)
CREATE TABLE matches (
  id            TEXT PRIMARY KEY,          -- hash of timestamp+participants, for dedup
  played_at     TIMESTAMPTZ NOT NULL,
  map_id        TEXT REFERENCES maps(id),
  game_mode_id  TEXT REFERENCES game_modes(id),
  patch_id      TEXT REFERENCES balance_patches(id),
  result_source TEXT NOT NULL              -- "battlelog_poll" — always traceable to its origin
);

CREATE TABLE match_participants (
  match_id      TEXT REFERENCES matches(id),
  player_id     TEXT REFERENCES players(id),
  brawler_id    TEXT REFERENCES brawlers(id),
  team          TEXT NOT NULL,             -- "a" | "b" (anonymized, not "ally/enemy" — that's draft-session-relative)
  result        TEXT NOT NULL,             -- "win" | "loss" | "draw"
  PRIMARY KEY (match_id, player_id)
);

-- Generated recommendation features (rebuilt by the pipeline, never hand-edited)
CREATE TABLE brawler_map_stats (
  brawler_id       TEXT REFERENCES brawlers(id),
  map_id           TEXT REFERENCES maps(id),
  game_mode_id     TEXT REFERENCES game_modes(id),
  patch_id         TEXT REFERENCES balance_patches(id),
  rank_bucket      TEXT NOT NULL DEFAULT 'all',
  sample_size      INTEGER NOT NULL,
  wins             INTEGER NOT NULL,
  losses           INTEGER NOT NULL,
  draws            INTEGER NOT NULL DEFAULT 0,
  pick_count       INTEGER NOT NULL DEFAULT 0,
  ban_count        INTEGER NOT NULL DEFAULT 0,
  adjusted_win_rate REAL NOT NULL,
  confidence_score  REAL NOT NULL,
  calculated_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (brawler_id, map_id, game_mode_id, patch_id, rank_bucket)
);

CREATE TABLE brawler_matchup_stats (
  candidate_brawler_id TEXT REFERENCES brawlers(id),
  opponent_brawler_id  TEXT REFERENCES brawlers(id),
  map_id               TEXT REFERENCES maps(id),
  game_mode_id         TEXT REFERENCES game_modes(id),
  patch_id             TEXT REFERENCES balance_patches(id),
  rank_bucket          TEXT NOT NULL DEFAULT 'all',
  sample_size          INTEGER NOT NULL,
  adjusted_matchup_rate REAL NOT NULL,
  PRIMARY KEY (candidate_brawler_id, opponent_brawler_id, map_id, game_mode_id, patch_id, rank_bucket)
);

CREATE TABLE brawler_synergy_stats (
  brawler_id        TEXT REFERENCES brawlers(id),
  ally_brawler_id   TEXT REFERENCES brawlers(id),
  map_id            TEXT REFERENCES maps(id),
  game_mode_id      TEXT REFERENCES game_modes(id),
  patch_id          TEXT REFERENCES balance_patches(id),
  rank_bucket       TEXT NOT NULL DEFAULT 'all',
  sample_size       INTEGER NOT NULL,
  adjusted_synergy_rate REAL NOT NULL,
  PRIMARY KEY (brawler_id, ally_brawler_id, map_id, game_mode_id, patch_id, rank_bucket)
);

CREATE TABLE dataset_versions (
  id             TEXT PRIMARY KEY,          -- e.g. "2026.07.1"
  patch_id       TEXT REFERENCES balance_patches(id),
  weight_version TEXT NOT NULL,
  published_at   TIMESTAMPTZ NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE recommendation_weight_versions (
  id            TEXT PRIMARY KEY,           -- e.g. "weights-2026.07"
  weights       JSONB NOT NULL,             -- see ScoreWeights TS type
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Every statistical row carries `patch_id` and `rank_bucket` in its primary key specifically so that
(a) we never silently blend incompatible patches (spec §7.2/§8.2) and (b) a recommendation computed
today is reproducible later by pinning `dataset_version` + `weight_version` (spec §7.2).

## 3. Draft-state TypeScript types

Implemented in `src/lib/draft-engine/types.ts`. Reproduced here for review:

```ts
export type Team = "ally" | "enemy";
export type DraftActionType = "ban" | "pick";

export interface DraftStep {
  index: number;
  team: Team;
  action: DraftActionType;
  /** Bans within the same simultaneousGroup resolve together and are hidden from the
   *  opponent until every step in the group has been filled. */
  simultaneousGroup?: string;
  visibleToOpponent?: boolean;
}

export interface DraftFormat {
  id: string;
  name: string;
  teamSize: number;
  steps: DraftStep[];
  duplicateTeamBansAllowed: boolean;
  crossTeamDuplicateBansAllowed: boolean;
  /** ISO date this format definition was last checked against live Ranked rules. */
  verifiedAt: string;
}

export interface DraftActionRecord {
  stepIndex: number;
  team: Team;
  action: DraftActionType;
  brawlerId: string;
}

export interface DraftState {
  formatId: string;
  currentStepIndex: number;
  history: DraftActionRecord[];
  /** Derived, not stored: legal brawlers remaining, whose turn it is, completion. */
}

export type DraftValidationErrorCode =
  | "draft_complete"
  | "wrong_team"
  | "wrong_action_type"
  | "brawler_already_banned"
  | "brawler_already_picked"
  | "brawler_not_available_to_player"
  | "duplicate_ban_not_allowed"
  | "unknown_brawler";

export interface DraftValidationResult {
  legal: boolean;
  errorCode?: DraftValidationErrorCode;
  message?: string;
}
```

The engine (`engine.ts`) is a pure reducer: `applyAction(state, format, action, context) ->
DraftState | DraftValidationResult`, plus `undo(state) -> DraftState`, `reset(format) -> DraftState`,
`getLegalActions(state, format, context) -> {team, action}`, and `isComplete(state, format) ->
boolean`. `context` carries the per-player available-Brawler set so "not available to this player" is
enforceable without the engine knowing anything about profiles or storage.

## 4. Recommendation-scoring interface

Implemented in `src/lib/recommendation-engine/types.ts`:

```ts
export interface ScoreWeights {
  mapPerformance: number;
  matchupValue: number;
  allySynergy: number;
  compositionFit: number;
  roleCoverage: number;
  draftFlexibility: number;
  recentMetaStrength: number;
  playerComfort: number;
  statisticalConfidence: number;
  archetypeCounter: number;   // rock-paper-scissors class counter, see docs/data-sources.md §2c
  modeClassFit: number;       // first-pick class fit for the mode, only active on pick 1
  counterRiskPenalty: number;
  redundancyPenalty: number;
}

// Starting values only — stored as data (recommendation_weight_versions), not hard-coded truth.
export const DEFAULT_WEIGHTS: ScoreWeights = {
  mapPerformance: 0.20,
  matchupValue: 0.16,
  allySynergy: 0.14,
  compositionFit: 0.12,
  roleCoverage: 0.10,
  draftFlexibility: 0.08,
  recentMetaStrength: 0.06,
  playerComfort: 0.04,
  statisticalConfidence: 0.04,
  archetypeCounter: 0.10,
  modeClassFit: 0.06,
  counterRiskPenalty: 0.15,
  redundancyPenalty: 0.10,
};

export type RecommendationReasonType =
  | "map_strength"
  | "enemy_counter"
  | "ally_synergy"
  | "role_coverage"
  | "safe_first_pick"
  | "flexibility"
  | "low_sample_warning"
  | "counter_risk"
  | "redundancy_warning"
  | "unavailable_to_player";

export interface RecommendationReason {
  type: RecommendationReasonType;
  impact: number;      // signed contribution to the final score, drives which reasons get surfaced
  message: string;      // deterministic, templated from the score component — never LLM-generated
}

export interface BrawlerRecommendation {
  brawlerId: string;
  action: DraftActionType;
  score: number;                 // normalized 0-1
  confidence: number;            // 0-1, driven by aggregate sample size across contributing stats
  availability: PlayerAvailability;
  reasons: RecommendationReason[];   // top positive contributors, highest impact first
  warnings: RecommendationReason[];  // top negative contributors / risks
}

export type PlayerAvailability =
  | "unlocked_eligible"
  | "unlocked_underleveled"
  | "not_unlocked"
  | "temporarily_eligible"
  | "manually_excluded"
  | "unknown";
```

Scoring pipeline (`engine.ts`): `scoreBrawler(candidate, draftContext, dataset, weights) ->
BrawlerRecommendation`. Each term (`mapPerformance`, `matchupValue`, ...) is its own pure function over
the seeded `Dataset` interface, so Phase 4 can swap the seeded dataset for a real Postgres-backed
reader without touching the scoring math — the interface boundary is the whole point (spec §6's "must
not be tightly coupled").

Counter value is computed by taking the **worst** matchup against a central enemy threat into account
(not a blind average), per spec §6.2 — implemented as a penalty term keyed off the single lowest
`adjusted_matchup_rate` against any enemy pick, separate from the mean matchup contribution.

## 5. Assumptions, risks, and unresolved external dependencies

### Assumptions
- The three Ranked draft formats documented in `docs/discovery.md` §2 are current as of mid-2026 and
  sourced from community documentation cross-referenced across independent sites, not from Supercell's
  own changelog directly (no such machine-readable changelog is exposed by the API). They should be
  re-verified whenever a season changes.
- "Seeded/mock" statistics in Phase 1/2 are internally consistent for testing the scoring math but
  carry no claim of real-world accuracy. The UI is required to label them as such.

### Risks
- **IP-locked API keys** make Phase 3 hosting less flexible than a typical serverless deploy; this is
  a real constraint on hosting choice, not a solved problem yet.
- **No live draft/ban data exists** — any future "automatic draft detection" claim can only ever come
  from user-authorized screenshot parsing (Phase 6), never from the official API. This must never be
  marketed as more than what it is.
- **Battlelog is a rolling recent window** — building genuinely reliable map/matchup/synergy
  statistics requires sustained, consented polling over time; there is no shortcut via backfill.
- **Rate limits are unpublished** — Phase 3's client must be defensive (headers + backoff) rather than
  tuned to an assumed number, and that assumption should be validated empirically before any
  production traffic depends on it.
- **Role/archetype tags have no official source** — they are, and will likely remain, hand-curated,
  which means they carry curator bias. The UI must always label composition/role-based reasoning as
  heuristic when it isn't backed by real matchup/synergy statistics (spec §6.2).

### Unresolved external dependencies
- A real Brawl Stars API key and a hosting environment with a stable egress IP (blocks Phase 3).
- A consent mechanism for collecting users' battle logs over time (blocks Phase 4 — nothing in Phase
  0-2 depends on this).
- A decision on whether to license a third-party statistical dataset as an interim bridge before our
  own pipeline accumulates enough sample size (source priority #2 in `docs/data-sources.md`) — no
  candidate has been identified or vetted yet.
