import { ChoiceOption, GameState, StoryBeat } from "@/lib/types";

export const SAVE_SCHEMA_VERSION = 1;

export interface SaveSnapshot {
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  saveId: string;
  playerName: string;
  modelPresetId?: string;
  gameState: GameState;
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
  savedAt: string;
}

export interface StorageProvider {
  load(saveId?: string): Promise<SaveSnapshot | null>;
  save(snapshot: SaveSnapshot): Promise<void>;
}

export function isSaveSnapshot(value: unknown): value is SaveSnapshot {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SaveSnapshot>;
  return (
    candidate.schemaVersion === SAVE_SCHEMA_VERSION &&
    typeof candidate.saveId === "string" &&
    typeof candidate.playerName === "string" &&
    typeof candidate.savedAt === "string" &&
    Array.isArray(candidate.beats) &&
    Array.isArray(candidate.currentChoices) &&
    Boolean(candidate.gameState)
  );
}
