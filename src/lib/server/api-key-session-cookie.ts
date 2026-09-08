import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { AIProviderId } from "@/lib/ai";

export type ApiKeySessionData = {
  apiKey: string;
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
  expiresAt: number;
  rememberApiKey: boolean;
};

/**
 * Serverless runtimes (Vercel) mount the deployment bundle read-only and give
 * each instance its own filesystem, so a shared session file is impossible.
 * The session therefore travels with the client as an authenticated, encrypted
 * token in an httpOnly cookie instead of a server-side lookup key.
 */
const TOKEN_VERSION = "v1";
const IV_BYTES = 12;
const FALLBACK_DEVELOPMENT_SECRET =
  "ai-trpg-local-development-secret-change-before-production";

export class MissingSessionSecretError extends Error {
  constructor() {
    super(
      "AI_TRPG_API_KEY_ENCRYPTION_SECRET (or AUTH_SECRET / NEXTAUTH_SECRET) must be set in production."
    );
  }
}

export function encodeApiKeySession(
  data: ApiKeySessionData,
  options?: { secret?: string }
): string {
  const key = deriveKey(options?.secret ?? getEncryptionSecret());
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(TOKEN_VERSION, "utf8"));

  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decodeApiKeySession(
  token: string,
  options?: { now?: number; secret?: string }
): ApiKeySessionData | null {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) {
    return null;
  }

  try {
    const key = deriveKey(options?.secret ?? getEncryptionSecret());
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(parts[1], "base64url")
    );
    decipher.setAAD(Buffer.from(TOKEN_VERSION, "utf8"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(parts[3], "base64url")),
      decipher.final(),
    ]).toString("utf8");

    const parsed: unknown = JSON.parse(plaintext);
    if (!isApiKeySessionData(parsed)) {
      return null;
    }

    // The auth tag guarantees expiresAt was not tampered with client-side.
    if (parsed.expiresAt <= (options?.now ?? Date.now())) {
      return null;
    }

    return parsed;
  } catch {
    // Wrong secret, tampered token, or malformed payload.
    return null;
  }
}

function isApiKeySessionData(value: unknown): value is ApiKeySessionData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.apiKey === "string" &&
    data.apiKey.length > 0 &&
    typeof data.modelPresetId === "string" &&
    typeof data.provider === "string" &&
    typeof data.model === "string" &&
    typeof data.expiresAt === "number" &&
    Number.isFinite(data.expiresAt) &&
    typeof data.rememberApiKey === "boolean"
  );
}

function getEncryptionSecret(): string {
  const secret =
    process.env.AI_TRPG_API_KEY_ENCRYPTION_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new MissingSessionSecretError();
  }

  return FALLBACK_DEVELOPMENT_SECRET;
}

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}
