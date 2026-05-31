import { ChoiceOption, PlayerAction } from "./types";

// 수수께끼/함정 방은 3캐릭터 × 3스탯(+활로개척)으로 최대 10개까지 행동이 생성되므로
// 적합한 캐릭터(예: 지능 판정의 미나)가 잘리지 않도록 한도를 넉넉히 잡는다.
export const MAX_PROMPT_ACTIONS = 12;

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
