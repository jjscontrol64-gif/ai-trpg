import {
  GameState,
  MonsterState,
  DiceRollResult,
  Character,
  PlayerAction,
} from "../types";
import { performDiceCheck } from "./dice";
import { bossesByFloor, monstersByDifficulty } from "../registry/game-registry";

export function spawnMonster(difficulty: 1 | 2 | 3): MonsterState {
  const pool = monstersByDifficulty[difficulty];
  const template = pool[Math.floor(Math.random() * pool.length)];
  return {
    name: template.name,
    hp: template.hp,
    maxHp: template.hp,
    difficulty,
    damage: difficulty,
  };
}

export function spawnBoss(floor: 1 | 2 | 3): MonsterState {
  const template = bossesByFloor[floor];
  return {
    name: template.name,
    hp: template.hp,
    maxHp: template.hp,
    difficulty: "boss",
    damage: template.damage,
  };
}

export function initCombat(state: GameState, monster: MonsterState): GameState {
  return {
    ...state,
    phase: "combat",
    combat: {
      active: true,
      monster,
      bossCounters: { curseTurn: 0, breathTurn: 0, breathCharging: false },
      turnCount: 0,
    },
  };
}

export interface CombatTurnResult {
  state: GameState;
  diceResult?: DiceRollResult;
  playerDamage: number;
  monsterDamage: number;
  monsterDefeated: boolean;
  partyDefeated: boolean;
  eventLog: string;
}

export function processAttack(
  state: GameState,
  characterIndex: number,
  useInspiration: boolean
): CombatTurnResult {
  const s = structuredClone(state);
  const monster = s.combat.monster!;
  const character = s.party.members[characterIndex];
  let eventLog = "";
  let playerDamage = 0;
  let monsterDmg = 0;

  const effectiveUseInspiration = useInspiration && s.party.inspiration > 0;

  if (effectiveUseInspiration) {
    s.party.inspiration = Math.max(0, s.party.inspiration - 1) as 0 | 1 | 2 | 3;
  }

  const mainStat = getMainStat(character);
  const diceResult = performDiceCheck(
    character,
    mainStat,
    effectiveUseInspiration,
    s.mode,
    false
  );

  switch (diceResult.judgment) {
    case "critical_success":
      playerDamage = 5;
      monsterDmg = 0;
      eventLog = `대성공! ${character.name}의 공격으로 ${monster.name}에게 5 데미지. 몬스터 공격 회피.`;
      break;
    case "success":
      playerDamage = 2;
      eventLog = `성공! ${character.name}의 공격으로 ${monster.name}에게 2 데미지.`;
      break;
    case "failure":
      playerDamage = 0;
      eventLog = `실패. ${character.name}의 공격이 빗나갔다.`;
      break;
    case "critical_failure":
      playerDamage = 0;
      eventLog = `대실패! ${character.name}의 장비가 일시 유실.`;
      s.combat.disarmed = { characterIndex, turnsRemaining: 1 };
      break;
  }

  monster.hp = Math.max(0, monster.hp - playerDamage);

  const monsterDefeated = monster.hp <= 0;
  if (!monsterDefeated && diceResult.judgment !== "critical_success") {
    if (!monster.statusEffect || monster.statusEffect.remaining <= 0) {
      monsterDmg = applyMonsterDamage(s, monster, characterIndex);
      eventLog += ` ${monster.name}의 반격으로 ${monsterDmg} 데미지.`;
    } else {
      eventLog += ` ${monster.name}은(는) ${monster.statusEffect.type === "bind" ? "속박" : "기절"} 상태.`;
    }
  }

  if (monster.statusEffect && monster.statusEffect.remaining > 0) {
    monster.statusEffect.remaining--;
    if (monster.statusEffect.remaining <= 0) {
      monster.statusEffect = undefined;
    }
  }

  s.combat.turnCount++;
  s.combat.monster = monster;

  if (monsterDefeated) {
    s.combat.active = false;
    s.phase = "exploration";
    s.party.inspiration = Math.min(3, s.party.inspiration + 1) as 0 | 1 | 2 | 3;
    eventLog += ` ${monster.name} 격파! 영감 +1.`;
  }

  const partyDefeated = s.party.members.every((m) => m.hp <= 0);
  if (partyDefeated) {
    s.phase = "game_over";
    eventLog += " 파티 전멸...";
  }

  return {
    state: s,
    diceResult,
    playerDamage,
    monsterDamage: monsterDmg,
    monsterDefeated,
    partyDefeated,
    eventLog,
  };
}

function applyMonsterDamage(
  state: GameState,
  monster: MonsterState,
  attackerIndex: number
): number {
  if (monster.difficulty === "boss") {
    return applyBossDamage(state, monster);
  }
  const dmg = monster.damage;
  state.party.members[attackerIndex].hp = Math.max(
    0,
    state.party.members[attackerIndex].hp - dmg
  );
  return dmg;
}

function applyBossDamage(state: GameState, monster: MonsterState): number {
  const floor = state.party.floor;

  if (floor === 1) {
    // 리치: 전체 1 (매턴)
    for (const m of state.party.members) {
      if (m.hp > 0) m.hp = Math.max(0, m.hp - 1);
    }
    return 1;
  }

  if (floor === 2) {
    // 발록: 기본 2 데미지 (공격자에게)
    // 악마의 저주: 2턴에 1회
    const bc = state.combat.bossCounters;
    if (bc.curseTurn > 0 && state.combat.turnCount % 2 === 0) {
      const aliveMembers = state.party.members
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => m.hp > 0);
      if (aliveMembers.length > 0) {
        const target = aliveMembers[Math.floor(Math.random() * aliveMembers.length)];
        state.combat.disarmed = { characterIndex: target.i, turnsRemaining: -1 };
      }
    }
    bc.curseTurn++;
    return monster.damage;
  }

  if (floor === 3) {
    // 레드드래곤: 기본 3
    // 화염 브레스: 3턴에 1회 준비 → 다음 턴 전체 5
    const bc = state.combat.bossCounters;
    if (bc.breathCharging) {
      for (const m of state.party.members) {
        if (m.hp > 0) m.hp = Math.max(0, m.hp - 5);
      }
      bc.breathCharging = false;
      bc.breathTurn = state.combat.turnCount;
      return 5;
    }
    if (state.combat.turnCount - bc.breathTurn >= 3) {
      bc.breathCharging = true;
    }
    return monster.damage;
  }

  return monster.damage;
}

export function processSpecialAction(
  state: GameState,
  characterIndex: number,
  actionName: string
): CombatTurnResult {
  const s = structuredClone(state);
  const character = s.party.members[characterIndex];
  const action = character.actions.find((a) => a.name === actionName);
  let eventLog = "";
  let diceResult: DiceRollResult | undefined;

  if (!action || action.remaining <= 0) {
    return {
      state: s,
      playerDamage: 0,
      monsterDamage: 0,
      monsterDefeated: false,
      partyDefeated: false,
      eventLog: `${actionName} 사용 불가 (잔여 횟수 부족).`,
    };
  }

  action.remaining--;
  const monster = s.combat.monster!;

  switch (actionName) {
    case "강타": {
      // 무조건 대성공
      monster.hp = Math.max(0, monster.hp - 5);
      eventLog = `강타! ${character.name}의 필살 공격으로 ${monster.name}에게 5 데미지. 몬스터 공격 회피.`;
      break;
    }
    case "암습": {
      // 몬스터 공격 회피 + 자신 공격은 다이스 판정
      const mainStat = getMainStat(character);
      diceResult = performDiceCheck(character, mainStat, false, s.mode, false);
      const dmg =
        diceResult.judgment === "critical_success"
          ? 5
          : diceResult.judgment === "success"
            ? 2
            : 0;
      monster.hp = Math.max(0, monster.hp - dmg);
      eventLog = `암습! 피나가 그림자에서 공격. ${dmg} 데미지. 몬스터 반격 회피.`;
      break;
    }
    case "마력속박": {
      // 몬스터 2턴 행동불능
      monster.statusEffect = { type: "bind", remaining: 2 };
      eventLog = `마력속박! 미나가 ${monster.name}을(를) 2턴간 속박.`;
      break;
    }
  }

  const monsterDefeated = monster.hp <= 0;
  if (monsterDefeated) {
    s.combat.active = false;
    s.phase = "exploration";
    s.party.inspiration = Math.min(3, s.party.inspiration + 1) as 0 | 1 | 2 | 3;
    eventLog += ` ${monster.name} 격파! 영감 +1.`;
  }

  s.combat.monster = monster;
  s.combat.turnCount++;

  return {
    state: s,
    diceResult,
    playerDamage: 0,
    monsterDamage: 0,
    monsterDefeated,
    partyDefeated: false,
    eventLog,
  };
}

export function processFlee(state: GameState, useSmokeBomb: boolean): CombatTurnResult {
  const s = structuredClone(state);
  let eventLog = "";

  if (useSmokeBomb) {
    const bombIdx = s.party.inventory.findIndex((i) => i.autoFlee);
    if (bombIdx >= 0) {
      s.party.inventory.splice(bombIdx, 1);
      s.combat.active = false;
      s.phase = "exploration";
      eventLog = "연막탄 사용! 안전하게 후퇴.";
      return {
        state: s,
        playerDamage: 0,
        monsterDamage: 0,
        monsterDefeated: false,
        partyDefeated: false,
        eventLog,
      };
    }
  }

  const diceResult = performDiceCheck(s.party.members[0], "dex", false, s.mode, false);
  if (
    diceResult.judgment === "success" ||
    diceResult.judgment === "critical_success"
  ) {
    s.combat.active = false;
    s.phase = "exploration";
    eventLog = "도주 성공!";
  } else {
    const monster = s.combat.monster!;
    const dmg = typeof monster.damage === "number" ? monster.damage : 1;
    s.party.members[0].hp = Math.max(0, s.party.members[0].hp - dmg);
    eventLog = `도주 실패. ${monster.name}에게 ${dmg} 피격.`;
  }

  return {
    state: s,
    diceResult,
    playerDamage: 0,
    monsterDamage: 0,
    monsterDefeated: false,
    partyDefeated: s.party.members.every((m) => m.hp <= 0),
    eventLog,
  };
}

export function getCombatActions(state: GameState): PlayerAction[] {
  const actions: PlayerAction[] = [];

  state.party.members.forEach((member, idx) => {
    if (member.hp <= 0) return;
    actions.push({ type: "attack", characterIndex: idx, useInspiration: false });
    for (const action of member.actions) {
      if (action.remaining > 0 && action.type === "combat") {
        actions.push({
          type: "special_action",
          characterIndex: idx,
          actionName: action.name,
        });
      }
    }
  });

  actions.push({ type: "flee", useSmokeBomb: false });
  if (state.party.inventory.some((i) => i.autoFlee)) {
    actions.push({ type: "flee", useSmokeBomb: true });
  }

  const usableItems = state.party.inventory.filter(
    (i) => i.effectId || i.hpRestore || i.allHpRestore || i.actionRestore
  );
  for (const item of usableItems) {
    actions.push({ type: "use_item", itemId: item.id });
  }

  return actions;
}

function getMainStat(character: Character): "str" | "dex" | "int" {
  const s = character.baseStats;
  if (s.str >= s.dex && s.str >= s.int) return "str";
  if (s.dex >= s.str && s.dex >= s.int) return "dex";
  return "int";
}
