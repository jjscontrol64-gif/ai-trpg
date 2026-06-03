import { describe, expect, it } from "vitest";

import { manaPotion } from "./items";
import { GameState } from "./types";
import { useItem } from "./use-item";

function createState(): GameState {
  return {
    party: {
      members: [
        {
          name: "아르곤",
          role: "warrior",
          hp: 10,
          maxHp: 10,
          baseStats: { str: 4, dex: 1, int: 0 },
          equip: { head: null, body: null, weapon: null },
          actions: [{ name: "강타", remaining: 0, max: 3, type: "combat" }],
        },
        {
          name: "에이미",
          role: "rogue",
          hp: 10,
          maxHp: 10,
          baseStats: { str: 1, dex: 4, int: 1 },
          equip: { head: null, body: null, weapon: null },
          actions: [{ name: "기습", remaining: 3, max: 3, type: "combat" }],
        },
        {
          name: "실루엘라",
          role: "mage",
          hp: 10,
          maxHp: 10,
          baseStats: { str: 0, dex: 1, int: 4 },
          equip: { head: null, body: null, weapon: null },
          actions: [{ name: "마력속박", remaining: 3, max: 3, type: "combat" }],
        },
      ],
      inventory: [manaPotion()],
      floor: 1,
      position: { col: "A", row: 1 },
      inspiration: 0,
      affinity: { amy: 0, siluella: 0 },
    },
    combat: {
      active: false,
      monster: null,
      bossCounters: { curseTurn: 0, breathTurn: 0, breathCharging: false },
      turnCount: 0,
    },
    mode: "normal",
    phase: "exploration",
    dungeons: [{}, {}, {}],
    npcUsed: false,
    messageHistory: [],
  };
}

describe("useItem", () => {
  it("uses a mana potion on the requested target", () => {
    const state = createState();
    const itemId = state.party.inventory[0].id;

    const result = useItem(
      state,
      { itemId, targetIndex: 0 },
      { getNextActions: () => [] }
    );

    expect(result.newState.party.members[0].actions[0].remaining).toBe(1);
    expect(result.newState.party.members[1].actions[0].remaining).toBe(3);
    expect(result.newState.party.inventory).toHaveLength(0);
    expect(result.eventSummary).toContain("아르곤");
  });

  it("prefers inventory index when item ids are duplicated", () => {
    const state = createState();
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

    const result = useItem(
      state,
      { itemId: "item_2", inventoryIndex: 1, targetIndex: 0 },
      { getNextActions: () => [] }
    );

    expect(result.newState.party.members[0].actions[0].remaining).toBe(1);
    expect(result.newState.party.inventory).toHaveLength(1);
    expect(result.newState.party.inventory[0].name).toBe("회복물약");
    expect(result.eventSummary).toContain("마나물약");
  });
});
