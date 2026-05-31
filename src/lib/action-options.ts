import { ChoiceOption, PlayerAction } from "./types";

export const MAX_PROMPT_ACTIONS = 6;

export type ModelChoice = {
  label: string;
  text: string;
  actionIndex?: number | string;
};

export function mapChoicesToActions(
  modelChoices: ModelChoice[],
  availableActions: PlayerAction[]
): ChoiceOption[] {
  const promptActions = availableActions.slice(0, MAX_PROMPT_ACTIONS);
  const fallbackAction = promptActions[0] ?? availableActions[0];

  if (!fallbackAction) {
    return [];
  }

  return modelChoices.slice(0, 3).map((choice, idx) => {
    const actionIndex = normalizeActionIndex(choice.actionIndex);
    const indexedAction =
      typeof actionIndex === "number" ? promptActions[actionIndex] : undefined;

    return {
      label: choice.label,
      text: choice.text,
      action: indexedAction ?? promptActions[idx] ?? fallbackAction,
    };
  });
}

export function normalizeActionIndex(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value);
  }

  return undefined;
}
