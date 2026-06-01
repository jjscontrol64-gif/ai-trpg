import { GameState, Character, DifficultyMode } from "./types";
import { floors, floorEntrance } from "./dungeon-data";
import { starterWarriorEquip, starterRogueEquip, starterMageEquip, healPotion } from "./items";

function deepCloneDungeons() {
  return floors.map((floor) => {
    const cloned: Record<string, { type: string; monsterDifficulty?: number; visited: boolean }> =
      {};
    for (const [key, room] of Object.entries(floor)) {
      cloned[key] = { ...room, visited: false };
    }
    return cloned;
  }) as GameState["dungeons"];
}

export function createInitialState(
  playerName: string,
  mode: DifficultyMode = "normal"
): GameState {
  const warrior: Character = {
    name: playerName,
    role: "warrior",
    hp: 10,
    maxHp: 10,
    baseStats: { str: 4, dex: 1, int: 0 },
    equip: starterWarriorEquip(),
    actions: [
      { name: "강타", remaining: 3, max: 3, type: "combat" },
      { name: "활로개척", remaining: 3, max: 3, type: "exploration" },
    ],
  };

  const pina: Character = {
    name: "피나",
    role: "rogue",
    hp: 10,
    maxHp: 10,
    baseStats: { str: 1, dex: 4, int: 1 },
    equip: starterRogueEquip(),
    actions: [
      { name: "암습", remaining: 3, max: 3, type: "combat" },
      { name: "패스파인딩", remaining: 3, max: 3, type: "exploration" },
    ],
  };

  const mina: Character = {
    name: "미나",
    role: "mage",
    hp: 10,
    maxHp: 10,
    baseStats: { str: 0, dex: 1, int: 4 },
    equip: starterMageEquip(),
    actions: [
      { name: "마력속박", remaining: 3, max: 3, type: "combat" },
      { name: "연금생성", remaining: 3, max: 3, type: "exploration" },
    ],
  };

  const entrance = floorEntrance[1];

  return {
    party: {
      members: [warrior, pina, mina],
      inventory: [healPotion(), healPotion()],
      floor: 1,
      position: { ...entrance },
      inspiration: 1,
    },
    combat: {
      active: false,
      monster: null,
      bossCounters: { curseTurn: 0, breathTurn: 0, breathCharging: false },
      turnCount: 0,
    },
    mode,
    phase: "exploration",
    dungeons: deepCloneDungeons(),
    npcUsed: false,
    messageHistory: [],
  };
}
