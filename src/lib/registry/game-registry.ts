import { ConsumableItem, EquipItem, EquipSlot, ItemRarity } from "../types";
import {
  bossDefinitions,
  consumableDefinitions,
  equipDefinitions,
  itemEffectDefinitions,
  monsterDefinitions,
  roomDefinitions,
} from "./generated";
import { createItemInstanceId } from "../item-id";

function nextId(): string {
  return createItemInstanceId();
}

export const roomTypeEmoji = Object.fromEntries(
  roomDefinitions.map((room) => [room.type, room.emoji])
) as Record<string, string>;

export const monstersByDifficulty = monsterDefinitions.reduce(
  (acc, monster) => {
    acc[monster.difficulty].push(monster);
    return acc;
  },
  { 1: [], 2: [], 3: [] } as Record<1 | 2 | 3, typeof monsterDefinitions>
);

export const bossesByFloor = Object.fromEntries(
  bossDefinitions.map((boss) => [boss.floor, boss])
) as Record<1 | 2 | 3, (typeof bossDefinitions)[number]>;

export const itemEffectsById = Object.fromEntries(
  itemEffectDefinitions.map((effect) => [effect.id, effect])
);

export function createEquipFromDefinition(
  definition: (typeof equipDefinitions)[number]
): EquipItem {
  return {
    id: nextId(),
    name: definition.name,
    rarity: definition.rarity,
    slot: definition.slot,
    stat: definition.stat,
    bonus: definition.bonus,
  };
}

export function createConsumableFromDefinition(
  definition: (typeof consumableDefinitions)[number]
): ConsumableItem {
  return {
    id: nextId(),
    name: definition.name,
    rarity: definition.rarity,
    effectId: definition.effectId,
    effectValue: definition.effectValue,
    hpRestore: definition.hpRestore,
    allHpRestore: definition.allHpRestore,
    actionRestore: definition.actionRestore,
  };
}

export function getRandomEquipDefinition(
  rarity: ItemRarity,
  slot?: EquipSlot
): (typeof equipDefinitions)[number] {
  const pool = equipDefinitions.filter(
    (item) => item.rarity === rarity && (!slot || item.slot === slot)
  );
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getRandomConsumableDefinition(
  rarity: ItemRarity
): (typeof consumableDefinitions)[number] {
  const pool = consumableDefinitions.filter((item) => item.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
