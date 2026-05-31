import { afterEach, describe, expect, it, vi } from "vitest";

import { processAction } from "./index";
import { getCombatActions, processAttack } from "./combat";
import { Character, GameState, RoomType } from "../types";

function mockRoll(raw: number) {
  vi.spyOn(Math, "random").mockReturnValue((raw - 1) / 20);
}

function createCharacter(name: string, role: Character["role"], str = 4): Character {
  return {
    name,
    role,
    hp: 10,
    maxHp: 10,
    baseStats: { str, dex: 1, int: 0 },
    equip: {
      head: null,
      body: null,
      weapon: null,
    },
    actions: [],
  };
}

function createState(roomType: RoomType = "empty", inspiration = 0): GameState {
  return {
    party: {
      members: [
        createCharacter("Warrior", "warrior"),
        createCharacter("Rogue", "rogue", 1),
        createCharacter("Mage", "mage", 0),
      ],
      inventory: [],
      floor: 1,
      position: { col: "A", row: 1 },
      inspiration,
    },
    combat: {
      active: true,
      monster: {
        name: "Training Dummy",
        hp: 10,
        maxHp: 10,
        difficulty: 1,
        damage: 1,
      },
      bossCounters: { curseTurn: 0, breathTurn: 0, breathCharging: false },
      turnCount: 0,
    },
    mode: "normal",
    phase: "combat",
    dungeons: [
      { "A,1": { type: roomType, visited: true } },
      {},
      {},
    ],
    npcUsed: false,
    messageHistory: [],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("engine inspiration usage", () => {
  it("does not apply an attack inspiration bonus when no inspiration remains", () => {
    mockRoll(3);

    const result = processAttack(createState("monster", 0), 0, true);

    expect(result.state.party.inspiration).toBe(0);
    expect(result.diceResult).toMatchObject({
      raw: 3,
      stat: 4,
      inspirationBonus: 0,
      total: 7,
      judgment: "failure",
    });
  });

  it("does not apply a puzzle inspiration bonus when no inspiration remains", () => {
    mockRoll(3);

    const result = processAction(createState("puzzle", 0), {
      type: "puzzle_attempt",
      characterIndex: 0,
      stat: "str",
      useInspiration: true,
      isUnorthodox: false,
    });

    expect(result.newState.party.inspiration).toBe(0);
    expect(result.diceResult).toMatchObject({
      raw: 3,
      stat: 4,
      inspirationBonus: 0,
      total: 7,
      judgment: "failure",
    });
  });

  it("does not apply a trap inspiration bonus when no inspiration remains", () => {
    mockRoll(3);

    const result = processAction(createState("trap", 0), {
      type: "trap_attempt",
      characterIndex: 0,
      stat: "str",
      useInspiration: true,
    });

    expect(result.newState.party.inspiration).toBe(0);
    expect(result.diceResult).toMatchObject({
      raw: 3,
      stat: 4,
      inspirationBonus: 0,
      total: 7,
      judgment: "failure",
    });
  });

  it("spends inspiration and applies the bonus when inspiration remains", () => {
    mockRoll(3);

    const result = processAttack(createState("monster", 1), 0, true);

    expect(result.state.party.inspiration).toBe(0);
    expect(result.diceResult).toMatchObject({
      raw: 3,
      stat: 4,
      inspirationBonus: 5,
      total: 12,
      judgment: "success",
    });
  });

  it("does not duplicate combat attacks for inspiration variants", () => {
    const actions = getCombatActions(createState("monster", 1));

    const attacks = actions.filter((action) => action.type === "attack");

    expect(attacks).toHaveLength(3);
    expect(attacks).toEqual([
      { type: "attack", characterIndex: 0, useInspiration: false },
      { type: "attack", characterIndex: 1, useInspiration: false },
      { type: "attack", characterIndex: 2, useInspiration: false },
    ]);
  });
});
