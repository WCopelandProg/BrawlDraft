export type Team = "ally" | "enemy";
export type DraftActionType = "ban" | "pick";

export interface DraftStep {
  /** Position of this step in the overall sequence, 0-indexed. */
  index: number;
  team: Team;
  action: DraftActionType;
  /**
   * Steps sharing a simultaneousGroup resolve together: none of them reveals its
   * choice to the opposing team until every step in the group has been filled.
   * Used to model Ranked's simultaneous hidden-ban phase.
   */
  simultaneousGroup?: string;
  /** Defaults to true. Set false only for steps modeling hidden information. */
  visibleToOpponent?: boolean;
}

export interface DraftFormat {
  id: string;
  name: string;
  teamSize: number;
  steps: DraftStep[];
  duplicateTeamBansAllowed: boolean;
  crossTeamDuplicateBansAllowed: boolean;
  /** ISO date this definition was last checked against live Ranked rules. */
  verifiedAt: string;
  description?: string;
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
}

export type DraftValidationErrorCode =
  | "draft_complete"
  | "wrong_team"
  | "wrong_action_type"
  | "brawler_already_banned"
  | "brawler_already_picked"
  | "brawler_not_available_to_player"
  | "duplicate_ban_not_allowed"
  | "unknown_brawler"
  | "unknown_step";

export interface DraftValidationResult {
  legal: boolean;
  errorCode?: DraftValidationErrorCode;
  message?: string;
}

/** Per-player context the engine needs to enforce availability, without knowing about profiles. */
export interface DraftLegalityContext {
  /** Brawler IDs the acting player/team may legally select. Omit to allow any known Brawler. */
  availableBrawlerIdsByTeam?: Partial<Record<Team, string[]>>;
  /** If provided, any brawlerId outside this set is rejected as unknown before other checks run. */
  knownBrawlerIds?: Set<string>;
}

export interface LegalActionDescriptor {
  stepIndex: number;
  team: Team;
  action: DraftActionType;
  /** All steps that are part of the same simultaneous group as this one, including itself. */
  simultaneousGroup?: string;
}
