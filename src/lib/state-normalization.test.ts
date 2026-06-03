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

    expect(normalized.party.affinity).toEqual({ amy: 0, siluella: 0 });
  });

  it("migrates legacy companion affinity keys", () => {
    const state = createInitialState("Tester");
    const legacyState = {
      ...state,
      party: {
        ...state.party,
        affinity: { pina: 2, mina: 1 },
      },
    } as unknown as GameState;

    const normalized = normalizeGameState(legacyState);

    expect(normalized.party.affinity).toEqual({ amy: 2, siluella: 1 });
  });

  it("backfills missing consumable effects for older saves", () => {
    const state = createInitialState("아르곤");
    state.party.inventory = [
      {
        id: "item_legacy_1",
        name: "회복물약",
        rarity: "common",
      },
    ];

    const normalized = normalizeGameState(state);

    expect(normalized.party.inventory[0]).toMatchObject({
      id: "item_legacy_1",
      name: "회복물약",
      effectId: "restore_hp",
      effectValue: 3,
      hpRestore: 3,
    });
  });

  it("normalizes legacy mana potion names with spaces", () => {
    const state = createInitialState("아르곤");
    state.party.inventory = [
      {
        id: "item_legacy_mana",
        name: "마나 물약",
        rarity: "rare",
      },
    ];

    const normalized = normalizeGameState(state);

    expect(normalized.party.inventory[0]).toMatchObject({
      id: "item_legacy_mana",
      name: "마나물약",
      effectId: "restore_action",
      effectValue: 1,
      actionRestore: 1,
    });
  });

  it("reissues duplicate consumable instance ids from older saves", () => {
    const state = createInitialState("아르곤");
    state.party.inventory = [
      {
        id: "item_2",
        name: "회복물약",
        rarity: "common",
        effectId: "restore_hp",
        effectValue: 3,
        hpRestore: 3,
      },
      {
        id: "item_2",
        name: "마나물약",
        rarity: "rare",
        effectId: "restore_action",
        effectValue: 1,
        actionRestore: 1,
      },
    ];

    const normalized = normalizeGameState(state);

    expect(normalized.party.inventory).toHaveLength(2);
    expect(normalized.party.inventory[0].id).toBe("item_2");
    expect(normalized.party.inventory[1].id).not.toBe("item_2");
    expect(new Set(normalized.party.inventory.map((item) => item.id)).size).toBe(2);
    expect(normalized.party.inventory[1]).toMatchObject({
      name: "마나물약",
      effectId: "restore_action",
      actionRestore: 1,
    });
  });
});
