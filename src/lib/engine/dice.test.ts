import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getEffectiveStat,
  judgeResult,
  judgeUnorthodox,
  performDiceCheck,
  rollD36,
} from "./dice";
import { Character } from "../types";

const character: Character = {
  name: "Test Warrior",
  role: "warrior",
  hp: 10,
  maxHp: 10,
  baseStats: { str: 2, dex: 1, int: 0 },
  equip: {
    head: {
      id: "str-head",
      name: "Strength Helm",
      rarity: "common",
      slot: "head",
      stat: "str",
      bonus: 1,
    },
    body: {
      id: "dex-body",
      name: "Dexterity Armor",
      rarity: "common",
      slot: "body",
      stat: "dex",
      bonus: 1,
    },
    weapon: {
      id: "str-weapon",
      name: "Strength Sword",
      rarity: "rare",
      slot: "weapon",
      stat: "str",
      bonus: 2,
    },
  },
  actions: [],
};

function mockRoll(raw: number) {
  vi.spyOn(Math, "random").mockReturnValue((raw - 1) / 36);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rollD36", () => {
  it("returns 1 when Math.random is at the lower bound", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(rollD36()).toBe(1);
  });

  it("returns 36 when Math.random is just below 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    expect(rollD36()).toBe(36);
  });
});

describe("judgeResult", () => {
  it.each([
    ["hard", 15, "critical_failure"],
    ["hard", 16, "failure"],
    ["hard", 29, "failure"],
    ["hard", 30, "success"],
    ["hard", 41, "success"],
    ["hard", 42, "critical_success"],
    ["normal", 10, "critical_failure"],
    ["normal", 11, "failure"],
    ["normal", 24, "failure"],
    ["normal", 25, "success"],
    ["normal", 37, "success"],
    ["normal", 38, "critical_success"],
    ["easy", 9, "critical_failure"],
    ["easy", 10, "failure"],
    ["easy", 17, "failure"],
    ["easy", 18, "success"],
    ["easy", 29, "success"],
    ["easy", 30, "critical_success"],
  ] as const)("judges %s total %i as %s", (mode, total, expected) => {
    expect(judgeResult(total, mode)).toBe(expected);
  });
});

describe("judgeUnorthodox", () => {
  it("fails on 25 or lower", () => {
    expect(judgeUnorthodox(25)).toBe("failure");
  });

  it("succeeds on 26 or higher", () => {
    expect(judgeUnorthodox(26)).toBe("success");
  });
});

describe("getEffectiveStat", () => {
  it("adds only equipment bonuses matching the requested stat", () => {
    expect(getEffectiveStat(character, "str")).toBe(5);
    expect(getEffectiveStat(character, "dex")).toBe(2);
    expect(getEffectiveStat(character, "int")).toBe(0);
  });
});

describe("performDiceCheck", () => {
  it("uses raw roll, effective stat, and inspiration bonus for orthodox checks", () => {
    mockRoll(20);

    expect(performDiceCheck(character, "str", true, "normal", false)).toEqual({
      raw: 20,
      stat: 5,
      inspirationBonus: 5,
      total: 30,
      judgment: "success",
      mode: "normal",
      isUnorthodox: false,
    });
  });

  it("does not add inspiration when it is not used", () => {
    mockRoll(20);

    expect(performDiceCheck(character, "str", false, "normal", false)).toMatchObject({
      raw: 20,
      stat: 5,
      inspirationBonus: 0,
      total: 25,
      judgment: "success",
    });
  });

  it("ignores stat and inspiration for unorthodox checks", () => {
    mockRoll(26);

    expect(performDiceCheck(character, "str", true, "hard", true)).toEqual({
      raw: 26,
      stat: 0,
      inspirationBonus: 0,
      total: 26,
      judgment: "success",
      mode: "hard",
      isUnorthodox: true,
    });
  });

  it("uses the unorthodox threshold regardless of difficulty mode", () => {
    mockRoll(25);

    expect(performDiceCheck(character, "str", true, "easy", true)).toMatchObject({
      raw: 25,
      total: 25,
      judgment: "failure",
      isUnorthodox: true,
    });
  });
});
