import { AIMessage, AIProvider, AIResponseMimeType } from "./types";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const MAX_RETRY_COUNT = 2;
const GEMINI_MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 4096);

type GeminiRole = "user" | "model";

export class GeminiProvider implements AIProvider {
  async generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options?: {
      apiKey?: string;
      responseMimeType?: AIResponseMimeType;
    }
  ): Promise<string> {
    const apiKey = options?.apiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: messages.map((message) => ({
        role: toGeminiRole(message.role),
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        temperature: 0.8,
        responseMimeType: options?.responseMimeType ?? "text/plain",
      },
    });

    let lastErrorText = "";

    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      const response = await fetch(
        `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: requestBody,
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("");

        if (!text) {
          throw new Error("Gemini API returned empty response");
        }

        return text;
      }

      lastErrorText = await response.text();

      if (
        attempt < MAX_RETRY_COUNT &&
        RETRYABLE_STATUS_CODES.has(response.status)
      ) {
        await delay(500 * 2 ** attempt);
        continue;
      }

      throw new Error(
        `Gemini API request failed (${response.status}): ${lastErrorText}`
      );
    }

    throw new Error(`Gemini API request failed: ${lastErrorText}`);
  }
}

function toGeminiRole(role: AIMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
