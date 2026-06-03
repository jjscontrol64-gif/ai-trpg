import { Character, ConsumableItem } from "./types";

type PartyMembers = readonly Character[];

function isHpRestoreItem(item: ConsumableItem): boolean {
  return Boolean(item.hpRestore || item.effectId === "restore_hp");
}

function isAllHpRestoreItem(item: ConsumableItem): boolean {
  return Boolean(item.allHpRestore || item.effectId === "restore_all_hp");
}

function isActionRestoreItem(item: ConsumableItem): boolean {
  return Boolean(item.actionRestore || item.effectId === "restore_action");
}

export function isBagUsable(item: ConsumableItem): boolean {
  return Boolean(
    item.effectId ||
      item.hpRestore ||
      item.allHpRestore ||
      item.actionRestore
  );
}

export function describeBagItem(item: ConsumableItem): string {
  const hpAmount = item.effectValue ?? item.hpRestore;
  const allHpAmount = item.effectValue ?? item.allHpRestore;
  const actionAmount = item.effectValue ?? item.actionRestore;

  if (isAllHpRestoreItem(item) && allHpAmount) return `전체 HP +${allHpAmount}`;
  if (isHpRestoreItem(item) && hpAmount) return `HP +${hpAmount}`;
  if (isActionRestoreItem(item) && actionAmount) return `특수액션 +${actionAmount}`;

  return "사용 가능";
}

export function getBagItemTargetIndex(
  item: ConsumableItem,
  members: PartyMembers
): number | undefined {
  if (isAllHpRestoreItem(item)) return undefined;

  if (isHpRestoreItem(item)) {
    let targetIndex: number | undefined;
    let lowestHpRatio = Number.POSITIVE_INFINITY;

    members.forEach((member, index) => {
      if (member.hp <= 0 || member.hp >= member.maxHp) return;

      const hpRatio = member.maxHp > 0 ? member.hp / member.maxHp : 1;
      if (hpRatio < lowestHpRatio) {
        lowestHpRatio = hpRatio;
        targetIndex = index;
      }
    });

    return targetIndex;
  }

  if (isActionRestoreItem(item)) {
    let targetIndex: number | undefined;
    let largestDeficit = 0;

    members.forEach((member, index) => {
      if (member.hp <= 0) return;

      const deficit = member.actions.reduce(
        (sum, action) => sum + Math.max(0, action.max - action.remaining),
        0
      );
      if (deficit > largestDeficit) {
        largestDeficit = deficit;
        targetIndex = index;
      }
    });

    return targetIndex;
  }

  return undefined;
}

export function canUseBagItem(
  item: ConsumableItem,
  members: PartyMembers
): boolean {
  if (!isBagUsable(item)) return false;

  if (isAllHpRestoreItem(item)) {
    return members.some((member) => member.hp > 0 && member.hp < member.maxHp);
  }

  if (isHpRestoreItem(item) || isActionRestoreItem(item)) {
    return getBagItemTargetIndex(item, members) !== undefined;
  }

  return true;
}
