import { ChoiceOption, GameState, StoryBeat } from "@/lib/types";

export const SAVE_SCHEMA_VERSION = 1;

export interface SaveSnapshot {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  saveId: string;
  playerName: string;
  gameState: GameState;
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
  savedAt: string;
}

export interface StorageProvider {
  load(saveId?: string): Promise<SaveSnapshot | null>;
  save(snapshot: SaveSnapshot): Promise<void>;
}
