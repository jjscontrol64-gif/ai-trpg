import {
  AIMessage,
  AIProvider,
  AIProviderModelNotFoundError,
  AIProviderOptions,
  AIProviderQuotaError,
  AIProviderRequestError,
  InvalidApiKeyError,
  MissingApiKeyError,
  TemporaryAIProviderError,
} from "./types";

const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const INVALID_API_KEY_STATUS_CODES = new Set([401, 403]);
const MAX_RETRY_COUNT = 2;
const OPENAI_MAX_OUTPUT_TOKENS = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 4096);
const JSON_INSTRUCTION =
  "Return only a valid JSON object. Do not wrap it in markdown fences or add commentary.";

export class OpenAIProvider implements AIProvider {
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
      messages: [
        {
          role: "system",
          content: options.json
            ? `${systemPrompt}\n\n${JSON_INSTRUCTION}`
            : systemPrompt,
        },
        ...messages,
      ],
      max_tokens: OPENAI_MAX_OUTPUT_TOKENS,
      temperature: 0.8,
    });

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;

        if (typeof text !== "string" || !text) {
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
      const openAIError = parseOpenAIError(errorBody);
      console.warn("OpenAI API error:", {
        status: response.status,
        type: openAIError?.type,
        code: openAIError?.code,
        message: openAIError?.message,
        rateLimit: readRateLimitHeaders(response),
      });

      if (isInvalidApiKeyResponse(response.status, openAIError, errorBody)) {
        throw new InvalidApiKeyError();
      }

      if (isInsufficientQuotaError(openAIError)) {
        throw new AIProviderQuotaError();
      }

      if (isModelNotFoundError(response.status, openAIError)) {
        throw new AIProviderModelNotFoundError();
      }

      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        throw new TemporaryAIProviderError();
      }

      throw new AIProviderRequestError(formatOpenAIRequestError(response.status, openAIError));
    }

    throw new AIProviderRequestError();
  }
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

type OpenAIErrorBody = {
  error?: {
    message?: unknown;
    type?: unknown;
    code?: unknown;
  };
};

type ParsedOpenAIError = {
  message: string;
  type: string;
  code: string;
};

function parseOpenAIError(body: string): ParsedOpenAIError | null {
  try {
    const parsed = JSON.parse(body) as OpenAIErrorBody;
    const error = parsed.error;
    if (!error) return null;

    return {
      message: typeof error.message === "string" ? error.message : "",
      type: typeof error.type === "string" ? error.type : "",
      code: typeof error.code === "string" ? error.code : "",
    };
  } catch {
    return null;
  }
}

function isInvalidApiKeyResponse(
  status: number,
  error: ParsedOpenAIError | null,
  body: string
): boolean {
  const typeOrCode = `${error?.type ?? ""} ${error?.code ?? ""}`;
  return (
    INVALID_API_KEY_STATUS_CODES.has(status) ||
    /invalid_api_key|authentication_error/.test(typeOrCode) ||
    (status === 400 && /api[_ -]?key|auth|unauthorized|permission/i.test(body))
  );
}

function isInsufficientQuotaError(error: ParsedOpenAIError | null): boolean {
  const typeOrCode = `${error?.type ?? ""} ${error?.code ?? ""}`;
  return /insufficient_quota|billing|quota/.test(typeOrCode);
}

function isModelNotFoundError(
  status: number,
  error: ParsedOpenAIError | null
): boolean {
  const typeOrCode = `${error?.type ?? ""} ${error?.code ?? ""}`;
  return (
    status === 404 ||
    /model_not_found/.test(typeOrCode) ||
    (status === 400 && /model/.test(typeOrCode) && /not_found|not found/.test(error?.message ?? ""))
  );
}

function formatOpenAIRequestError(
  status: number,
  error: ParsedOpenAIError | null
): string {
  if (!error?.message) {
    return `AI provider request failed (${status}).`;
  }

  return `AI provider request failed (${status}): ${error.message}`;
}

function readRateLimitHeaders(response: Response): Record<string, string> {
  const headerNames = [
    "x-ratelimit-limit-requests",
    "x-ratelimit-remaining-requests",
    "x-ratelimit-reset-requests",
    "x-ratelimit-limit-tokens",
    "x-ratelimit-remaining-tokens",
    "x-ratelimit-reset-tokens",
  ];

  return Object.fromEntries(
    headerNames
      .map((name) => [name, response.headers.get(name)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== null)
  );
}
