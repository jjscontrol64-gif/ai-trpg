export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AIResponseMimeType = "application/json" | "text/plain";

export interface AIProvider {
  generateText(
    systemPrompt: string,
    messages: AIMessage[],
    options?: {
      apiKey?: string;
      responseMimeType?: AIResponseMimeType;
    }
  ): Promise<string>;
}
