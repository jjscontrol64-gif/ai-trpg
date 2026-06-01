export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIProviderId = "gemini" | "claude" | "openai";

export type AIModelPreset = {
  id: string;
  provider: AIProviderId;
  label: string;
  model: string;
};

export type AIProviderOptions = {
  apiKey?: string;
  model: string;
  json?: boolean;
};

export interface AIProvider {
  generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options: AIProviderOptions
  ): Promise<string>;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("AI provider API key is required.");
    this.name = "MissingApiKeyError";
  }
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("AI provider API key is invalid or unauthorized.");
    this.name = "InvalidApiKeyError";
  }
}

export class TemporaryAIProviderError extends Error {
  constructor() {
    super("AI provider is temporarily unavailable. Please try again shortly.");
    this.name = "TemporaryAIProviderError";
  }
}

export class AIProviderQuotaError extends Error {
  constructor() {
    super("AI provider quota or billing limit has been exceeded.");
    this.name = "AIProviderQuotaError";
  }
}

export class AIProviderModelNotFoundError extends Error {
  constructor() {
    super("Selected AI model is unavailable or not enabled for this API key.");
    this.name = "AIProviderModelNotFoundError";
  }
}

export class AIProviderRequestError extends Error {
  constructor(message = "AI provider request failed.") {
    super(message);
    this.name = "AIProviderRequestError";
  }
}
