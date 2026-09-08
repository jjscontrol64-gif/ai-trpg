import { describe, expect, it } from "vitest";

import {
  ApiKeySessionData,
  decodeApiKeySession,
  encodeApiKeySession,
} from "./api-key-session-cookie";

const SECRET = "test-secret-that-is-long-enough";

function createSession(
  overrides?: Partial<ApiKeySessionData>
): ApiKeySessionData {
  return {
    apiKey: "sk-test-sensitive-key",
    modelPresetId: "openai-gpt-4.1-mini",
    provider: "openai",
    model: "gpt-4.1-mini",
    expiresAt: Date.now() + 60_000,
    rememberApiKey: true,
    ...overrides,
  };
}

describe("api key session cookie", () => {
  it("round-trips a session without exposing the API key in the token", () => {
    const session = createSession();
    const token = encodeApiKeySession(session, { secret: SECRET });

    expect(token).not.toContain(session.apiKey);
    expect(decodeApiKeySession(token, { secret: SECRET })).toEqual(session);
  });

  it("rejects an expired session", () => {
    const token = encodeApiKeySession(
      createSession({ expiresAt: Date.now() - 1 }),
      { secret: SECRET }
    );

    expect(decodeApiKeySession(token, { secret: SECRET })).toBeNull();
  });

  it("rejects a token encrypted with a different secret", () => {
    const token = encodeApiKeySession(createSession(), { secret: SECRET });

    expect(decodeApiKeySession(token, { secret: "another-secret" })).toBeNull();
  });

  it("rejects a tampered ciphertext", () => {
    const parts = encodeApiKeySession(createSession(), {
      secret: SECRET,
    }).split(".");
    parts[3] = Buffer.from("tampered-payload").toString("base64url");

    expect(decodeApiKeySession(parts.join("."), { secret: SECRET })).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(decodeApiKeySession("", { secret: SECRET })).toBeNull();
    expect(decodeApiKeySession("not-a-token", { secret: SECRET })).toBeNull();
    expect(decodeApiKeySession("v2.a.b.c", { secret: SECRET })).toBeNull();
  });
});
