import { DungeonMap, RoomData } from "./types";

function r(type: RoomData["type"], monsterDifficulty?: 1 | 2 | 3): RoomData {
  return { type, monsterDifficulty, visited: false };
}

// 1층 (5×6) — 입구: C6
export const floor1: DungeonMap = {
  "A,1": r("treasure"),
  "B,1": r("puzzle"),
  "C,1": r("empty"),
  "D,1": r("safe"),
  "E,1": r("boss"),

  "A,2": r("monster", 2),
  "B,2": r("wall"),
  "C,2": r("monster", 1),
  "D,2": r("wall"),
  "E,2": r("safe"),

  "A,3": r("monster", 1),
  "B,3": r("empty"),
  "C,3": r("puzzle"),
  "D,3": r("trap"),
  "E,3": r("treasure"),

  "A,4": r("trap"),
  "B,4": r("monster", 1),
  "C,4": r("empty"),
  "D,4": r("monster", 1),
  "E,4": r("trap"),

  "A,5": r("treasure"),
  "B,5": r("empty"),
  "C,5": r("monster", 1),
  "D,5": r("empty"),
  "E,5": r("puzzle"),

  "A,6": r("wall"),
  "B,6": r("wall"),
  "C,6": r("entrance"),
  "D,6": r("wall"),
  "E,6": r("wall"),
};

// 2층 (6×6) — 입구: F6
export const floor2: DungeonMap = {
  "A,1": r("boss"),
  "B,1": r("safe"),
  "C,1": r("empty"),
  "D,1": r("treasure"),
  "E,1": r("puzzle"),
  "F,1": r("monster", 3),

  "A,2": r("safe"),
  "B,2": r("wall"),
  "C,2": r("monster", 1),
  "D,2": r("trap"),
  "E,2": r("wall"),
  "F,2": r("safe"),

  "A,3": r("monster", 2),
  "B,3": r("empty"),
  "C,3": r("wall"),
  "D,3": r("puzzle"),
  "E,3": r("monster", 2),
  "F,3": r("empty"),

  "A,4": r("trap"),
  "B,4": r("puzzle"),
  "C,4": r("monster", 2),
  "D,4": r("wall"),
  "E,4": r("trap"),
  "F,4": r("treasure"),

  "A,5": r("treasure"),
  "B,5": r("monster", 2),
  "C,5": r("wall"),
  "D,5": r("monster", 2),
  "E,5": r("empty"),
  "F,5": r("trap"),

  "A,6": r("treasure"),
  "B,6": r("puzzle"),
  "C,6": r("monster", 1),
  "D,6": r("empty"),
  "E,6": r("npc"),
  "F,6": r("entrance"),
};

// 3층 (7×7) — 입구: A1
export const floor3: DungeonMap = {
  "A,1": r("entrance"),
  "B,1": r("monster", 2),
  "C,1": r("wall"),
  "D,1": r("treasure"),
  "E,1": r("puzzle"),
  "F,1": r("monster", 3),
  "G,1": r("treasure"),

  "A,2": r("puzzle"),
  "B,2": r("empty"),
  "C,2": r("safe"),
  "D,2": r("trap"),
  "E,2": r("wall"),
  "F,2": r("safe"),
  "G,2": r("wall"),

  "A,3": r("monster", 3),
  "B,3": r("empty"),
  "C,3": r("wall"),
  "D,3": r("monster", 3),
  "E,3": r("puzzle"),
  "F,3": r("empty"),
  "G,3": r("monster", 3),

  "A,4": r("treasure"),
  "B,4": r("trap"),
  "C,4": r("safe"),
  "D,4": r("wall"),
  "E,4": r("trap"),
  "F,4": r("monster", 3),
  "G,4": r("puzzle"),

  "A,5": r("wall"),
  "B,5": r("puzzle"),
  "C,5": r("wall"),
  "D,5": r("monster", 2),
  "E,5": r("wall"),
  "F,5": r("monster", 3),
  "G,5": r("treasure"),

  "A,6": r("treasure"),
  "B,6": r("empty"),
  "C,6": r("trap"),
  "D,6": r("empty"),
  "E,6": r("monster", 3),
  "F,6": r("empty"),
  "G,6": r("safe"),

  "A,7": r("safe"),
  "B,7": r("monster", 3),
  "C,7": r("treasure"),
  "D,7": r("puzzle"),
  "E,7": r("wall"),
  "F,7": r("safe"),
  "G,7": r("boss"),
};

export const floors: [DungeonMap, DungeonMap, DungeonMap] = [floor1, floor2, floor3];

export const floorEntrance: Record<number, { col: string; row: number }> = {
  1: { col: "C", row: 6 },
  2: { col: "F", row: 6 },
  3: { col: "A", row: 1 },
};

export const floorSize: Record<number, { cols: string[]; rows: number[] }> = {
  1: { cols: ["A", "B", "C", "D", "E"], rows: [1, 2, 3, 4, 5, 6] },
  2: { cols: ["A", "B", "C", "D", "E", "F"], rows: [1, 2, 3, 4, 5, 6] },
  3: { cols: ["A", "B", "C", "D", "E", "F", "G"], rows: [1, 2, 3, 4, 5, 6, 7] },
};

export const roomTypeEmoji: Record<string, string> = {
  monster: "👹",
  puzzle: "🗝️",
  treasure: "🎁",
  trap: "🕸️",
  safe: "⛺",
  wall: "🧱",
  npc: "🧙‍♂️",
  boss: "💀",
  empty: "–",
  entrance: "🚪",
};

export interface MonsterTemplate {
  name: string;
  hp: number;
  difficulty: 1 | 2 | 3;
}

export const monstersByDifficulty: Record<number, MonsterTemplate[]> = {
  1: [
    { name: "고블린", hp: 3, difficulty: 1 },
    { name: "거대거미", hp: 4, difficulty: 1 },
    { name: "슬라임", hp: 4, difficulty: 1 },
    { name: "스켈레톤", hp: 7, difficulty: 1 },
  ],
  2: [
    { name: "오거", hp: 11, difficulty: 2 },
    { name: "와이번", hp: 10, difficulty: 2 },
    { name: "가고일", hp: 13, difficulty: 2 },
    { name: "구울", hp: 9, difficulty: 2 },
  ],
  3: [
    { name: "미노타우르스", hp: 14, difficulty: 3 },
    { name: "트롤", hp: 20, difficulty: 3 },
    { name: "와이트", hp: 17, difficulty: 3 },
    { name: "골렘", hp: 22, difficulty: 3 },
    { name: "키메라", hp: 16, difficulty: 3 },
  ],
};

export interface BossTemplate {
  name: string;
  hp: number;
  damage: number;
  floor: 1 | 2 | 3;
}

export const bosses: Record<number, BossTemplate> = {
  1: { name: "리치", hp: 25, damage: 1, floor: 1 },
  2: { name: "발록", hp: 28, damage: 2, floor: 2 },
  3: { name: "레드드래곤", hp: 30, damage: 3, floor: 3 },
};
