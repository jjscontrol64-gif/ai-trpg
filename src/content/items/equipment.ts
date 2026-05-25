import { EquipDefinition } from "@/lib/registry/types";

export const equipment = [
  { id: "iron-helm", name: "철제 투구", rarity: "common", slot: "head", stat: "str", bonus: 1 },
  { id: "thief-mask", name: "도적의 복면", rarity: "common", slot: "head", stat: "dex", bonus: 1 },
  { id: "wizard-circle", name: "마법사의 서클릿", rarity: "common", slot: "head", stat: "int", bonus: 1 },
  { id: "strong-sword", name: "강철 대검", rarity: "common", slot: "weapon", stat: "str", bonus: 1 },
  { id: "light-dagger", name: "날렵한 단검", rarity: "common", slot: "weapon", stat: "dex", bonus: 1 },
  { id: "oak-staff", name: "참나무 지팡이", rarity: "common", slot: "weapon", stat: "int", bonus: 1 },
  { id: "chain-armor", name: "사슬 갑옷", rarity: "common", slot: "body", stat: "str", bonus: 1 },
  { id: "leather-suit", name: "가죽 슈트", rarity: "common", slot: "body", stat: "dex", bonus: 1 },
  { id: "mage-robe", name: "마법의 로브", rarity: "common", slot: "body", stat: "int", bonus: 1 },

  { id: "minotaur-horn", name: "미노타우르스의 뿔", rarity: "rare", slot: "head", stat: "str", bonus: 2 },
  { id: "wind-hairpin", name: "바람의 머리핀", rarity: "rare", slot: "head", stat: "dex", bonus: 2 },
  { id: "oracle-crown", name: "고대 예언자의 관", rarity: "rare", slot: "head", stat: "int", bonus: 2 },
  { id: "mithril-axe", name: "미스릴 도끼", rarity: "rare", slot: "weapon", stat: "str", bonus: 2 },
  { id: "shadow-blade", name: "그림자의 칼날", rarity: "rare", slot: "weapon", stat: "dex", bonus: 2 },
  { id: "crystal-orb", name: "수정 보주", rarity: "rare", slot: "weapon", stat: "int", bonus: 2 },
  { id: "gold-armor", name: "황금 갑옷", rarity: "rare", slot: "body", stat: "str", bonus: 2 },
  { id: "catfoot-cloak", name: "고양이 발걸음 망토", rarity: "rare", slot: "body", stat: "dex", bonus: 2 },
  { id: "starry-cloak", name: "별빛의 가호", rarity: "rare", slot: "body", stat: "int", bonus: 2 },

  { id: "hero-crown", name: "영웅의 왕관", rarity: "legendary", slot: "head", stat: "str", bonus: 3 },
  { id: "forest-goggles", name: "자연의 눈", rarity: "legendary", slot: "head", stat: "dex", bonus: 3 },
  { id: "lich-diadem", name: "리치의 지혜", rarity: "legendary", slot: "head", stat: "int", bonus: 3 },
  { id: "dragon-slayer", name: "드래곤 슬레이어", rarity: "legendary", slot: "weapon", stat: "str", bonus: 3 },
  { id: "swift-blade", name: "신속의 칼날", rarity: "legendary", slot: "weapon", stat: "dex", bonus: 3 },
  { id: "god-wisdom", name: "신의 지팡이", rarity: "legendary", slot: "weapon", stat: "int", bonus: 3 },
  { id: "adamant-plate", name: "아다만트 갑옷", rarity: "legendary", slot: "body", stat: "str", bonus: 3 },
  { id: "silk-coat", name: "신기루의 외투", rarity: "legendary", slot: "body", stat: "dex", bonus: 3 },
  { id: "archmage-robe", name: "대마법사의 예복", rarity: "legendary", slot: "body", stat: "int", bonus: 3 },
] satisfies EquipDefinition[];
