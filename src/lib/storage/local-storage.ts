import { SAVE_SCHEMA_VERSION, SaveSnapshot, StorageProvider } from "./types";

const DEFAULT_SAVE_ID = "default";
const KEY_PREFIX = "ai-trpg:save:";
const MAX_STORED_BEATS = 50;

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function getSaveKey(saveId = DEFAULT_SAVE_ID): string {
  return `${KEY_PREFIX}${saveId}`;
}

function isSaveSnapshot(value: unknown): value is SaveSnapshot {
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

export class LocalStorageProvider implements StorageProvider {
  async load(saveId = DEFAULT_SAVE_ID): Promise<SaveSnapshot | null> {
    const storage = getStorage();
    if (!storage) return null;

    const raw = storage.getItem(getSaveKey(saveId));
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as unknown;
      return isSaveSnapshot(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async save(snapshot: SaveSnapshot): Promise<void> {
    const storage = getStorage();
    if (!storage) return;

    const trimmedSnapshot: SaveSnapshot = {
      ...snapshot,
      beats: snapshot.beats.slice(-MAX_STORED_BEATS),
    };

    storage.setItem(getSaveKey(snapshot.saveId), JSON.stringify(trimmedSnapshot));
  }
}
