import { afterEach, describe, expect, it, vi } from "vitest";

import { processAttack, processSpecialAction } from "./combat";
import { Character, GameState } from "../types";

function mockRoll(raw: number) {
  vi.spyOn(Math, "random").mockReturnValue((raw - 1) / 20);
}

function createCharacter(
  name: string,
  role: Character["role"],
  baseStats: Character["baseStats"],
  actionName?: string
): Character {
  return {
    name,
    role,
    hp: 10,
    maxHp: 10,
    baseStats,
    equip: {
      head: null,
      body: null,
      weapon: {
        id: `${name}-weapon`,
        name: "Test Weapon",
        rarity: "rare",
        slot: "weapon",
        stat: role === "warrior" ? "str" : role === "rogue" ? "dex" : "int",
        bonus: 2,
      },
    },
    actions: actionName
      ? [{ name: actionName, type: "combat", remaining: 1, max: 3 }]
      : [],
  };
}

function createState(attacker: Character): GameState {
  return {
    party: {
      members: [
        attacker,
        createCharacter("Rogue", "rogue", { str: 1, dex: 4, int: 1 }),
        createCharacter("Mage", "mage", { str: 0, dex: 1, int: 4 }),
      ],
      inventory: [],
      floor: 1,
      position: { col: "A", row: 1 },
      inspiration: 0,
    },
    combat: {
      active: true,
      monster: {
        name: "Training Dummy",
        hp: 30,
        maxHp: 30,
        difficulty: 1,
        damage: 1,
      },
      bossCounters: { curseTurn: 0, breathTurn: 0, breathCharging: false },
      turnCount: 0,
    },
    mode: "normal",
    phase: "combat",
    dungeons: [{}, {}, {}],
    npcUsed: false,
    messageHistory: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("combat damage scaling", () => {
  it("uses main stat plus 1 for successful attacks", () => {
    mockRoll(6);
    const warrior = createCharacter("Warrior", "warrior", { str: 4, dex: 1, int: 0 });

    const result = processAttack(createState(warrior), 0, false);

    expect(result.diceResult).toMatchObject({
      raw: 6,
      stat: 6,
      total: 12,
      judgment: "success",
    });
    expect(result.playerDamage).toBe(7);
    expect(result.state.combat.monster?.hp).toBe(23);
  });

  it("uses main stat plus 5 and avoids counterattack on critical successes", () => {
    mockRoll(17);
    const warrior = createCharacter("Warrior", "warrior", { str: 4, dex: 1, int: 0 });

    const result = processAttack(createState(warrior), 0, false);

    expect(result.diceResult).toMatchObject({
      raw: 17,
      stat: 6,
      total: 23,
      judgment: "critical_success",
    });
    expect(result.playerDamage).toBe(11);
    expect(result.monsterDamage).toBe(0);
    expect(result.state.party.members[0].hp).toBe(10);
  });

  it("applies the critical damage formula to strong strike", () => {
    const warrior = createCharacter("Warrior", "warrior", { str: 4, dex: 1, int: 0 }, "강타");

    const result = processSpecialAction(createState(warrior), 0, "강타");

    expect(result.playerDamage).toBe(11);
    expect(result.state.combat.monster?.hp).toBe(19);
  });

  it("applies the same damage formula to ambush", () => {
    mockRoll(6);
    const rogue = createCharacter("Rogue", "rogue", { str: 1, dex: 4, int: 1 }, "암습");
    const state = createState(rogue);

    const result = processSpecialAction(state, 0, "암습");

    expect(result.diceResult).toMatchObject({
      raw: 6,
      stat: 6,
      total: 12,
      judgment: "success",
    });
    expect(result.playerDamage).toBe(7);
    expect(result.monsterDamage).toBe(0);
    expect(result.state.combat.monster?.hp).toBe(23);
  });
});
