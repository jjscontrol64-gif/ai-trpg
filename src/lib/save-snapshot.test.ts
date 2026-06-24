import { describe, expect, it, vi } from "vitest";

import { createInitialState } from "./initial-state";
import { buildSaveSnapshot, persistSaveSnapshot } from "./save-snapshot";
import { SAVE_SCHEMA_VERSION, StorageProvider } from "./storage";

describe("save snapshot helpers", () => {
  it("builds a default save snapshot with the current game payload", () => {
    const gameState = createInitialState("Tester");
    const savedAt = "2026-06-23T12:00:00.000Z";

    const snapshot = buildSaveSnapshot({
      playerName: "Tester",
      modelPresetId: "gemini-test",
      gameState,
      beats: [{ id: "beat-1", role: "user", text: "Go north" }],
      currentChoices: [],
      savedAt,
    });

    expect(snapshot).toMatchObject({
      schemaVersion: SAVE_SCHEMA_VERSION,
      saveId: "default",
      playerName: "Tester",
      modelPresetId: "gemini-test",
      gameState,
      savedAt,
    });
    expect(snapshot.beats).toHaveLength(1);
  });

  it("persists a snapshot and returns the saved result", async () => {
    const snapshot = buildSaveSnapshot({
      playerName: "Tester",
      modelPresetId: "gemini-test",
      gameState: createInitialState("Tester"),
      beats: [],
      currentChoices: [],
      savedAt: "2026-06-23T12:00:00.000Z",
    });
    const provider: StorageProvider = {
      load: vi.fn(),
      save: vi.fn().mockResolvedValue(undefined),
    };

    const result = await persistSaveSnapshot(provider, snapshot);

    expect(provider.save).toHaveBeenCalledWith(snapshot);
    expect(result).toEqual({ status: "saved", snapshot });
  });

  it("reports save failures without throwing", async () => {
    const snapshot = buildSaveSnapshot({
      playerName: "Tester",
      modelPresetId: "gemini-test",
      gameState: createInitialState("Tester"),
      beats: [],
      currentChoices: [],
      savedAt: "2026-06-23T12:00:00.000Z",
    });
    const provider: StorageProvider = {
      load: vi.fn(),
      save: vi.fn().mockRejectedValue(new Error("quota exceeded")),
    };

    const result = await persistSaveSnapshot(provider, snapshot);

    expect(result).toEqual({ status: "error" });
  });
});
