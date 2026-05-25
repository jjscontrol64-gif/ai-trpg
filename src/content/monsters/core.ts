import { BossDefinition, MonsterDefinition } from "@/lib/registry/types";

export const monsters = [
  { id: "goblin", name: "고블린", hp: 3, difficulty: 1 },
  { id: "giant-spider", name: "거대거미", hp: 4, difficulty: 1 },
  { id: "slime", name: "슬라임", hp: 4, difficulty: 1 },
  { id: "skeleton", name: "스켈레톤", hp: 7, difficulty: 1 },
  { id: "ogre", name: "오거", hp: 11, difficulty: 2 },
  { id: "wyvern", name: "와이번", hp: 10, difficulty: 2 },
  { id: "gargoyle", name: "가고일", hp: 13, difficulty: 2 },
  { id: "ghoul", name: "구울", hp: 9, difficulty: 2 },
  { id: "minotaur", name: "미노타우르스", hp: 14, difficulty: 3 },
  { id: "troll", name: "트롤", hp: 20, difficulty: 3 },
  { id: "wight", name: "와이트", hp: 17, difficulty: 3 },
  { id: "golem", name: "골렘", hp: 22, difficulty: 3 },
  { id: "chimera", name: "키메라", hp: 16, difficulty: 3 },
] satisfies MonsterDefinition[];

export const bosses = [
  { id: "lich", name: "리치", hp: 25, damage: 1, floor: 1 },
  { id: "balrog", name: "발록", hp: 28, damage: 2, floor: 2 },
  { id: "end-dragon", name: "엔드드래곤", hp: 30, damage: 3, floor: 3 },
] satisfies BossDefinition[];
