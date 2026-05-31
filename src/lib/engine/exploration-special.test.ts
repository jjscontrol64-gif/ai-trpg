import { describe, expect, it } from "vitest";

import { createInitialState } from "../initial-state";
import { processAction } from "./index";

function createEventState(roomType: "puzzle" | "trap") {
  const state = createInitialState("전사");
  state.phase = "event";
  state.party.position = { col: "A", row: 1 };
  state.dungeons[0]["A,1"] = { type: roomType, visited: true };
  return state;
}

describe("exploration special actions", () => {
  it("uses pathfinding breakthrough as a distinct puzzle critical success", () => {
    const state = createEventState("puzzle");

    const result = processAction(state, {
      type: "puzzle_attempt",
      characterIndex: 0,
      stat: "str",
      useInspiration: false,
      isUnorthodox: false,
      specialActionName: "활로개척",
    });

    expect(result.diceResult).toMatchObject({
      raw: 20,
      judgment: "critical_success",
      inspirationBonus: 0,
    });
    expect(result.eventSummary).toContain("활로개척");
    expect(result.newState.party.members[0].actions.find((action) => action.name === "활로개척")?.remaining).toBe(2);
  });

  it("uses pathfinding breakthrough for trap critical success", () => {
    const state = createEventState("trap");

    const result = processAction(state, {
      type: "trap_attempt",
      characterIndex: 0,
      stat: "str",
      useInspiration: false,
      specialActionName: "활로개척",
    });

    expect(result.diceResult?.judgment).toBe("critical_success");
    expect(result.eventSummary).toContain("활로개척");
    expect(result.newState.party.members.every((member) => member.hp === member.maxHp)).toBe(true);
  });
});
