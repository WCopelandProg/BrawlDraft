import { describe, expect, it } from "vitest";
import {
  DRAFT_FORMATS,
  getDraftFormat,
  resolveFormatForFirstPick,
} from "./formats";
import {
  applyAction,
  bannedBrawlerIds,
  createInitialState,
  getLegalSteps,
  isComplete,
  pickedBrawlerIds,
  reset,
  undo,
  validateAction,
} from "./engine";
import type { DraftFormat, DraftState } from "./types";

const BRAWLERS = new Set([
  "shelly", "colt", "bull", "brock", "elprimo", "barley", "poco", "rosa",
  "jessie", "nita", "dynamike", "tick", "8bit", "rico", "penny", "darryl",
]);

function fillSteps(format: DraftFormat, brawlerIds: string[]): DraftState {
  let state = createInitialState(format);
  let idx = 0;
  while (!isComplete(state, format)) {
    const [step] = getLegalSteps(state, format);
    if (!step) throw new Error("no legal step but draft not complete");
    const brawlerId = brawlerIds[idx++];
    if (!brawlerId) throw new Error("ran out of brawler ids for test fixture");
    const result = applyAction(state, format, { team: step.team, action: step.action, brawlerId }, {
      knownBrawlerIds: BRAWLERS,
    });
    if (!result.ok) throw new Error(`unexpected illegal action: ${result.result.errorCode}`);
    state = result.state;
  }
  return state;
}

describe("draft formats registry", () => {
  it("has exactly the three verified Ranked formats", () => {
    expect(DRAFT_FORMATS.map((f) => f.id)).toEqual([
      "ranked-no-ban-free-pick",
      "ranked-diamond-simultaneous-ban-and-pick",
      "ranked-mythic-snake-draft-captain",
    ]);
  });

  it("looks formats up by id", () => {
    expect(getDraftFormat("ranked-mythic-snake-draft-captain")?.name).toContain("Mythic");
    expect(getDraftFormat("does-not-exist")).toBeUndefined();
  });

  it("flips team assignment when enemy has first pick", () => {
    const base = getDraftFormat("ranked-diamond-simultaneous-ban-and-pick")!;
    const flipped = resolveFormatForFirstPick(base, "enemy");
    // The first non-ban step should now belong to "enemy" instead of "ally".
    const firstPickStep = base.steps.find((s) => s.action === "pick")!;
    const flippedStep = flipped.steps.find((s) => s.index === firstPickStep.index)!;
    expect(firstPickStep.team).toBe("ally");
    expect(flippedStep.team).toBe("enemy");
  });

  it("resolveFormatForFirstPick is a no-op for ally first pick", () => {
    const base = getDraftFormat("ranked-no-ban-free-pick")!;
    expect(resolveFormatForFirstPick(base, "ally")).toEqual(base);
  });
});

describe.each(DRAFT_FORMATS)("engine over format: $id", (format) => {
  it("starts empty and not complete", () => {
    const state = createInitialState(format);
    expect(state.history).toHaveLength(0);
    expect(isComplete(state, format)).toBe(false);
  });

  it("reports whose turn it is and what action type is legal", () => {
    const state = createInitialState(format);
    const legal = getLegalSteps(state, format);
    expect(legal.length).toBeGreaterThan(0);
    for (const step of legal) {
      expect(["ally", "enemy"]).toContain(step.team);
      expect(["ban", "pick"]).toContain(step.action);
    }
  });

  it("rejects an action from the wrong team", () => {
    const state = createInitialState(format);
    const [legalStep] = getLegalSteps(state, format);
    const wrongTeam = legalStep!.team === "ally" ? "enemy" : "ally";
    // only wrong_team if no legal step at all matches wrongTeam (true when phase isn't simultaneous)
    const anyLegalForWrongTeam = getLegalSteps(state, format).some((s) => s.team === wrongTeam);
    const result = validateAction(state, format, { team: wrongTeam, action: legalStep!.action, brawlerId: "shelly" }, {
      knownBrawlerIds: BRAWLERS,
    });
    if (!anyLegalForWrongTeam) {
      expect(result.legal).toBe(false);
      expect(result.errorCode).toBe("wrong_team");
    }
  });

  it("rejects the wrong action type for the correct team", () => {
    const state = createInitialState(format);
    const [legalStep] = getLegalSteps(state, format);
    const wrongAction = legalStep!.action === "ban" ? "pick" : "ban";
    const stillLegalForThatAction = getLegalSteps(state, format).some(
      (s) => s.team === legalStep!.team && s.action === wrongAction,
    );
    const result = validateAction(
      state,
      format,
      { team: legalStep!.team, action: wrongAction, brawlerId: "shelly" },
      { knownBrawlerIds: BRAWLERS },
    );
    if (!stillLegalForThatAction) {
      expect(result.legal).toBe(false);
      expect(result.errorCode).toBe("wrong_action_type");
    }
  });

  it("rejects unknown brawler ids", () => {
    const state = createInitialState(format);
    const [legalStep] = getLegalSteps(state, format);
    const result = validateAction(
      state,
      format,
      { team: legalStep!.team, action: legalStep!.action, brawlerId: "definitely-not-a-real-brawler" },
      { knownBrawlerIds: BRAWLERS },
    );
    expect(result.legal).toBe(false);
    expect(result.errorCode).toBe("unknown_brawler");
  });

  it("completes after exactly format.steps.length legal actions", () => {
    const brawlerPool = [...BRAWLERS];
    const state = fillSteps(format, brawlerPool);
    expect(state.history).toHaveLength(format.steps.length);
    expect(isComplete(state, format)).toBe(true);
    expect(getLegalSteps(state, format)).toHaveLength(0);
  });

  it("rejects any further action once complete", () => {
    const state = fillSteps(format, [...BRAWLERS]);
    const result = validateAction(state, format, { team: "ally", action: "pick", brawlerId: "darryl" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(result.legal).toBe(false);
    expect(result.errorCode).toBe("draft_complete");
  });

  it("undo removes the most recent action and re-legalizes its step", () => {
    let state = createInitialState(format);
    const [firstLegal] = getLegalSteps(state, format);
    const applied = applyAction(state, format, { team: firstLegal!.team, action: firstLegal!.action, brawlerId: "shelly" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(applied.ok).toBe(true);
    state = (applied as { ok: true; state: DraftState }).state;
    expect(state.history).toHaveLength(1);

    state = undo(state);
    expect(state.history).toHaveLength(0);
    // shelly should be selectable again since the action was undone
    const revalidate = validateAction(state, format, { team: firstLegal!.team, action: firstLegal!.action, brawlerId: "shelly" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(revalidate.legal).toBe(true);
  });

  it("undo on an empty history is a no-op", () => {
    const state = createInitialState(format);
    expect(undo(state)).toEqual(state);
  });

  it("reset returns a fresh empty state for the format", () => {
    const state = fillSteps(format, [...BRAWLERS]);
    const resetState = reset(format);
    expect(resetState.history).toHaveLength(0);
    expect(resetState.formatId).toBe(format.id);
    // original filled state is untouched (pure function, no mutation)
    expect(state.history.length).toBe(format.steps.length);
  });

  it("never lets a picked brawler be picked again", () => {
    let state = createInitialState(format);
    const [firstLegal] = getLegalSteps(state, format);
    if (firstLegal!.action !== "pick") {
      // advance past the ban phase to reach a pick step for this format
      const brawlerPool = [...BRAWLERS];
      let i = 0;
      while (getLegalSteps(state, format)[0]?.action === "ban") {
        const step = getLegalSteps(state, format)[0]!;
        const applied = applyAction(state, format, { team: step.team, action: "ban", brawlerId: brawlerPool[i++]! }, {
          knownBrawlerIds: BRAWLERS,
        });
        state = (applied as { ok: true; state: DraftState }).state;
      }
    }
    const pickStep = getLegalSteps(state, format)[0]!;
    const firstPick = applyAction(state, format, { team: pickStep.team, action: "pick", brawlerId: "jessie" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(firstPick.ok).toBe(true);
    state = (firstPick as { ok: true; state: DraftState }).state;

    const nextStep = getLegalSteps(state, format)[0]!;
    const secondPick = validateAction(state, format, { team: nextStep.team, action: "pick", brawlerId: "jessie" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(secondPick.legal).toBe(false);
    expect(secondPick.errorCode).toBe("brawler_already_picked");
  });
});

describe("ban-specific rules", () => {
  const diamond = getDraftFormat("ranked-diamond-simultaneous-ban-and-pick")!;

  it("treats the whole ban phase as one simultaneous, hidden group", () => {
    const state = createInitialState(diamond);
    const legal = getLegalSteps(state, diamond);
    expect(legal).toHaveLength(6);
    expect(legal.every((s) => s.simultaneousGroup === "diamond-ban-phase")).toBe(true);
    const format = diamond;
    expect(format.steps.slice(0, 6).every((s) => s.visibleToOpponent === false)).toBe(true);
  });

  it("allows bans to be entered in any order within the simultaneous group", () => {
    let state = createInitialState(diamond);
    // Enemy bans first even though ally appears first in the canonical step list.
    const result = applyAction(state, diamond, { team: "enemy", action: "ban", brawlerId: "poco" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects a duplicate cross-team ban when crossTeamDuplicateBansAllowed is false", () => {
    const format: DraftFormat = { ...diamond, crossTeamDuplicateBansAllowed: false };
    let state = createInitialState(format);
    const first = applyAction(state, format, { team: "ally", action: "ban", brawlerId: "poco" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(first.ok).toBe(true);
    state = (first as { ok: true; state: DraftState }).state;
    const second = validateAction(state, format, { team: "enemy", action: "ban", brawlerId: "poco" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(second.legal).toBe(false);
    expect(second.errorCode).toBe("duplicate_ban_not_allowed");
  });

  it("rejects picking a banned brawler", () => {
    let state = createInitialState(diamond);
    const banResult = applyAction(state, diamond, { team: "ally", action: "ban", brawlerId: "poco" }, {
      knownBrawlerIds: BRAWLERS,
    });
    state = (banResult as { ok: true; state: DraftState }).state;
    // finish the rest of the ban phase
    const rest = ["colt", "bull", "brock", "elprimo", "barley"];
    for (const b of rest) {
      const step = getLegalSteps(state, diamond)[0]!;
      const applied = applyAction(state, diamond, { team: step.team, action: "ban", brawlerId: b }, {
        knownBrawlerIds: BRAWLERS,
      });
      state = (applied as { ok: true; state: DraftState }).state;
    }
    const pickStep = getLegalSteps(state, diamond)[0]!;
    const attempt = validateAction(state, diamond, { team: pickStep.team, action: "pick", brawlerId: "poco" }, {
      knownBrawlerIds: BRAWLERS,
    });
    expect(attempt.legal).toBe(false);
    expect(attempt.errorCode).toBe("brawler_already_banned");
  });
});

describe("player availability enforcement", () => {
  const format = getDraftFormat("ranked-no-ban-free-pick")!;

  it("rejects a pick outside the acting player's available pool", () => {
    const state = createInitialState(format);
    const result = validateAction(
      state,
      format,
      { team: "ally", action: "pick", brawlerId: "shelly" },
      {
        knownBrawlerIds: BRAWLERS,
        availableBrawlerIdsByTeam: { ally: ["colt", "bull"] },
      },
    );
    expect(result.legal).toBe(false);
    expect(result.errorCode).toBe("brawler_not_available_to_player");
  });

  it("allows a pick inside the acting player's available pool", () => {
    const state = createInitialState(format);
    const result = validateAction(
      state,
      format,
      { team: "ally", action: "pick", brawlerId: "colt" },
      {
        knownBrawlerIds: BRAWLERS,
        availableBrawlerIdsByTeam: { ally: ["colt", "bull"] },
      },
    );
    expect(result.legal).toBe(true);
  });

  it("does not restrict bans by player availability", () => {
    const diamond = getDraftFormat("ranked-diamond-simultaneous-ban-and-pick")!;
    const state = createInitialState(diamond);
    const result = validateAction(
      state,
      diamond,
      { team: "ally", action: "ban", brawlerId: "shelly" },
      {
        knownBrawlerIds: BRAWLERS,
        availableBrawlerIdsByTeam: { ally: ["colt", "bull"] },
      },
    );
    expect(result.legal).toBe(true);
  });
});

describe("history helpers", () => {
  it("bannedBrawlerIds and pickedBrawlerIds reflect history accurately", () => {
    const format = getDraftFormat("ranked-diamond-simultaneous-ban-and-pick")!;
    const state = fillSteps(format, [...BRAWLERS]);
    expect(bannedBrawlerIds(state)).toHaveLength(6);
    expect(pickedBrawlerIds(state)).toHaveLength(6);
    // no overlap between banned and picked
    const overlap = bannedBrawlerIds(state).filter((id) => pickedBrawlerIds(state).includes(id));
    expect(overlap).toHaveLength(0);
  });
});

describe("determinism", () => {
  it("identical action sequences produce identical resulting state", () => {
    const format = getDraftFormat("ranked-diamond-simultaneous-ban-and-pick")!;
    const pool = [...BRAWLERS];
    const stateA = fillSteps(format, pool);
    const stateB = fillSteps(format, pool);
    expect(stateA).toEqual(stateB);
  });
});
