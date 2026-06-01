import { ClaudeProvider } from "./claude-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import { AIProvider, AIProviderId } from "./types";

export function createAIProvider(provider: AIProviderId): AIProvider {
  switch (provider) {
    case "gemini":
      return new GeminiProvider();
    case "claude":
      return new ClaudeProvider();
    case "openai":
      return new OpenAIProvider();
  }
}

export type {
  AIMessage,
  AIModelPreset,
  AIProvider,
  AIProviderId,
  AIProviderOptions,
} from "./types";
export { AI_MODEL_PRESETS, resolveAIModelPreset } from "./model-presets";
export {
  AIProviderModelNotFoundError,
  AIProviderQuotaError,
  AIProviderRequestError,
  InvalidApiKeyError,
  MissingApiKeyError,
  TemporaryAIProviderError,
} from "./types";
export { GeminiProvider } from "./gemini-provider";
export { ClaudeProvider } from "./claude-provider";
export { OpenAIProvider } from "./openai-provider";
