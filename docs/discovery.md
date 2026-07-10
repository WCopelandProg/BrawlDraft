# Phase 0 Discovery Report

Status: **initial verification pass, based on official developer portal claims and long-standing
community documentation of that same API.** The live `developer.brawlstars.com` docs SPA could not
be fetched directly from this environment (returned HTTP 403 to automated fetches — consistent with
bot protection, not a sign the API is different from what's described below). Everything in this
report is cross-checked against multiple independent sources (the official portal's own marketing
copy, long-running community libraries that wrap the same API, and Supercell's own support articles).
Nothing here is invented. Where something is genuinely unverified, it is labeled **UNVERIFIED** and
must be re-checked against `developer.brawlstars.com` with a real API key before Phase 3 (official
API integration) begins.

## 1. Official API capability report

Base URL: `https://api.brawlstars.com/v1` (portal: `https://developer.brawlstars.com`).

### 1.1 Endpoints that exist

| Endpoint | Returns | Relevant to this project |
|---|---|---|
| `GET /v1/players/{playerTag}` | Player profile: name, trophies, current/highest rank data, brawlers owned with power level, trophies, gadgets/star powers/gears unlocked | **Yes** — this is the entire basis for "player collection support" (§9 of the spec) |
| `GET /v1/players/{playerTag}/battlelog` | The player's most recent battles (mode, map, result, teams, star player) | Partial — see limitations below |
| `GET /v1/brawlers` / `GET /v1/brawlers/{id}` | Static catalog of Brawlers: id, name, available star powers/gadgets/gears | **Yes** — canonical Brawler metadata source |
| `GET /v1/clubs/{clubTag}` , `GET /v1/clubs/{clubTag}/members` | Club info and roster | Not used in MVP |
| `GET /v1/rankings/{countryCode}/players\|clubs\|brawlers/{brawlerId}` | Leaderboards | Not used in MVP |

Authentication: a JWT-style bearer token ("API key") created on the developer portal, sent as
`Authorization: Bearer <key>`.

### 1.2 Confirmed limitation: keys are IP-locked

Supercell's whole API family (Clash of Clans, Clash Royale, Brawl Stars) issues keys **scoped to a
single source IP address**, one key per IP, up to 10 keys per developer account. A request from any
other IP is rejected. This is a hard architectural constraint:

- The backend that calls the official API **must run from a stable, known egress IP** (a small VM,
  a fixed NAT gateway, or a proxy — not a typical autoscaling serverless platform where outbound IP
  changes between invocations).
- If we ever need to rotate IPs (e.g. redeploying to a new host), the key must be regenerated
  manually through the developer portal login. **We will not automate login/credential handling
  against the developer portal** — several community tools do this (screen-scraping the login form)
  but it is fragile, against the spirit of the portal's own auth flow, and not something this project
  will build. Key rotation is a manual, documented runbook step (see `docs/architecture.md`).

### 1.3 Confirmed limitation: no live match or draft data

The API is fundamentally a **post-match statistics API**, not a live-state API. There is no endpoint
that exposes:

- An in-progress match or its current draft/ban state
- Which Brawlers either side has banned or picked *before* the match ends
- The opponent's available Brawler pool
- Which map/mode will be played before matchmaking has already resolved the match (map/mode do
  appear on the completed `battlelog` entry, but only after the fact)

This directly confirms the spec's assumption in §2.1: **there is no live draft integration path**.
The MVP must be built around fast manual entry, full stop. Any future "detect the draft automatically"
feature would have to come from on-device screen/screenshot analysis (§14 of the spec, Phase 6), not
from the official API, because the API simply doesn't carry this data.

### 1.4 Confirmed limitation: battle log depth and recency

`battlelog` returns a bounded window of the player's most recent battles (long-standing community
consensus puts this at roughly the last 25 battles; Supercell does not publish an exact contractual
number). Consequences:

- We cannot reconstruct a player's full historical match record on demand — only what's in the
  rolling window at the time we poll.
- Building any meaningful statistical dataset (map win rates, matchup rates, synergy rates) requires
  **continuous, incremental polling and storage over time**, contributed either by our own scheduled
  jobs against consenting users' tags, or by a licensed dataset. It cannot be backfilled retroactively
  for arbitrary players.
- Battles do include `map`, `mode`, `result`, `starPlayer`, and both teams' Brawler selections — so
  once collected, they are enough to compute win rates, matchup rates, and synergy rates. They do
  **not** include ban information or pick order, because that information doesn't exist in the API
  at all (§1.3).

### 1.5 Rate limits

Supercell does not publish a fixed numeric rate limit in the public-facing docs we could verify.
Community convention (and Supercell's own guidance in the developer portal) is: **read the
`X-RateLimit-*` response headers on every response and back off accordingly**, rather than hard-coding
an assumed number. **UNVERIFIED — must be confirmed empirically once we hold a real key** (Phase 3).
Our client will be written defensively regardless: token-bucket limiting client-side, exponential
backoff on 429s, and aggressive caching of anything that doesn't change every request (Brawler
metadata, club info).

### 1.6 What Phase 0 rules out

- ❌ Live draft detection via the official API — does not exist.
- ❌ Opponent inventory lookup during a live match — does not exist (we only ever know our own
  player's collection, and only for whichever tag the user gives us).
- ❌ A guaranteed, contractual rate limit number — not published; must be measured.
- ❌ Full historical battle backfill for any arbitrary player tag — battlelog is a rolling recent
  window, not a full history.
- ✅ Player Brawler collection (owned Brawlers + power level) — available and is the basis for
  "player availability" filtering in recommendations.
- ✅ Static Brawler catalog — available, and is the seed for our Brawler metadata table.
- ✅ Enough per-battle detail (map, mode, both teams' Brawlers, result) to build our own statistics
  over time, provided we poll continuously and store it ourselves.

## 2. Ranked draft format verification

Verified against Supercell's in-game Ranked design as documented by the community wiki and multiple
independent Ranked guides (cross-checked, not taken from a single source). **This is genuinely
tiered — there is no single universal draft sequence**, which validates the spec's insistence
(§4) on a configurable rules engine rather than one hard-coded sequence.

| Tier band | Ban mechanic | Pick mechanic | Notes |
|---|---|---|---|
| Below Diamond | No ban phase | Free/simultaneous pick, no structured order | Ranked at these tiers is closer to a normal match with a rank attached |
| Diamond only | Ban phase introduced: **3 bans per team, 6 total**, occurring simultaneously (hidden from the opposing team until resolved) before picks begin | **Picks are also fully simultaneous** — both teams lock in all 3 picks at once, with no turn order at all. Corrected per direct user report and cross-checked against community sources; an earlier version of this document incorrectly described Diamond as turn-order and mislabeled the tier band as "Diamond-Legendary" (Legendary is actually above Mythic, which is where the snake draft below begins) | First-pick team decided by coin flip when matchmaking completes |
| Mythic I and above (includes Legendary and Masters) | Same 3-bans-per-team simultaneous ban phase | **Snake draft**: picks alternate in a 1-2-2-1 pattern across the two teams (first picker picks alone, then two picks from the other team, then two from the first team, then the last picker alone) with a **Team Captain** (highest Elo, or lobby host in premade teams) reserved for the last pick of their team | Each player gets an individual pick (not one player choosing for the whole team), and each pick has a ~20 second timer |

Team size is 3v3 across all Ranked bands (Brawl Stars' standard competitive team size).

**Design consequence**: our `DraftFormat` engine must support at minimum three seeded configurations
out of the box —
1. `ranked-no-ban-free-pick` (sub-Diamond),
2. `ranked-diamond-simultaneous-ban-and-pick` (Diamond only — both bans and picks simultaneous),
3. `ranked-mythic-snake-draft-captain` (Mythic and above, including Legendary/Masters — snake order + captain-last rule) —

and treat the exact ban count, simultaneity, and pick pattern as **data**, not code, since Supercell
has changed these numbers before and will again. See `docs/implementation-plan.md` for the
`DraftFormat` type design.

**UNVERIFIED / to re-check periodically**: exact ban count and snake pattern can change with balance
updates or seasonal changes. This report reflects the format in effect as of the current season
(mid-2026) per the sources above; the implementation plan calls for the format list to live in
versioned config data precisely so it can be corrected without a code change if Supercell adjusts it.

## 3. Compliance and platform-risk report

### 3.1 Fan Content Policy

Supercell's Fan Content Policy requires a visible unofficial-content disclaimer on any fan project
using Supercell IP. Verified required wording (quoted from the policy):

> "This material is unofficial and is not endorsed by Supercell. For more information see Supercell's
> Fan Content Policy: www.supercell.com/fan-content-policy."

This must render in legible text somewhere the end user will actually see it (footer of every screen
is the simplest reliable placement) — not buried in a settings page only. It is included in the Phase
1 UI shell (see `AppFooter` in the implementation).

Relevant restrictions we must respect:
- No implication that the app is official or Supercell-endorsed (naming, styling, and copy must avoid
  this).
- No bundled copyrighted Supercell assets (Brawler art, icons, logos) unless from Supercell's own
  approved Fan Kit or loaded from an attributed, permitted third-party source. The MVP uses **text
  labels and original UI elements only** — no bundled Brawler portraits — until a specific,
  permitted asset source is chosen.
- No content that promotes cheats, hacks, bots, or unauthorized automation of the game. This directly
  reinforces the spec's own hard rule (§2.2): the app is advisory-only and must never simulate input
  or control the game. This is treated as a non-negotiable architectural boundary, not just a policy
  checkbox — there is no code path anywhere in this project that sends input to the game client.

### 3.2 Platform risk (mobile companion strategies, §2.2 of the spec)

- **Phase 1 (this delivery)**: a responsive/installable PWA. No platform review risk — this is just
  a website.
- **Phase 2 (future)**: Android split-screen / PiP / compact views use only supported OS-level
  multitasking features. No special permissions, no accessibility service usage.
- **Phase 3 (future, research-gated)**: automated draft recognition from a **user-initiated**
  screenshot. This is the only place real platform/ToS risk lives:
  - Must never use Android's Accessibility API to read the game's screen content automatically or to
    simulate taps — that would cross from "advisory" into "automating/interacting with the game,"
    which both platform policies and Supercell's Fan Content Policy prohibit.
  - Must be user-initiated (user explicitly shares/uploads a screenshot), processed to extract map,
    mode, and Brawler icons, always with a manual confirmation step, and screenshots must not be
    retained by default.
  - This is explicitly **out of scope** for the MVP and is not being built now. It is deferred to a
    standalone research spike (Phase 6 of the spec) with its own accuracy measurement before any
    consideration of merging it into the core app.

### 3.3 Data privacy

Player tags and Brawler collections are minimal, publicly-queryable game data (anyone can look up any
public player tag through the same official API). We still treat them as user data: store only what's
needed for the feature (tag, cached collection, manual overrides), never log API keys or full
authorization headers, and support profile deletion.

## 4. Summary of what is ruled out for this spec

| Spec feature request | Verdict |
|---|---|
| Live ban/pick detection via official API | **Not possible.** No such endpoint exists. MVP uses manual entry; this is a hard constraint, not a phased limitation. |
| Opponent inventory / opponent collection lookup mid-draft | **Not possible** for an unknown opponent tag during a live match — we never learn the opponent's tag before or during a match. |
| A single universal Ranked draft sequence | **False assumption in the prompt itself** — verified there are at least 3 materially different formats by rank tier; engine is built data-driven from day one. |
| Guaranteed numeric API rate limit to hard-code | **Not published.** Client reads response headers and backs off; exact figures marked UNVERIFIED pending a real key. |
| Full historical match backfill for any player | **Not possible.** battlelog is a rolling recent window; our own statistics must be built by continuous polling over time, not backfill. |
| Automated screen-based draft detection as an MVP requirement | **Deliberately deferred**, and will never include simulated input/automation regardless of phase. |

None of the above blocks Phase 1 or Phase 2 (manual entry + deterministic recommendation engine on a
seeded dataset). They block only the *live-detection* and *full-history-backfill* fantasies latent in
the original spec, both of which the spec itself already told us not to assume.
