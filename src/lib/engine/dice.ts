import { DifficultyMode, JudgmentResult, DiceRollResult, StatType, Character } from "../types";

export function rollD36(): number {
  return Math.floor(Math.random() * 36) + 1;
}

const thresholds: Record<DifficultyMode, { critSuccess: number; success: number; failure: number }> = {
  hard: { critSuccess: 42, success: 30, failure: 16 },
  normal: { critSuccess: 38, success: 25, failure: 11 },
  easy: { critSuccess: 30, success: 18, failure: 10 },
};

export function judgeResult(total: number, mode: DifficultyMode): JudgmentResult {
  const t = thresholds[mode];
  if (total >= t.critSuccess) return "critical_success";
  if (total >= t.success) return "success";
  if (total >= t.failure) return "failure";
  return "critical_failure";
}

export function judgeUnorthodox(raw: number): JudgmentResult {
  return raw >= 26 ? "success" : "failure";
}

export function getEffectiveStat(character: Character, stat: StatType): number {
  const base = character.baseStats[stat];
  let bonus = 0;
  for (const slot of ["head", "body", "weapon"] as const) {
    const item = character.equip[slot];
    if (item && item.stat === stat) {
      bonus += item.bonus;
    }
  }
  return base + bonus;
}

export function performDiceCheck(
  character: Character,
  stat: StatType,
  useInspiration: boolean,
  mode: DifficultyMode,
  isUnorthodox: boolean
): DiceRollResult {
  const raw = rollD36();

  if (isUnorthodox) {
    return {
      raw,
      stat: 0,
      inspirationBonus: 0,
      total: raw,
      judgment: judgeUnorthodox(raw),
      mode,
      isUnorthodox: true,
    };
  }

  const statValue = getEffectiveStat(character, stat);
  const inspirationBonus = useInspiration ? 5 : 0;
  const total = raw + statValue + inspirationBonus;

  return {
    raw,
    stat: statValue,
    inspirationBonus,
    total,
    judgment: judgeResult(total, mode),
    mode,
    isUnorthodox: false,
  };
}
