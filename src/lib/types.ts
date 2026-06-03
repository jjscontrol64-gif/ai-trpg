export type DifficultyMode = "easy" | "normal" | "hard";
export type ItemRarity = "common" | "rare" | "legendary";
export type EquipSlot = "head" | "body" | "weapon";
export type JudgmentResult =
  | "critical_success"
  | "success"
  | "failure"
  | "critical_failure";
export type RoomType =
  | "monster"
  | "puzzle"
  | "treasure"
  | "trap"
  | "safe"
  | "wall"
  | "npc"
  | "boss"
  | "empty"
  | "entrance";
export type Floor = 1 | 2 | 3;
export type StatType = "str" | "dex" | "int";
export type AffinityLevel = 0 | 1 | 2 | 3;

export interface Affinity {
  pina: AffinityLevel;
  mina: AffinityLevel;
}

export interface EquipItem {
  id: string;
  name: string;
  rarity: ItemRarity;
  slot: EquipSlot;
  stat: StatType;
  bonus: number;
}

export interface ConsumableItem {
  id: string;
  name: string;
  rarity: ItemRarity;
  effectId?: string;
  effectValue?: number;
  hpRestore?: number;
  allHpRestore?: number;
  actionRestore?: number;
}

export interface SpecialAction {
  name: string;
  remaining: number;
  max: 3;
  type: "combat" | "exploration";
}

export interface Equipment {
  head: EquipItem | null;
  body: EquipItem | null;
  weapon: EquipItem | null;
}

export interface Character {
  name: string;
  role: "warrior" | "rogue" | "mage";
  hp: number;
  maxHp: number;
  baseStats: { str: number; dex: number; int: number };
  equip: Equipment;
  actions: SpecialAction[];
}

export interface MonsterState {
  name: string;
  hp: number;
  maxHp: number;
  difficulty: 1 | 2 | 3 | "boss";
  damage: number;
  statusEffect?: { type: "bind" | "stun"; remaining: number };
}

export interface BossCounters {
  curseTurn: number;
  breathTurn: number;
  breathCharging: boolean;
}

export interface CombatState {
  active: boolean;
  monster: MonsterState | null;
  bossCounters: BossCounters;
  turnCount: number;
  disarmed?: { characterIndex: number; turnsRemaining: number };
}

export interface Party {
  members: [Character, Character, Character];
  inventory: ConsumableItem[];
  floor: Floor;
  position: { col: string; row: number };
  inspiration: number;
  affinity: Affinity;
}

export interface RoomData {
  type: RoomType;
  monsterDifficulty?: 1 | 2 | 3;
  visited: boolean;
}

export type DungeonMap = Record<string, RoomData>;

export interface GameState {
  party: Party;
  combat: CombatState;
  mode: DifficultyMode;
  phase: "start" | "exploration" | "combat" | "event" | "game_over" | "victory";
  dungeons: [DungeonMap, DungeonMap, DungeonMap];
  npcUsed: boolean;
  messageHistory: ChatMessage[];
}

export interface DiceRollResult {
  raw: number;
  stat: number;
  inspirationBonus: number;
  total: number;
  judgment: JudgmentResult;
  mode: DifficultyMode;
  isUnorthodox: boolean;
}

export type StoryBeat =
  | {
      id: string;
      role: "assistant";
      narration: string;
      eventSummary: string;
      diceResult?: DiceRollResult;
    }
  | {
      id: string;
      role: "user";
      text: string;
    };

export interface ChoiceOption {
  label: string;
  text: string;
  action: PlayerAction;
}

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface StatusWindowData {
  warrior: CharacterStatusDisplay;
  pina: CharacterStatusDisplay;
  mina: CharacterStatusDisplay;
  monster: MonsterStatusDisplay | null;
  party: PartyStatusDisplay;
}

export interface CharacterStatusDisplay {
  name: string;
  hp: string;
  str: string;
  dex: string;
  int: string;
  skill: string;
  equip: [string, string, string];
  affinity?: string;
}

export interface MonsterStatusDisplay {
  name: string;
  hp: string;
  maxHp: string;
  level: "Ⅰ" | "Ⅱ" | "Ⅲ" | "💀";
  statusEffect?: string;
}

export interface PartyStatusDisplay {
  inv: string;
  floor: "1️⃣" | "2️⃣" | "3️⃣";
  loc: string;
  star: string;
}

export type PlayerAction =
  | { type: "move"; direction: "north" | "south" | "east" | "west" }
  | { type: "attack"; characterIndex: number; useInspiration: boolean }
  | { type: "special_action"; characterIndex: number; actionName: string }
  | { type: "flee" }
  | {
      type: "use_item";
      itemId: string;
      targetIndex?: number;
      inventoryIndex?: number;
    }
  | { type: "rest" }
  | {
      type: "puzzle_attempt";
      characterIndex: number;
      stat: StatType;
      useInspiration: boolean;
      isUnorthodox: boolean;
      specialActionName?: "활로개척";
    }
  | {
      type: "trap_attempt";
      characterIndex: number;
      stat: StatType;
      useInspiration: boolean;
      specialActionName?: "활로개척";
    }
  | { type: "npc_interact" }
  | { type: "pathfinding" }
  | { type: "alchemy" }
  | { type: "affinity_talk"; target: keyof Affinity }
  | { type: "leave_safe_room" }
  | { type: "ending_choice"; choiceId: string };

export interface EngineResult {
  newState: GameState;
  diceResult?: DiceRollResult;
  eventSummary: string;
  nextActions: PlayerAction[];
}

export interface GameResponse {
  narration: string;
  eventSummary: string;
  diceResult?: DiceRollResult;
  choices: ChoiceOption[];
  gameState: GameState;
  statusWindow: StatusWindowData;
}
