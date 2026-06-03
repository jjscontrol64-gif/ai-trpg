import { EngineResult, GameState, PlayerAction } from "./types";
import { canUseBagItem, getBagItemTargetIndex } from "./item-usage";
import { itemEffectsById } from "./registry/game-registry";

export type UseItemCommand = {
  itemId: string;
  targetIndex?: number;
  inventoryIndex?: number;
};

export type UseItemContext = {
  getNextActions: (state: GameState) => PlayerAction[];
};

export function useItem(
  state: GameState,
  command: UseItemCommand,
  context: UseItemContext
): EngineResult {
  const s = structuredClone(state);
  const unavailableResult = (eventSummary: string): EngineResult => ({
    newState: s,
    eventSummary,
    nextActions: context.getNextActions(s),
  });
  const indexedItem =
    command.inventoryIndex === undefined
      ? undefined
      : s.party.inventory[command.inventoryIndex];
  const itemIdx =
    indexedItem && indexedItem.id === command.itemId
      ? command.inventoryIndex!
      : s.party.inventory.findIndex((i) => i.id === command.itemId);
  if (itemIdx < 0) {
    return unavailableResult("아이템을 찾을 수 없다.");
  }

  const item = s.party.inventory[itemIdx];
  if (!canUseBagItem(item, s.party.members)) {
    return unavailableResult("아이템을 사용할 수 없다.");
  }

  const restoresHp = Boolean(item.hpRestore || item.effectId === "restore_hp");
  const restoresAction = Boolean(
    item.actionRestore || item.effectId === "restore_action"
  );
  let resolvedTargetIndex =
    command.targetIndex ?? getBagItemTargetIndex(item, s.party.members);

  if (command.targetIndex !== undefined) {
    const member = s.party.members[command.targetIndex];
    const hasActionDeficit = member?.actions.some(
      (action) => action.remaining < action.max
    );

    if (
      !member ||
      member.hp <= 0 ||
      (restoresHp && member.hp >= member.maxHp) ||
      (restoresAction && !hasActionDeficit)
    ) {
      return unavailableResult("아이템 대상이 올바르지 않다.");
    }

    resolvedTargetIndex = command.targetIndex;
  }

  if ((restoresHp || restoresAction) && resolvedTargetIndex === undefined) {
    return unavailableResult("아이템 대상이 올바르지 않다.");
  }

  if (item.effectId && !itemEffectsById[item.effectId]) {
    return unavailableResult(`Item effect not found: ${item.effectId}`);
  }

  s.party.inventory.splice(itemIdx, 1);

  if (item.effectId) {
    const effect = itemEffectsById[item.effectId];
    if (!effect) {
      return {
        newState: s,
        eventSummary: `Item effect not found: ${item.effectId}`,
        nextActions: context.getNextActions(s),
      };
    }

    const result = effect.apply({
      state: s,
      item,
      targetIndex: resolvedTargetIndex,
      getNextActions: context.getNextActions,
    });
    return {
      newState: result.state,
      eventSummary: result.eventSummary,
      nextActions: result.nextActions,
    };
  }

  let summary = "";

  if (item.hpRestore) {
    const target = resolvedTargetIndex ?? 0;
    const member = s.party.members[target];
    member.hp = Math.min(member.maxHp, member.hp + item.hpRestore);
    summary = `${member.name}가(이) ${item.name} 사용. HP +${item.hpRestore} 회복.`;
  } else if (item.allHpRestore) {
    for (const m of s.party.members) {
      if (m.hp > 0) m.hp = Math.min(m.maxHp, m.hp + item.allHpRestore);
    }
    summary = `${item.name} 사용. 전원 HP +${item.allHpRestore} 회복.`;
  } else if (item.actionRestore) {
    const target = resolvedTargetIndex ?? 0;
    const member = s.party.members[target];
    for (const action of member.actions) {
      action.remaining = Math.min(action.max, action.remaining + item.actionRestore);
    }
    summary = `${member.name}가(이) ${item.name} 사용. 특수액션 +${item.actionRestore} 회복.`;
  }

  return {
    newState: s,
    eventSummary: summary,
    nextActions: context.getNextActions(s),
  };
}
