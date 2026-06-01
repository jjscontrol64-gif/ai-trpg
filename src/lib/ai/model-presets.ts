import type { AIModelPreset } from "./types";

export const AI_MODEL_PRESETS: AIModelPreset[] = [
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    model: "gemini-2.5-flash",
  },
  {
    id: "claude-sonnet",
    provider: "claude",
    label: "Claude Sonnet",
    model: "claude-sonnet-4-20250514",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    model: "gpt-4o",
  },
];

export function resolveAIModelPreset(
  modelPresetId: string | undefined
): AIModelPreset | null {
  if (!modelPresetId) return null;
  return AI_MODEL_PRESETS.find((preset) => preset.id === modelPresetId) ?? null;
}
