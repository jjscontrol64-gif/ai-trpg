import {
  ConsumableItem,
  EquipItem,
  EquipSlot,
  GameState,
  ItemRarity,
  PlayerAction,
  RoomType,
  StatType,
} from "../types";

export type RoomDefinition = {
  type: string;
  emoji: string;
};

export type MonsterDefinition = {
  id: string;
  name: string;
  hp: number;
  difficulty: 1 | 2 | 3;
};

export type BossDefinition = {
  id: string;
  name: string;
  hp: number;
  damage: number;
  floor: 1 | 2 | 3;
};

export type EquipDefinition = {
  id: string;
  name: string;
  rarity: ItemRarity;
  slot: EquipSlot;
  stat: StatType;
  bonus: number;
};

export type ConsumableDefinition = {
  id: string;
  name: string;
  rarity: ItemRarity;
  effectId: string;
  effectValue?: number;
  hpRestore?: number;
  allHpRestore?: number;
  actionRestore?: number;
};

export type ItemEffectContext = {
  state: GameState;
  item: ConsumableItem;
  targetIndex?: number;
  getNextActions: (state: GameState) => PlayerAction[];
};

export type ItemEffectResult = {
  state: GameState;
  eventSummary: string;
  nextActions: PlayerAction[];
};

export type ItemEffectDefinition = {
  id: string;
  apply: (context: ItemEffectContext) => ItemEffectResult;
};

export type RoomHandlerContext = {
  col: string;
  row: number;
  room: { type: RoomType; monsterDifficulty?: 1 | 2 | 3; visited: boolean };
};

export type RegistryModule = {
  rooms?: RoomDefinition[];
  monsters?: MonsterDefinition[];
  bosses?: BossDefinition[];
  equipment?: EquipDefinition[];
  consumables?: ConsumableDefinition[];
  itemEffects?: ItemEffectDefinition[];
};

export type GeneratedRegistry = {
  roomDefinitions: RoomDefinition[];
  monsterDefinitions: MonsterDefinition[];
  bossDefinitions: BossDefinition[];
  equipDefinitions: EquipDefinition[];
  consumableDefinitions: ConsumableDefinition[];
  itemEffectDefinitions: ItemEffectDefinition[];
};
