import { ChoiceOption, GameState, StoryBeat } from "./types";
import { SAVE_SCHEMA_VERSION, SaveSnapshot, StorageProvider } from "./storage";

export const DEFAULT_SAVE_ID = "default";

export type SavePersistResult =
  | { status: "saved"; snapshot: SaveSnapshot }
  | { status: "error" };

export function buildSaveSnapshot({
  playerName,
  modelPresetId,
  gameState,
  beats,
  currentChoices,
  savedAt = new Date().toISOString(),
}: {
  playerName: string;
  modelPresetId: string;
  gameState: GameState;
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
  savedAt?: string;
}): SaveSnapshot {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    saveId: DEFAULT_SAVE_ID,
    playerName,
    modelPresetId,
    gameState,
    beats,
    currentChoices,
    savedAt,
  };
}

export async function persistSaveSnapshot(
  storageProvider: StorageProvider,
  snapshot: SaveSnapshot
): Promise<SavePersistResult> {
  try {
    await storageProvider.save(snapshot);
    return { status: "saved", snapshot };
  } catch {
    return { status: "error" };
  }
}
