import type { DraftFormat, DraftStep, Team } from "./types";

/**
 * All formats below are authored assuming "ally" is the first-pick team. Use
 * `resolveFormatForFirstPick` to get the concrete step sequence for a given draft's actual
 * first-pick team (decided by coin flip per docs/discovery.md section 2).
 *
 * Ranked formats and their pick/ban structure are verified in docs/discovery.md section 2.
 * They differ by rank tier, which is why this is a configurable list rather than one constant.
 */

function banPhase(count: number, group: string): DraftStep[] {
  const steps: DraftStep[] = [];
  let index = 0;
  for (let i = 0; i < count; i++) {
    steps.push({ index: index++, team: "ally", action: "ban", simultaneousGroup: group, visibleToOpponent: false });
  }
  for (let i = 0; i < count; i++) {
    steps.push({ index: index++, team: "enemy", action: "ban", simultaneousGroup: group, visibleToOpponent: false });
  }
  return steps;
}

function reindex(steps: Omit<DraftStep, "index">[]): DraftStep[] {
  return steps.map((step, index) => ({ ...step, index }));
}

const NO_BAN_FREE_PICK: DraftFormat = {
  id: "ranked-no-ban-free-pick",
  name: "Ranked (below Diamond) — no bans, alternating pick",
  teamSize: 3,
  duplicateTeamBansAllowed: true,
  crossTeamDuplicateBansAllowed: true,
  verifiedAt: "2026-07-10",
  description:
    "No ban phase below Diamond. Picks alternate one at a time; modeled as strict alternation " +
    "for the draft tracker even though the live game does not enforce a strict order at this tier.",
  steps: reindex([
    { team: "ally", action: "pick" },
    { team: "enemy", action: "pick" },
    { team: "ally", action: "pick" },
    { team: "enemy", action: "pick" },
    { team: "ally", action: "pick" },
    { team: "enemy", action: "pick" },
  ]),
};

/**
 * Diamond only (not Diamond-through-Legendary — Legendary sits above Mythic, which uses the
 * snake-draft format below). Corrected per direct user report, cross-checked against community
 * sources: both bans and picks happen simultaneously at Diamond — there is no turn order at all.
 * Picks are modeled as one simultaneous group of 6 (3 per team), the same "resolved together,
 * hidden until everyone locks in" mechanic already used for the ban phase.
 */
const DIAMOND_SIMULTANEOUS_BAN_AND_PICK: DraftFormat = {
  id: "ranked-diamond-simultaneous-ban-and-pick",
  name: "Ranked (Diamond) — simultaneous bans, simultaneous picks",
  teamSize: 3,
  duplicateTeamBansAllowed: false,
  crossTeamDuplicateBansAllowed: true,
  verifiedAt: "2026-07-11",
  description:
    "3 bans per team, resolved simultaneously and hidden until both sides lock in (6 total), " +
    "then all 6 picks (3 per team) also resolve simultaneously — there is no turn order at " +
    "Diamond at all, unlike Mythic and above.",
  steps: reindex([
    ...banPhase(3, "diamond-ban-phase"),
    { team: "ally", action: "pick", simultaneousGroup: "diamond-pick-phase" },
    { team: "ally", action: "pick", simultaneousGroup: "diamond-pick-phase" },
    { team: "ally", action: "pick", simultaneousGroup: "diamond-pick-phase" },
    { team: "enemy", action: "pick", simultaneousGroup: "diamond-pick-phase" },
    { team: "enemy", action: "pick", simultaneousGroup: "diamond-pick-phase" },
    { team: "enemy", action: "pick", simultaneousGroup: "diamond-pick-phase" },
  ]),
};

const MYTHIC_SNAKE_DRAFT_CAPTAIN: DraftFormat = {
  id: "ranked-mythic-snake-draft-captain",
  name: "Ranked (Mythic+) — simultaneous bans, snake-draft picks, captain picks last",
  teamSize: 3,
  duplicateTeamBansAllowed: false,
  crossTeamDuplicateBansAllowed: true,
  verifiedAt: "2026-07-10",
  description:
    "3 bans per team, resolved simultaneously and hidden (6 total), then picks follow a 1-2-2-1 " +
    "snake pattern: first-pick team picks alone, then the other team picks twice, then the " +
    "first-pick team picks twice, then the other team's captain picks last. This app tracks " +
    "picks at the team level, not per individual teammate.",
  steps: reindex([
    ...banPhase(3, "mythic-ban-phase"),
    { team: "ally", action: "pick" },
    { team: "enemy", action: "pick" },
    { team: "enemy", action: "pick" },
    { team: "ally", action: "pick" },
    { team: "ally", action: "pick" },
    { team: "enemy", action: "pick" },
  ]),
};

export const DRAFT_FORMATS: DraftFormat[] = [
  NO_BAN_FREE_PICK,
  DIAMOND_SIMULTANEOUS_BAN_AND_PICK,
  MYTHIC_SNAKE_DRAFT_CAPTAIN,
];

export function getDraftFormat(id: string): DraftFormat | undefined {
  return DRAFT_FORMATS.find((format) => format.id === id);
}

function swapTeam(team: Team): Team {
  return team === "ally" ? "enemy" : "ally";
}

/**
 * Formats are authored with "ally" as the first-pick team. If the enemy actually won the
 * coin flip for first pick, flip every step's team so "ally"/"enemy" still mean "the app
 * user's team" / "the opponent" throughout the UI and engine, while the sequence itself
 * still starts with whichever team really picks first.
 */
export function resolveFormatForFirstPick(format: DraftFormat, firstPickTeam: Team): DraftFormat {
  if (firstPickTeam === "ally") return format;
  return {
    ...format,
    steps: format.steps.map((step) => ({ ...step, team: swapTeam(step.team) })),
  };
}
