import {
  GameState,
  StatusWindowData,
  CharacterStatusDisplay,
  MonsterStatusDisplay,
  PartyStatusDisplay,
  Character,
} from "./types";
import { roomTypeEmoji } from "./dungeon-data";
import { normalizeAffinity } from "./state-normalization";

function formatStat(base: number, equip: Character["equip"], stat: "str" | "dex" | "int"): string {
  let bonus = 0;
  for (const slot of ["head", "body", "weapon"] as const) {
    const item = equip[slot];
    if (item && item.stat === stat) {
      bonus += item.bonus;
    }
  }
  return bonus > 0 ? `${base}+${bonus}` : `${base}`;
}

function formatAffinity(level: 0 | 1 | 2 | 3): string {
  return `${"♥".repeat(level)}${"♡".repeat(3 - level)} ${level}/3`;
}

function formatCharacter(
  char: Character,
  affinity?: 0 | 1 | 2 | 3
): CharacterStatusDisplay {
  return {
    name: char.name,
    hp: `${char.hp}/${char.maxHp}`,
    str: formatStat(char.baseStats.str, char.equip, "str"),
    dex: formatStat(char.baseStats.dex, char.equip, "dex"),
    int: formatStat(char.baseStats.int, char.equip, "int"),
    skill: char.actions
      .map((a) => `${a.name}(${a.remaining}/${a.max})`)
      .join(" "),
    equip: [
      char.equip.head?.name ?? "없음",
      char.equip.body?.name ?? "없음",
      char.equip.weapon?.name ?? "없음",
    ],
    affinity: affinity === undefined ? undefined : formatAffinity(affinity),
  };
}

function formatMonster(state: GameState): MonsterStatusDisplay | null {
  const m = state.combat.monster;
  if (!m || !state.combat.active) return null;

  const levelMap: Record<string, "Ⅰ" | "Ⅱ" | "Ⅲ" | "💀"> = {
    "1": "Ⅰ",
    "2": "Ⅱ",
    "3": "Ⅲ",
    boss: "💀",
  };

  return {
    name: m.name,
    hp: `${m.hp}`,
    maxHp: `${m.maxHp}`,
    level: levelMap[String(m.difficulty)] ?? "Ⅰ",
    statusEffect: m.statusEffect
      ? `${m.statusEffect.type === "bind" ? "속박" : "기절"}(${m.statusEffect.remaining}턴 남음)`
      : undefined,
  };
}

function formatParty(state: GameState): PartyStatusDisplay {
  const floorEmoji: Record<number, "1️⃣" | "2️⃣" | "3️⃣"> = {
    1: "1️⃣",
    2: "2️⃣",
    3: "3️⃣",
  };

  const pos = state.party.position;
  const room = state.dungeons[state.party.floor - 1][`${pos.col},${pos.row}`];
  const roomDesc = room ? roomTypeEmoji[room.type] ?? "" : "";
  const diff = room?.monsterDifficulty
    ? ["", "Ⅰ", "Ⅱ", "Ⅲ"][room.monsterDifficulty]
    : "";

  const invItems: Record<string, number> = {};
  for (const item of state.party.inventory) {
    invItems[item.name] = (invItems[item.name] || 0) + 1;
  }
  const invStr = Object.entries(invItems)
    .map(([name, count]) => (count > 1 ? `${name}x${count}` : name))
    .join(", ") || "없음";

  const stars = "★".repeat(state.party.inspiration) +
    "☆".repeat(3 - state.party.inspiration);

  return {
    inv: invStr,
    floor: floorEmoji[state.party.floor],
    loc: `${pos.col}${pos.row} - ${roomDesc}${diff}`,
    star: stars,
  };
}

export function buildStatusWindow(state: GameState): StatusWindowData {
  const affinity = normalizeAffinity(state.party.affinity);
  return {
    warrior: formatCharacter(state.party.members[0]),
    pina: formatCharacter(state.party.members[1], affinity.pina),
    mina: formatCharacter(state.party.members[2], affinity.mina),
    monster: formatMonster(state),
    party: formatParty(state),
  };
}
