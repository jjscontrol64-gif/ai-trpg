import { describe, expect, it } from "vitest";
import { createInitialState } from "../initial-state";
import { getTalkBiasedActions } from ".";

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
});
