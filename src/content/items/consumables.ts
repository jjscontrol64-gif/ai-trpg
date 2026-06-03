import { ConsumableDefinition } from "@/lib/registry/types";

export const consumables = [
  {
    id: "heal-potion",
    name: "회복물약",
    rarity: "common",
    effectId: "restore_hp",
    effectValue: 3,
    hpRestore: 3,
  },
  {
    id: "superior-heal-potion",
    name: "상급 회복물약",
    rarity: "rare",
    effectId: "restore_hp",
    effectValue: 5,
    hpRestore: 5,
  },
  {
    id: "mana-potion",
    name: "마나물약",
    rarity: "rare",
    effectId: "restore_action",
    effectValue: 1,
    actionRestore: 1,
  },
  {
    id: "elixir",
    name: "엘릭서",
    rarity: "legendary",
    effectId: "restore_hp",
    effectValue: 10,
    hpRestore: 10,
  },
  {
    id: "saint-tear",
    name: "성녀의 눈물",
    rarity: "legendary",
    effectId: "restore_all_hp",
    effectValue: 5,
    allHpRestore: 5,
  },
] satisfies ConsumableDefinition[];
