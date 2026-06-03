"use client";

import { ChoiceOption } from "@/lib/types";

interface TRPGChoiceProps {
  choices?: ChoiceOption[];
  choice1?: ChoiceOption | null;
  choice2?: ChoiceOption | null;
  choice3?: ChoiceOption | null;
  choice4?: ChoiceOption | null;
  choice5?: ChoiceOption | null;
  onSelect: (choice: ChoiceOption) => void;
  disabled?: boolean;
}

function ChoiceButton({
  choice,
  index,
  disabled,
  onSelect,
}: {
  choice: ChoiceOption;
  index: number;
  disabled: boolean;
  onSelect: (choice: ChoiceOption) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(choice)}
      disabled={disabled}
      className="choice-card group w-full text-left disabled:cursor-not-allowed disabled:opacity-50"
    >
      <div className="flex items-start gap-4">
        <span className="choice-index">{index}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="choice-label">{choice.label}</span>
            <span className="choice-prompt">선택</span>
          </div>
          <p className="choice-text">{choice.text}</p>
        </div>
      </div>
    </button>
  );
}

export default function TRPGChoice({
  choices: choiceList,
  choice1,
  choice2,
  choice3,
  choice4,
  choice5,
  onSelect,
  disabled = false,
}: TRPGChoiceProps) {
  const choices = (choiceList ?? [choice1, choice2, choice3, choice4, choice5]).filter(
    (choice): choice is ChoiceOption => Boolean(choice)
  );

  if (choices.length === 0) return null;

  return (
    <div className="space-y-3">
      {choices.map((choice, idx) => (
        <ChoiceButton
          key={idx}
          choice={choice}
          index={idx + 1}
          disabled={disabled}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
