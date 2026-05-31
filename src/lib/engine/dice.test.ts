import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getEffectiveStat,
  judgeResult,
  judgeUnorthodox,
  performDiceCheck,
  rollD20,
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
  vi.spyOn(Math, "random").mockReturnValue((raw - 1) / 20);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("rollD20", () => {
  it("returns 1 when Math.random is at the lower bound", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(rollD20()).toBe(1);
  });

  it("returns 20 when Math.random is just below 1", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);

    expect(rollD20()).toBe(20);
  });
});

describe("judgeResult", () => {
  it.each([
    ["hard", 7, "critical_failure"],
    ["hard", 8, "failure"],
    ["hard", 15, "failure"],
    ["hard", 16, "success"],
    ["hard", 23, "success"],
    ["hard", 24, "critical_success"],
    ["normal", 5, "critical_failure"],
    ["normal", 6, "failure"],
    ["normal", 11, "failure"],
    ["normal", 12, "success"],
    ["normal", 22, "success"],
    ["normal", 23, "critical_success"],
    ["easy", 3, "critical_failure"],
    ["easy", 4, "failure"],
    ["easy", 8, "failure"],
    ["easy", 9, "success"],
    ["easy", 19, "success"],
    ["easy", 20, "critical_success"],
  ] as const)("judges %s total %i as %s", (mode, total, expected) => {
    expect(judgeResult(total, mode)).toBe(expected);
  });
});

describe("judgeUnorthodox", () => {
  it("fails on 14 or lower", () => {
    expect(judgeUnorthodox(14)).toBe("failure");
  });

  it("succeeds on 15 or higher", () => {
    expect(judgeUnorthodox(15)).toBe("success");
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
    mockRoll(12);

    expect(performDiceCheck(character, "str", true, "normal", false)).toEqual({
      raw: 12,
      stat: 5,
      inspirationBonus: 5,
      total: 22,
      judgment: "success",
      mode: "normal",
      isUnorthodox: false,
    });
  });

  it("does not add inspiration when it is not used", () => {
    mockRoll(7);

    expect(performDiceCheck(character, "str", false, "normal", false)).toMatchObject({
      raw: 7,
      stat: 5,
      inspirationBonus: 0,
      total: 12,
      judgment: "success",
    });
  });

  it("ignores stat and inspiration for unorthodox checks", () => {
    mockRoll(15);

    expect(performDiceCheck(character, "str", true, "hard", true)).toEqual({
      raw: 15,
      stat: 0,
      inspirationBonus: 0,
      total: 15,
      judgment: "success",
      mode: "hard",
      isUnorthodox: true,
    });
  });

  it("uses the unorthodox threshold regardless of difficulty mode", () => {
    mockRoll(14);

    expect(performDiceCheck(character, "str", true, "easy", true)).toMatchObject({
      raw: 14,
      total: 14,
      judgment: "failure",
      isUnorthodox: true,
    });
  });
});
