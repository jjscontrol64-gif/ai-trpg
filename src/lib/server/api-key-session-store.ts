import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AIProviderId } from "@/lib/ai";

export type ApiKeySessionData = {
  apiKey: string;
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
  expiresAt: number;
  rememberApiKey: boolean;
};

export interface ApiKeySessionStore {
  get(sessionId: string): Promise<ApiKeySessionData | null>;
  set(sessionId: string, data: ApiKeySessionData): Promise<void>;
  delete(sessionId: string): Promise<void>;
  pruneExpired(now?: number): Promise<void>;
}

type EncryptedApiKey = {
  iv: string;
  tag: string;
  ciphertext: string;
};

type StoredApiKeySession = Omit<ApiKeySessionData, "apiKey"> & {
  encryptedApiKey: EncryptedApiKey;
};

type SessionFile = {
  version: 1;
  sessions: Record<string, StoredApiKeySession>;
};

const DEFAULT_SESSION_FILE = join(
  process.cwd(),
  "private",
  "api-key-sessions.json"
);
const FALLBACK_DEVELOPMENT_SECRET =
  "ai-trpg-local-development-secret-change-before-production";

export class EncryptedFileApiKeySessionStore implements ApiKeySessionStore {
  private readonly filePath: string;
  private readonly key: Buffer;

  constructor(options?: { filePath?: string; secret?: string }) {
    this.filePath = options?.filePath ?? DEFAULT_SESSION_FILE;
    this.key = deriveKey(options?.secret ?? getEncryptionSecret());
  }

  async get(sessionId: string): Promise<ApiKeySessionData | null> {
    const file = await this.readSessionFile();
    const stored = file.sessions[sessionId];

    if (!stored) {
      return null;
    }

    if (stored.expiresAt <= Date.now()) {
      delete file.sessions[sessionId];
      await this.writeSessionFile(file);
      return null;
    }

    return {
      apiKey: decryptApiKey(stored.encryptedApiKey, this.key),
      modelPresetId: stored.modelPresetId,
      provider: stored.provider,
      model: stored.model,
      expiresAt: stored.expiresAt,
      rememberApiKey: stored.rememberApiKey,
    };
  }

  async set(sessionId: string, data: ApiKeySessionData): Promise<void> {
    const file = await this.readSessionFile();

    file.sessions[sessionId] = {
      encryptedApiKey: encryptApiKey(data.apiKey, this.key),
      modelPresetId: data.modelPresetId,
      provider: data.provider,
      model: data.model,
      expiresAt: data.expiresAt,
      rememberApiKey: data.rememberApiKey,
    };

    await this.writeSessionFile(file);
  }

  async delete(sessionId: string): Promise<void> {
    const file = await this.readSessionFile();
    delete file.sessions[sessionId];
    await this.writeSessionFile(file);
  }

  async pruneExpired(now = Date.now()): Promise<void> {
    const file = await this.readSessionFile();
    let changed = false;

    for (const [sessionId, session] of Object.entries(file.sessions)) {
      if (session.expiresAt <= now) {
        delete file.sessions[sessionId];
        changed = true;
      }
    }

    if (changed) {
      await this.writeSessionFile(file);
    }
  }

  private async readSessionFile(): Promise<SessionFile> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SessionFile>;

      if (parsed.version === 1 && parsed.sessions && typeof parsed.sessions === "object") {
        return parsed as SessionFile;
      }
    } catch {
      // Missing or invalid files are treated as an empty store.
    }

    return { version: 1, sessions: {} };
  }

  private async writeSessionFile(file: SessionFile): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(file, null, 2), "utf8");
  }
}

export function createApiKeySessionStore(): ApiKeySessionStore {
  return new EncryptedFileApiKeySessionStore();
}

function getEncryptionSecret(): string {
  return (
    process.env.AI_TRPG_API_KEY_ENCRYPTION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    FALLBACK_DEVELOPMENT_SECRET
  );
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

function encryptApiKey(apiKey: string, key: Buffer): EncryptedApiKey {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function decryptApiKey(encrypted: EncryptedApiKey, key: Buffer): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "base64")
  );

  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
