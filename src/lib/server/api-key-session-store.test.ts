import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { EncryptedFileApiKeySessionStore } from "./api-key-session-store";

const tempDirs: string[] = [];

async function createTempStoreFile(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ai-trpg-session-store-"));
  tempDirs.push(dir);
  return join(dir, "sessions.json");
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe("EncryptedFileApiKeySessionStore", () => {
  it("stores API keys encrypted and reloads them from disk", async () => {
    const filePath = await createTempStoreFile();
    const secret = "test-secret-that-is-long-enough";
    const apiKey = "sk-test-sensitive-key";

    const writer = new EncryptedFileApiKeySessionStore({ filePath, secret });
    await writer.set("session-1", {
      apiKey,
      modelPresetId: "openai-gpt-4.1-mini",
      provider: "openai",
      model: "gpt-4.1-mini",
      expiresAt: Date.now() + 60_000,
      rememberApiKey: true,
    });

    const rawFile = await readFile(filePath, "utf8");
    expect(rawFile).not.toContain(apiKey);

    const reader = new EncryptedFileApiKeySessionStore({ filePath, secret });
    await expect(reader.get("session-1")).resolves.toMatchObject({
      apiKey,
      modelPresetId: "openai-gpt-4.1-mini",
      provider: "openai",
      model: "gpt-4.1-mini",
      rememberApiKey: true,
    });
  });

  it("removes expired sessions instead of returning decrypted API keys", async () => {
    const filePath = await createTempStoreFile();
    const store = new EncryptedFileApiKeySessionStore({
      filePath,
      secret: "test-secret-that-is-long-enough",
    });

    await store.set("expired-session", {
      apiKey: "sk-expired",
      modelPresetId: "openai-gpt-4.1-mini",
      provider: "openai",
      model: "gpt-4.1-mini",
      expiresAt: Date.now() - 1,
      rememberApiKey: false,
    });

    await expect(store.get("expired-session")).resolves.toBeNull();
    expect(await readFile(filePath, "utf8")).not.toContain("expired-session");
  });
});
