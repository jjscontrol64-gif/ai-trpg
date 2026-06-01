import {
  AIMessage,
  AIProvider,
  AIProviderOptions,
  AIProviderRequestError,
  InvalidApiKeyError,
  MissingApiKeyError,
  TemporaryAIProviderError,
} from "./types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const RETRYABLE_STATUS_CODES = new Set([429, 503, 529]);
const INVALID_API_KEY_STATUS_CODES = new Set([401, 403]);
const MAX_RETRY_COUNT = 2;
const CLAUDE_MAX_OUTPUT_TOKENS = Number(process.env.CLAUDE_MAX_OUTPUT_TOKENS ?? 4096);
const JSON_INSTRUCTION =
  "Return only a valid JSON object. Do not wrap it in markdown fences or add commentary.";

export class ClaudeProvider implements AIProvider {
  async generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options: AIProviderOptions
  ): Promise<string> {
    const apiKey = options.apiKey?.trim();

    if (!apiKey) {
      throw new MissingApiKeyError();
    }

    const requestBody = JSON.stringify({
      model: options.model,
      max_tokens: CLAUDE_MAX_OUTPUT_TOKENS,
      system: options.json
        ? `${systemPrompt}\n\n${JSON_INSTRUCTION}`
        : systemPrompt,
      messages: normalizeClaudeMessages(messages),
    });

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      const response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.content
          ?.map((block: { type?: string; text?: string }) =>
            block.type === "text" ? block.text ?? "" : ""
          )
          .join("");

        if (!text) {
          throw new AIProviderRequestError("AI provider returned empty response.");
        }

        return text;
      }

      if (
        attempt < MAX_RETRY_COUNT &&
        RETRYABLE_STATUS_CODES.has(response.status)
      ) {
        await delay(500 * 2 ** attempt);
        continue;
      }

      const errorBody = await readResponseBody(response);

      if (isInvalidApiKeyResponse(response.status, errorBody)) {
        throw new InvalidApiKeyError();
      }

      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        throw new TemporaryAIProviderError();
      }

      throw new AIProviderRequestError(
        `AI provider request failed (${response.status}).`
      );
    }

    throw new AIProviderRequestError();
  }
}

function normalizeClaudeMessages(messages: AIMessage[]): AIMessage[] {
  const normalized: AIMessage[] = [];

  for (const message of messages) {
    const previous = normalized[normalized.length - 1];

    if (previous?.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`;
      continue;
    }

    normalized.push({ ...message });
  }

  if (normalized[0]?.role === "assistant") {
    normalized.unshift({
      role: "user",
      content: "Continue the game from the previous conversation context.",
    });
  }

  return normalized;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isInvalidApiKeyResponse(status: number, body: string): boolean {
  return (
    INVALID_API_KEY_STATUS_CODES.has(status) ||
    (status === 400 && /api[_ -]?key|auth|unauthorized|permission/i.test(body))
  );
}
