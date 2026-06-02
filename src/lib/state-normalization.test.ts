import { describe, expect, it } from "vitest";

import { createInitialState } from "./initial-state";
import { normalizeGameState } from "./state-normalization";
import { GameState } from "./types";

describe("normalizeGameState", () => {
  it("backfills missing affinity for older saves", () => {
    const state = createInitialState("테스터");
    const { affinity: _affinity, ...legacyParty } = state.party;
    const legacyState = {
      ...state,
      party: legacyParty,
    } as unknown as GameState;

    const normalized = normalizeGameState(legacyState);

    expect(normalized.party.affinity).toEqual({ pina: 0, mina: 0 });
  });
});
