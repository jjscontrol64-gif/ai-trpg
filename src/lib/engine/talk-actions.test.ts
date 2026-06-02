import { describe, expect, it } from "vitest";
import { createInitialState } from "../initial-state";
import { getTalkBiasedActions, processAction } from ".";

describe("getTalkBiasedActions", () => {
  it("puts available exploration skills before movement actions", () => {
    const state = createInitialState("테스터");

    const actions = getTalkBiasedActions(state);

    expect(actions[0]).toEqual({ type: "pathfinding" });
    expect(actions[1]).toEqual({ type: "alchemy" });
    expect(actions.some((action) => action.type === "move")).toBe(true);
  });

  it("does not include depleted exploration skills", () => {
    const state = createInitialState("테스터");
    state.party.members[1].actions.find((action) => action.name === "패스파인딩")!.remaining = 0;
    state.party.members[2].actions.find((action) => action.name === "연금생성")!.remaining = 0;

    const actions = getTalkBiasedActions(state);

    expect(actions.some((action) => action.type === "pathfinding")).toBe(false);
    expect(actions.some((action) => action.type === "alchemy")).toBe(false);
  });

  it("returns safe room affinity actions during safe room events", () => {
    const state = createInitialState("테스터");
    state.phase = "event";
    state.party.position = { col: "A", row: 1 };
    state.dungeons[0]["A,1"] = { type: "safe", visited: true };

    const actions = getTalkBiasedActions(state);

    expect(actions).toEqual([
      { type: "pathfinding" },
      { type: "alchemy" },
      { type: "affinity_talk", target: "pina" },
      { type: "affinity_talk", target: "mina" },
      { type: "leave_safe_room" },
    ]);
  });

  it("raises selected companion affinity once and returns to exploration", () => {
    const state = createInitialState("테스터");
    state.phase = "event";

    const result = processAction(state, {
      type: "affinity_talk",
      target: "pina",
    });

    expect(result.newState.party.affinity).toEqual({ pina: 1, mina: 0 });
    expect(result.newState.phase).toBe("exploration");
    expect(result.nextActions.some((action) => action.type === "move")).toBe(true);
  });

  it("caps affinity at level 3", () => {
    const state = createInitialState("테스터");
    state.party.affinity.pina = 3;

    const result = processAction(state, {
      type: "affinity_talk",
      target: "pina",
    });

    expect(result.newState.party.affinity.pina).toBe(3);
  });
});
