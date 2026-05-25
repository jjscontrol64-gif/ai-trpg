import { GeminiProvider } from "./gemini-provider";
import { AIProvider } from "./types";

export function createAIProvider(): AIProvider {
  return new GeminiProvider();
}

export type { AIMessage, AIProvider, AIResponseMimeType } from "./types";
export { GeminiProvider } from "./gemini-provider";
