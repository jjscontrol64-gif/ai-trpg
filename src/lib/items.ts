import { EquipItem, ConsumableItem, EquipSlot, StatType, ItemRarity, Equipment } from "./types";

let itemCounter = 0;
function nextId(): string {
  return `item_${++itemCounter}`;
}

export function createEquip(
  name: string,
  rarity: ItemRarity,
  slot: EquipSlot,
  stat: StatType,
  bonus: number
): EquipItem {
  return { id: nextId(), name, rarity, slot, stat, bonus };
}

export function createConsumable(
  name: string,
  rarity: ItemRarity,
  opts: Partial<ConsumableItem>
): ConsumableItem {
  return { id: nextId(), name, rarity, ...opts };
}

// 일반 장비 (📦, +1)
export const commonEquipTable: Record<EquipSlot, Record<StatType, () => EquipItem>> = {
  head: {
    str: () => createEquip("철제 투구", "common", "head", "str", 1),
    dex: () => createEquip("도적의 복면", "common", "head", "dex", 1),
    int: () => createEquip("현자의 서클릿", "common", "head", "int", 1),
  },
  weapon: {
    str: () => createEquip("강철 대검", "common", "weapon", "str", 1),
    dex: () => createEquip("예리한 단검", "common", "weapon", "dex", 1),
    int: () => createEquip("참나무 지팡이", "common", "weapon", "int", 1),
  },
  body: {
    str: () => createEquip("사슬 갑옷", "common", "body", "str", 1),
    dex: () => createEquip("가죽 슈트", "common", "body", "dex", 1),
    int: () => createEquip("마법사 로브", "common", "body", "int", 1),
  },
};

// 희귀 장비 (🎁, +2)
export const rareEquipTable: Record<EquipSlot, Record<StatType, () => EquipItem>> = {
  head: {
    str: () => createEquip("미노타우르스의 뿔", "rare", "head", "str", 2),
    dex: () => createEquip("바람의 머리띠", "rare", "head", "dex", 2),
    int: () => createEquip("고대 예언자의 관", "rare", "head", "int", 2),
  },
  weapon: {
    str: () => createEquip("미스릴 해머", "rare", "weapon", "str", 2),
    dex: () => createEquip("암살자의 쌍검", "rare", "weapon", "dex", 2),
    int: () => createEquip("수정 보주", "rare", "weapon", "int", 2),
  },
  body: {
    str: () => createEquip("판금 갑옷", "rare", "body", "str", 2),
    dex: () => createEquip("고양이 발걸음 예복", "rare", "body", "dex", 2),
    int: () => createEquip("별빛의 가운", "rare", "body", "int", 2),
  },
};

// 전설 장비 (🐦‍🔥, +3)
export const legendaryEquipTable: Record<EquipSlot, Record<StatType, () => EquipItem>> = {
  head: {
    str: () => createEquip("티탄의 왕관", "legendary", "head", "str", 3),
    dex: () => createEquip("심연의 그림자 두건", "legendary", "head", "dex", 3),
    int: () => createEquip("리치의 영혼 왕관", "legendary", "head", "int", 3),
  },
  weapon: {
    str: () => createEquip("드래곤 슬레이어", "legendary", "weapon", "str", 3),
    dex: () => createEquip("신속의 칼날 '엑스큐션'", "legendary", "weapon", "dex", 3),
    int: () => createEquip("신의 지혜 '아카샤'", "legendary", "weapon", "int", 3),
  },
  body: {
    str: () => createEquip("아다만티움 흉갑", "legendary", "body", "str", 3),
    dex: () => createEquip("신기루의 외투", "legendary", "body", "dex", 3),
    int: () => createEquip("대마법사의 성의", "legendary", "body", "int", 3),
  },
};

export const equipTableByRarity = {
  common: commonEquipTable,
  rare: rareEquipTable,
  legendary: legendaryEquipTable,
};

// 소모품
export function healPotion(): ConsumableItem {
  return createConsumable("회복물약", "common", { hpRestore: 3 });
}

export function smokeBomb(): ConsumableItem {
  return createConsumable("연막탄", "common", { autoFlee: true });
}

export function superiorHealPotion(): ConsumableItem {
  return createConsumable("상급 회복물약", "rare", { hpRestore: 5 });
}

export function manaPotion(): ConsumableItem {
  return createConsumable("마나물약", "rare", { actionRestore: 1 });
}

export function elixir(): ConsumableItem {
  return createConsumable("엘릭서", "legendary", { hpRestore: 10 });
}

export function saintTear(): ConsumableItem {
  return createConsumable("성녀의 눈물", "legendary", { allHpRestore: 5 });
}

export function getRandomEquip(rarity: ItemRarity, slot?: EquipSlot): EquipItem {
  const table = equipTableByRarity[rarity];
  const slots: EquipSlot[] = slot ? [slot] : ["head", "body", "weapon"];
  const chosenSlot = slots[Math.floor(Math.random() * slots.length)];
  const stats: StatType[] = ["str", "dex", "int"];
  const chosenStat = stats[Math.floor(Math.random() * stats.length)];
  return table[chosenSlot][chosenStat]();
}

export function getRandomConsumable(rarity: ItemRarity): ConsumableItem {
  if (rarity === "common") {
    return Math.random() < 0.5 ? healPotion() : smokeBomb();
  }
  if (rarity === "rare") {
    return Math.random() < 0.5 ? superiorHealPotion() : manaPotion();
  }
  return Math.random() < 0.5 ? elixir() : saintTear();
}

// 초기 장비 (보너스 없음)
export function starterWarriorEquip(): Equipment {
  return {
    head: null,
    body: createEquip("낡은 철갑옷", "common", "body", "str", 0),
    weapon: createEquip("낡은 철검", "common", "weapon", "str", 0),
  };
}

export function starterRogueEquip(): Equipment {
  return {
    head: null,
    body: createEquip("낡은 천갑옷", "common", "body", "dex", 0),
    weapon: createEquip("낡은 대거", "common", "weapon", "dex", 0),
  };
}

export function starterMageEquip(): Equipment {
  return {
    head: null,
    body: createEquip("낡은 로브", "common", "body", "int", 0),
    weapon: createEquip("낡은 스태프", "common", "weapon", "int", 0),
  };
}
