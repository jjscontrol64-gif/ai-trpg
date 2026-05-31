import {
  GameState,
  PlayerAction,
  EngineResult,
  ConsumableItem,
  RoomData,
  RoomType,
} from "../types";
import { performDiceCheck } from "./dice";
import {
  getAdjacentPosition,
  getRoomAt,
  getRoomKey,
  getAvailableDirections,
} from "./movement";
import {
  spawnMonster,
  spawnBoss,
  initCombat,
  processAttack,
  processSpecialAction,
  processFlee,
  getCombatActions,
} from "./combat";
import {
  getRandomEquip,
  getRandomConsumable,
  healPotion,
  superiorHealPotion,
  elixir,
} from "../items";
import { floorEntrance } from "../dungeon-data";
import { itemEffectsById } from "../registry/game-registry";

type ActionHandlerMap = {
  [K in PlayerAction["type"]]: (
    state: GameState,
    action: Extract<PlayerAction, { type: K }>
  ) => EngineResult;
};

const actionHandlers = {
  move: (state, action) => processMove(state, action.direction),
  attack: (state, action) =>
    processCombatAttack(state, action.characterIndex, action.useInspiration),
  special_action: (state, action) =>
    processCombatSpecial(state, action.characterIndex, action.actionName),
  flee: (state, action) => processCombatFlee(state, action.useSmokeBomb),
  use_item: (state, action) =>
    processUseItem(state, action.itemId, action.targetIndex),
  rest: (state) => processRest(state),
  puzzle_attempt: (state, action) => processPuzzle(state, action),
  trap_attempt: (state, action) => processTrap(state, action),
  npc_interact: (state) => processNpc(state),
  pathfinding: (state) => processPathfinding(state),
  alchemy: (state) => processAlchemy(state),
} satisfies ActionHandlerMap;

type RoomHandlerContext = {
  col: string;
  row: number;
  room: RoomData;
};

type RoomHandler = (
  state: GameState,
  context: RoomHandlerContext
) => EngineResult;

type RoomHandlerMap = {
  [K in RoomType]: RoomHandler;
};

const roomHandlers = {
  monster: handleMonsterRoom,
  boss: handleBossRoom,
  safe: handleSafeRoom,
  treasure: handleTreasureRoom,
  puzzle: handlePuzzleRoom,
  trap: handleTrapRoom,
  npc: handleNpcRoom,
  entrance: handleDefaultRoom,
  empty: handleDefaultRoom,
  wall: handleDefaultRoom,
} satisfies RoomHandlerMap;

export function processAction(
  state: GameState,
  action: PlayerAction
): EngineResult {
  const handler = actionHandlers[action.type] as (
    state: GameState,
    action: PlayerAction
  ) => EngineResult;

  return handler(state, action);
}

function processMove(
  state: GameState,
  direction: "north" | "south" | "east" | "west"
): EngineResult {
  const s = structuredClone(state);
  const newPos = getAdjacentPosition(
    s.party.position.col,
    s.party.position.row,
    direction
  );
  s.party.position = newPos;

  const roomKey = getRoomKey(newPos.col, newPos.row);
  const dungeon = s.dungeons[s.party.floor - 1];
  const room = dungeon[roomKey];

  if (!room) {
    return {
      newState: s,
      eventSummary: "빈 공간으로 이동했다.",
      nextActions: getAvailableDirections(s),
    };
  }

  const wasVisited = room.visited;
  room.visited = true;

  if (wasVisited && room.type !== "safe") {
    return {
      newState: s,
      eventSummary: `${newPos.col}${newPos.row}로 이동. 이미 탐색한 방이다.`,
      nextActions: getAvailableDirections(s),
    };
  }

  return roomHandlers[room.type](s, {
    col: newPos.col,
    row: newPos.row,
    room,
  });
}

function handleMonsterRoom(
  state: GameState,
  { col, row, room }: RoomHandlerContext
): EngineResult {
  const monster = spawnMonster(room.monsterDifficulty!);
  const combatState = initCombat(state, monster);
  return {
    newState: combatState,
    eventSummary: `${col}${row}로 이동. 👹 ${monster.name}(HP:${monster.hp}) 출현!`,
    nextActions: getCombatActions(combatState),
  };
}

function handleBossRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  const boss = spawnBoss(state.party.floor);
  const combatState = initCombat(state, boss);
  return {
    newState: combatState,
    eventSummary: `${col}${row}로 이동. 💀 보스 ${boss.name}(HP:${boss.hp}) 출현!`,
    nextActions: getCombatActions(combatState),
  };
}

function handleSafeRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  for (const member of state.party.members) {
    if (member.hp > 0) {
      member.hp = Math.min(member.maxHp, member.hp + 5);
    }
  }

  return {
    newState: state,
    eventSummary: `${col}${row}로 이동. ⛺ 안전지대. 전원 HP +5 회복.`,
    nextActions: getAvailableDirections(state),
  };
}

function handleTreasureRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  state.phase = "event";
  return {
    newState: state,
    eventSummary: `${col}${row}로 이동. 🎁 보물의 방 발견! 보물 상자가 있다.`,
    nextActions: [
      {
        type: "puzzle_attempt",
        characterIndex: 0,
        stat: "str",
        useInspiration: false,
        isUnorthodox: false,
      },
    ],
  };
}

function handlePuzzleRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  state.phase = "event";
  return {
    newState: state,
    eventSummary: `${col}${row}로 이동. 🗝️ 수수께끼의 방. 난관이 앞을 가로막는다.`,
    nextActions: buildPuzzleActions(state),
  };
}

function handleTrapRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  state.phase = "event";
  return {
    newState: state,
    eventSummary: `${col}${row}로 이동. 🕸️ 함정의 방. 위험한 기운이 감돈다.`,
    nextActions: buildTrapActions(state),
  };
}

function handleNpcRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  if (state.npcUsed) {
    return {
      newState: state,
      eventSummary: `${col}${row}로 이동. 린린이 있던 자리. 이미 떠났다.`,
      nextActions: getAvailableDirections(state),
    };
  }

  return {
    newState: state,
    eventSummary: `${col}${row}로 이동. 🧙‍♂️ NPC 린린을 만났다!`,
    nextActions: [{ type: "npc_interact" }],
  };
}

function handleDefaultRoom(
  state: GameState,
  { col, row }: RoomHandlerContext
): EngineResult {
  return {
    newState: state,
    eventSummary: `${col}${row}로 이동.`,
    nextActions: getAvailableDirections(state),
  };
}

function processCombatAttack(
  state: GameState,
  characterIndex: number,
  useInspiration: boolean
): EngineResult {
  const result = processAttack(state, characterIndex, useInspiration);
  return {
    newState: result.state,
    diceResult: result.diceResult,
    eventSummary: result.eventLog,
    nextActions: result.monsterDefeated || result.partyDefeated
      ? getPostCombatActions(result.state)
      : getCombatActions(result.state),
  };
}

function processCombatSpecial(
  state: GameState,
  characterIndex: number,
  actionName: string
): EngineResult {
  const result = processSpecialAction(state, characterIndex, actionName);
  return {
    newState: result.state,
    diceResult: result.diceResult,
    eventSummary: result.eventLog,
    nextActions: result.monsterDefeated || result.partyDefeated
      ? getPostCombatActions(result.state)
      : getCombatActions(result.state),
  };
}

function processCombatFlee(
  state: GameState,
  useSmokeBomb: boolean
): EngineResult {
  const result = processFlee(state, useSmokeBomb);
  return {
    newState: result.state,
    diceResult: result.diceResult,
    eventSummary: result.eventLog,
    nextActions: result.state.combat.active
      ? getCombatActions(result.state)
      : getAvailableDirections(result.state),
  };
}

function processUseItem(
  state: GameState,
  itemId: string,
  targetIndex?: number
): EngineResult {
  const s = structuredClone(state);
  const itemIdx = s.party.inventory.findIndex((i) => i.id === itemId);
  if (itemIdx < 0) {
    return { newState: s, eventSummary: "아이템을 찾을 수 없다.", nextActions: [] };
  }

  const item = s.party.inventory[itemIdx];
  s.party.inventory.splice(itemIdx, 1);

  if (item.effectId) {
    const effect = itemEffectsById[item.effectId];
    if (!effect) {
      return {
        newState: s,
        eventSummary: `Item effect not found: ${item.effectId}`,
        nextActions: s.combat.active ? getCombatActions(s) : getAvailableDirections(s),
      };
    }

    const getNextActions = (nextState: GameState) =>
      nextState.combat.active
        ? getCombatActions(nextState)
        : getAvailableDirections(nextState);
    const result = effect.apply({ state: s, item, targetIndex, getNextActions });
    return {
      newState: result.state,
      eventSummary: result.eventSummary,
      nextActions: result.nextActions,
    };
  }

  let summary = "";

  if (item.hpRestore) {
    const target = targetIndex ?? 0;
    const member = s.party.members[target];
    member.hp = Math.min(member.maxHp, member.hp + item.hpRestore);
    summary = `${member.name}이(가) ${item.name} 사용. HP +${item.hpRestore} 회복.`;
  } else if (item.allHpRestore) {
    for (const m of s.party.members) {
      if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + item.allHpRestore);
    }
    summary = `${item.name} 사용. 전원 HP +${item.allHpRestore} 회복.`;
  } else if (item.actionRestore) {
    const target = targetIndex ?? 0;
    const member = s.party.members[target];
    for (const action of member.actions) {
      action.remaining = Math.min(action.max, action.remaining + item.actionRestore);
    }
    summary = `${member.name}이(가) ${item.name} 사용. 특수액션 +${item.actionRestore} 회복.`;
  }

  const nextActions = s.combat.active
    ? getCombatActions(s)
    : getAvailableDirections(s);

  return { newState: s, eventSummary: summary, nextActions };
}

function processRest(state: GameState): EngineResult {
  const s = structuredClone(state);
  for (const m of s.party.members) {
    if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + 5);
  }
  return {
    newState: s,
    eventSummary: "파티가 휴식을 취했다. 전원 HP +5.",
    nextActions: getAvailableDirections(s),
  };
}

function processPuzzle(
  state: GameState,
  action: Extract<PlayerAction, { type: "puzzle_attempt" }>
): EngineResult {
  const s = structuredClone(state);
  const character = s.party.members[action.characterIndex];

  // 활로개척 체크
  const pathAction = character.actions.find((a) => a.name === "활로개척");
  if (pathAction && pathAction.remaining > 0) {
    // 활로개척 가능하지만 여기서는 일반 판정
  }

  const effectiveUseInspiration =
    action.useInspiration && s.party.inspiration > 0;

  if (effectiveUseInspiration) {
    s.party.inspiration = Math.max(0, s.party.inspiration - 1) as 0 | 1 | 2 | 3;
  }

  const diceResult = performDiceCheck(
    character,
    action.stat,
    effectiveUseInspiration,
    s.mode,
    action.isUnorthodox
  );

  let summary = "";
  const room = getRoomAt(s, s.party.position.col, s.party.position.row);

  // 보물의 방 처리
  if (room?.type === "treasure") {
    if (
      diceResult.judgment === "success" ||
      diceResult.judgment === "critical_success"
    ) {
      const equip = getRandomEquip("rare");
      const consumable = getRandomConsumable("rare");
      s.party.inventory.push(consumable);
      summary = `🎁 보물 발견! 희귀 장비 '${equip.name}' + '${consumable.name}' 획득.`;
      // 장비는 즉시 장착 선택지를 줘야 하지만 간소화를 위해 가장 적합한 캐릭터에게 장착
      autoEquip(s, equip);
    } else {
      const equip = getRandomEquip("common");
      const consumable = getRandomConsumable("common");
      s.party.inventory.push(consumable);
      summary = `🎁 보물 발견. 일반 장비 '${equip.name}' + '${consumable.name}' 획득.`;
      autoEquip(s, equip);
    }
  } else {
    // 수수께끼의 방 처리
    switch (diceResult.judgment) {
      case "critical_success": {
        const equip = getRandomEquip("rare");
        autoEquip(s, equip);
        summary = `대성공! 희귀 장비 '${equip.name}' 획득. 난관 돌파.`;
        break;
      }
      case "success": {
        const equip = getRandomEquip("common");
        autoEquip(s, equip);
        summary = `성공! 일반 장비 '${equip.name}' 획득. 난관 돌파.`;
        break;
      }
      case "failure":
      case "critical_failure":
        for (const m of s.party.members) {
          if (m.hp > 0) m.hp = Math.max(0, m.hp - 1);
        }
        summary = "실패... 전원 HP -1. 재도전 가능.";
        break;
    }
  }

  if (action.isUnorthodox && diceResult.judgment === "success") {
    const actingChar = s.party.members[action.characterIndex];
    for (const act of actingChar.actions) {
      act.remaining = Math.min(act.max, act.remaining + 1);
    }
    summary += ` 비정석적 성공! ${actingChar.name}의 특수액션 1회 회복.`;
  }

  s.phase = "exploration";
  return {
    newState: s,
    diceResult,
    eventSummary: summary,
    nextActions: getAvailableDirections(s),
  };
}

function processTrap(
  state: GameState,
  action: Extract<PlayerAction, { type: "trap_attempt" }>
): EngineResult {
  const s = structuredClone(state);
  const character = s.party.members[action.characterIndex];

  const effectiveUseInspiration =
    action.useInspiration && s.party.inspiration > 0;

  if (effectiveUseInspiration) {
    s.party.inspiration = Math.max(0, s.party.inspiration - 1) as 0 | 1 | 2 | 3;
  }

  const diceResult = performDiceCheck(
    character,
    action.stat,
    effectiveUseInspiration,
    s.mode,
    false
  );

  let summary = "";
  switch (diceResult.judgment) {
    case "critical_success":
      summary = "대성공! 무손실로 함정 돌파.";
      for (const m of s.party.members) {
        for (const act of m.actions) {
          act.remaining = Math.min(act.max, act.remaining + 1);
        }
      }
      summary += " 전원 특수액션 1회 회복.";
      break;
    case "success":
      summary = "성공! 무손실로 함정 돌파.";
      break;
    case "failure":
    case "critical_failure":
      for (const m of s.party.members) {
        if (m.hp > 0) m.hp = Math.max(0, m.hp - 1);
      }
      summary = "실패. 전원 HP -1. 함정은 돌파했다.";
      break;
  }

  s.phase = "exploration";
  return {
    newState: s,
    diceResult,
    eventSummary: summary,
    nextActions: getAvailableDirections(s),
  };
}

function processNpc(state: GameState): EngineResult {
  const s = structuredClone(state);
  s.npcUsed = true;

  const diceResult = performDiceCheck(s.party.members[0], "int", false, s.mode, false);
  let summary = "🧙‍♂️ 린린이 응원을 보낸다! ";

  switch (diceResult.judgment) {
    case "critical_success": {
      const equip = getRandomEquip("rare");
      autoEquip(s, equip);
      summary += `대성공! 희귀 장비 '${equip.name}' 선물.`;
      break;
    }
    case "success": {
      const equip = getRandomEquip("common");
      autoEquip(s, equip);
      summary += `성공! 일반 장비 '${equip.name}' 선물.`;
      break;
    }
    case "failure":
    case "critical_failure":
      s.party.inventory.push(healPotion());
      summary += "회복물약을 받았다.";
      break;
  }

  summary += " 린린이 떠났다.";
  s.phase = "exploration";
  return {
    newState: s,
    diceResult,
    eventSummary: summary,
    nextActions: getAvailableDirections(s),
  };
}

function processPathfinding(state: GameState): EngineResult {
  const s = structuredClone(state);
  const pina = s.party.members[1];
  const action = pina.actions.find((a) => a.name === "패스파인딩");
  if (!action || action.remaining <= 0) {
    return {
      newState: s,
      eventSummary: "패스파인딩 사용 불가.",
      nextActions: getAvailableDirections(s),
    };
  }
  action.remaining--;

  const dungeon = s.dungeons[s.party.floor - 1];
  let bossPos = "";
  for (const [key, room] of Object.entries(dungeon)) {
    if (room.type === "boss") {
      bossPos = key;
      break;
    }
  }
  const [bossCol, bossRow] = bossPos.split(",");
  return {
    newState: s,
    eventSummary: `패스파인딩! 피나가 보스룸 방향을 감지했다: ${bossCol}${bossRow} 방향.`,
    nextActions: getAvailableDirections(s),
  };
}

function processAlchemy(state: GameState): EngineResult {
  const s = structuredClone(state);
  const mina = s.party.members[2];
  const action = mina.actions.find((a) => a.name === "연금생성");
  if (!action || action.remaining <= 0) {
    return {
      newState: s,
      eventSummary: "연금생성 사용 불가.",
      nextActions: getAvailableDirections(s),
    };
  }
  action.remaining--;

  const diceResult = performDiceCheck(mina, "int", false, s.mode, false);
  let item: ConsumableItem;
  let summary = "연금생성! ";

  switch (diceResult.judgment) {
    case "critical_success":
      item = elixir();
      summary += `대성공! 엘릭서 생성.`;
      break;
    case "success":
      item = superiorHealPotion();
      summary += `성공! 상급 회복물약 생성.`;
      break;
    default:
      item = healPotion();
      summary += `회복물약 생성.`;
      break;
  }

  s.party.inventory.push(item);
  return {
    newState: s,
    diceResult,
    eventSummary: summary,
    nextActions: getAvailableDirections(s),
  };
}

function autoEquip(
  state: GameState,
  equip: import("../types").EquipItem
): void {
  // 가장 적합한 캐릭터에게 자동 장착
  let bestIdx = 0;
  let bestStat = -1;
  for (let i = 0; i < state.party.members.length; i++) {
    const m = state.party.members[i];
    const val = m.baseStats[equip.stat];
    const currentItem = m.equip[equip.slot];
    const currentBonus = currentItem?.bonus ?? 0;
    if (val > bestStat || (val === bestStat && currentBonus < equip.bonus)) {
      bestStat = val;
      bestIdx = i;
    }
  }
  state.party.members[bestIdx].equip[equip.slot] = equip;
}

function getPostCombatActions(state: GameState): PlayerAction[] {
  if (state.phase === "game_over") return [];
  if (state.phase === "victory") return [];

  // 보스 격파 시 다음 층 이동 처리
  if (state.combat.monster && state.combat.monster.difficulty === "boss" && state.combat.monster.hp <= 0) {
    if (state.party.floor === 3) {
      state.phase = "victory";
      return [];
    }
    // 다음 층으로 이동
    const nextFloor = (state.party.floor + 1) as 1 | 2 | 3;
    state.party.floor = nextFloor;
    state.party.position = { ...floorEntrance[nextFloor] };
    // 전원 HP 완전 회복 + 특수액션 1회 회복
    for (const m of state.party.members) {
      m.hp = m.maxHp;
      for (const a of m.actions) {
        a.remaining = Math.min(a.max, a.remaining + 1);
      }
    }
  }

  return getAvailableDirections(state);
}

function getAvailableExplorationSkills(state: GameState): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const pina = state.party.members[1];
  const mina = state.party.members[2];

  if (
    pina?.hp > 0 &&
    pina.actions.some((action) => action.name === "패스파인딩" && action.remaining > 0)
  ) {
    actions.push({ type: "pathfinding" });
  }

  if (
    mina?.hp > 0 &&
    mina.actions.some((action) => action.name === "연금생성" && action.remaining > 0)
  ) {
    actions.push({ type: "alchemy" });
  }

  return actions;
}

function getCurrentNonCombatActions(state: GameState): PlayerAction[] {
  const room = getRoomAt(state, state.party.position.col, state.party.position.row);

  if (state.phase === "event") {
    if (room?.type === "puzzle") {
      return buildPuzzleActions(state);
    }

    if (room?.type === "trap") {
      return buildTrapActions(state);
    }

    if (room?.type === "npc") {
      return [{ type: "npc_interact" }];
    }

    if (room?.type === "treasure") {
      return [
        {
          type: "puzzle_attempt",
          characterIndex: 0,
          stat: "str",
          useInspiration: false,
          isUnorthodox: false,
        },
      ];
    }
  }

  return getAvailableDirections(state);
}

export function getTalkBiasedActions(state: GameState): PlayerAction[] {
  if (state.combat.active || state.phase === "combat") {
    return getCombatActions(state);
  }

  if (state.phase === "game_over" || state.phase === "victory") {
    return [];
  }

  const skills = getAvailableExplorationSkills(state);
  const baseActions = getCurrentNonCombatActions(state);
  return [
    ...skills,
    ...baseActions.filter(
      (action) => !skills.some((skill) => skill.type === action.type)
    ),
  ];
}

function buildPuzzleActions(state: GameState): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const stats: ("str" | "dex" | "int")[] = ["str", "dex", "int"];

  for (let i = 0; i < state.party.members.length; i++) {
    if (state.party.members[i].hp <= 0) continue;
    for (const stat of stats) {
      actions.push({
        type: "puzzle_attempt",
        characterIndex: i,
        stat,
        useInspiration: false,
        isUnorthodox: false,
      });
    }
    // 활로개척 체크
    const char = state.party.members[i];
    const pathAction = char.actions.find(
      (a) => a.name === "활로개척" && a.remaining > 0
    );
    if (pathAction) {
      actions.push({
        type: "puzzle_attempt",
        characterIndex: i,
        stat: "str",
        useInspiration: false,
        isUnorthodox: false,
      });
    }
  }

  return actions;
}

function buildTrapActions(state: GameState): PlayerAction[] {
  const actions: PlayerAction[] = [];
  const stats: ("str" | "dex" | "int")[] = ["str", "dex", "int"];

  for (let i = 0; i < state.party.members.length; i++) {
    if (state.party.members[i].hp <= 0) continue;
    for (const stat of stats) {
      actions.push({
        type: "trap_attempt",
        characterIndex: i,
        stat,
        useInspiration: false,
      });
    }
  }

  return actions;
}

export { getAvailableDirections } from "./movement";
export { getCombatActions } from "./combat";
