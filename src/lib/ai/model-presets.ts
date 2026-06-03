import type { AIModelPreset } from "./types";

export const AI_MODEL_PRESETS: AIModelPreset[] = [
  // {
  //   id: "gemini-2.5-flash",
  //   provider: "gemini",
  //   label: "Gemini 2.5 Flash",
  //   model: "gemini-2.5-flash",
  // },
  {
    id: "gemini-2.5-pro",
    provider: "gemini",
    label: "Gemini 2.5 Pro",
    model: "gemini-2.5-pro",
  },
  {
    id: "gemini-3.1-pro-preview",
    provider: "gemini",
    label: "Gemini 3.1 Pro Preview",
    model: "gemini-3.1-pro-preview",
  },
  {
    id: "claude-sonnet",
    provider: "claude",
    label: "Claude Sonnet",
    model: "claude-sonnet-4-20250514",
  },
  {
    id: "claude-opus",
    provider: "claude",
    label: "Claude Opus 4.8",
    model: "claude-opus-4-8",
  },
  // {
  //   id: "gpt-4o",
  //   provider: "openai",
  //   label: "GPT-4o",
  //   model: "gpt-4o",
  // },
  {
    id: "gpt-5.5",
    provider: "openai",
    label: "GPT-5.5",
    model: "gpt-5.5",
  },
  {
    id: "gpt-5.4",
    provider: "openai",
    label: "GPT-5.4",
    model: "gpt-5.4",
  },
  {
    id: "gpt-5.4-mini",
    provider: "openai",
    label: "GPT-5.4 Mini",
    model: "gpt-5.4-mini",
  },
];

export function resolveAIModelPreset(
  modelPresetId: string | undefined
): AIModelPreset | null {
  if (!modelPresetId) return null;
  return AI_MODEL_PRESETS.find((preset) => preset.id === modelPresetId) ?? null;
}
