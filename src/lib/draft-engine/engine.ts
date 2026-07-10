import type {
  DraftActionRecord,
  DraftActionType,
  DraftFormat,
  DraftLegalityContext,
  DraftState,
  DraftValidationResult,
  LegalActionDescriptor,
  Team,
} from "./types";

export function createInitialState(format: DraftFormat): DraftState {
  return { formatId: format.id, currentStepIndex: 0, history: [] };
}

export function reset(format: DraftFormat): DraftState {
  return createInitialState(format);
}

function filledStepIndices(state: DraftState): Set<number> {
  return new Set(state.history.map((h) => h.stepIndex));
}

export function isComplete(state: DraftState, format: DraftFormat): boolean {
  return state.history.length >= format.steps.length;
}

/**
 * All steps that could legally be filled right now. More than one entry means those steps
 * are part of a simultaneous (hidden) group and may be filled in any order relative to each
 * other, per docs/discovery.md section 2 (the Ranked ban phase).
 */
export function getLegalSteps(state: DraftState, format: DraftFormat): LegalActionDescriptor[] {
  if (isComplete(state, format)) return [];
  const filled = filledStepIndices(state);
  const unfilled = [...format.steps].filter((s) => !filled.has(s.index)).sort((a, b) => a.index - b.index);
  const first = unfilled[0];
  if (!first) return [];
  const candidates = first.simultaneousGroup
    ? unfilled.filter((s) => s.simultaneousGroup === first.simultaneousGroup)
    : [first];
  return candidates.map((s) => ({
    stepIndex: s.index,
    team: s.team,
    action: s.action,
    simultaneousGroup: s.simultaneousGroup,
  }));
}

export function bannedBrawlerIds(state: DraftState): string[] {
  return state.history.filter((h) => h.action === "ban").map((h) => h.brawlerId);
}

export function pickedBrawlerIds(state: DraftState): string[] {
  return state.history.filter((h) => h.action === "pick").map((h) => h.brawlerId);
}

export function teamPicks(state: DraftState, team: Team): string[] {
  return state.history.filter((h) => h.action === "pick" && h.team === team).map((h) => h.brawlerId);
}

export function teamBans(state: DraftState, team: Team): string[] {
  return state.history.filter((h) => h.action === "ban" && h.team === team).map((h) => h.brawlerId);
}

export interface ProposedAction {
  team: Team;
  action: DraftActionType;
  brawlerId: string;
}

export function validateAction(
  state: DraftState,
  format: DraftFormat,
  proposed: ProposedAction,
  context: DraftLegalityContext = {},
): DraftValidationResult {
  if (isComplete(state, format)) {
    return { legal: false, errorCode: "draft_complete", message: "The draft has already finished." };
  }

  if (context.knownBrawlerIds && !context.knownBrawlerIds.has(proposed.brawlerId)) {
    return { legal: false, errorCode: "unknown_brawler", message: `Unknown Brawler id "${proposed.brawlerId}".` };
  }

  const legalSteps = getLegalSteps(state, format);
  const matchingTeam = legalSteps.filter((s) => s.team === proposed.team);
  if (matchingTeam.length === 0) {
    return { legal: false, errorCode: "wrong_team", message: `It is not ${proposed.team}'s turn.` };
  }
  const matchingAction = matchingTeam.filter((s) => s.action === proposed.action);
  if (matchingAction.length === 0) {
    return {
      legal: false,
      errorCode: "wrong_action_type",
      message: `The current legal action for ${proposed.team} is "${matchingTeam[0]!.action}", not "${proposed.action}".`,
    };
  }

  const picked = new Set(pickedBrawlerIds(state));
  const banned = new Set(bannedBrawlerIds(state));

  if (picked.has(proposed.brawlerId)) {
    return {
      legal: false,
      errorCode: "brawler_already_picked",
      message: "That Brawler has already been picked.",
    };
  }

  if (proposed.action === "pick" && banned.has(proposed.brawlerId)) {
    return {
      legal: false,
      errorCode: "brawler_already_banned",
      message: "That Brawler is banned and cannot be picked.",
    };
  }

  if (proposed.action === "ban") {
    const bannedBySameTeam = teamBans(state, proposed.team).includes(proposed.brawlerId);
    const bannedByOtherTeam = teamBans(state, proposed.team === "ally" ? "enemy" : "ally").includes(
      proposed.brawlerId,
    );
    if (bannedBySameTeam && !format.duplicateTeamBansAllowed) {
      return {
        legal: false,
        errorCode: "duplicate_ban_not_allowed",
        message: "This format does not allow the same team to ban a Brawler twice.",
      };
    }
    if (bannedByOtherTeam && !format.crossTeamDuplicateBansAllowed) {
      return {
        legal: false,
        errorCode: "duplicate_ban_not_allowed",
        message: "This format does not allow both teams to ban the same Brawler.",
      };
    }
  }

  if (proposed.action === "pick") {
    const available = context.availableBrawlerIdsByTeam?.[proposed.team];
    if (available && !available.includes(proposed.brawlerId)) {
      return {
        legal: false,
        errorCode: "brawler_not_available_to_player",
        message: "This Brawler is not available to the player on this team.",
      };
    }
  }

  return { legal: true };
}

export interface ApplyActionSuccess {
  ok: true;
  state: DraftState;
}
export interface ApplyActionFailure {
  ok: false;
  result: DraftValidationResult;
}

export function applyAction(
  state: DraftState,
  format: DraftFormat,
  proposed: ProposedAction,
  context: DraftLegalityContext = {},
): ApplyActionSuccess | ApplyActionFailure {
  const validation = validateAction(state, format, proposed, context);
  if (!validation.legal) {
    return { ok: false, result: validation };
  }
  const legalSteps = getLegalSteps(state, format);
  const step = legalSteps.find((s) => s.team === proposed.team && s.action === proposed.action);
  if (!step) {
    return {
      ok: false,
      result: { legal: false, errorCode: "unknown_step", message: "No matching legal step found." },
    };
  }
  const record: DraftActionRecord = {
    stepIndex: step.stepIndex,
    team: proposed.team,
    action: proposed.action,
    brawlerId: proposed.brawlerId,
  };
  return {
    ok: true,
    state: {
      ...state,
      history: [...state.history, record],
    },
  };
}

export function undo(state: DraftState): DraftState {
  if (state.history.length === 0) return state;
  return { ...state, history: state.history.slice(0, -1) };
}
