"use client";

import { useEffect } from "react";
import { MAX_CHOICE_COUNT } from "@/lib/action-options";
import { ChoiceOption } from "@/lib/types";

const CHOICE_KEYS = Array.from({ length: MAX_CHOICE_COUNT }, (_, idx) =>
  String(idx + 1)
);

export default function CommandMenu({
  choices,
  onSelect,
  onTalk,
  canTalk,
  inspirationArmed,
  onToggleInspiration,
  inspiration,
  disabled,
  emptyMessage,
}: {
  choices: ChoiceOption[];
  onSelect: (c: ChoiceOption) => void;
  onTalk: () => void;
  canTalk: boolean;
  inspirationArmed: boolean;
  onToggleInspiration: () => void;
  inspiration: number;
  disabled: boolean;
  emptyMessage?: string;
}) {
  // 키보드 1/2/3 으로 선택 (커맨드 창 느낌)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const i = CHOICE_KEYS.indexOf(e.key);
      if (i >= 0 && choices[i] && !disabled) onSelect(choices[i]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [choices, disabled, onSelect]);

  return (
    <div className="panel-shell cmd">
      <p className="panel-kicker">Command</p>
      <h2 className="panel-title">행동 선택</h2>

      <div className="cmd-list">
        {choices.length === 0 ? (
          <div className="cmd-empty">
            {emptyMessage ?? "선택 가능한 행동이 없습니다."}
          </div>
        ) : (
          choices.map((c, i) => (
            <button
              key={i}
              type="button"
              className="ch"
              disabled={disabled}
              onClick={() => onSelect(c)}
            >
              <span className="sel">▸</span>
              <span className="key">{i + 1}</span>
              <span className="lbl">{c.label}</span>
            </button>
          ))
        )}
      </div>

      <div className="cmd-foot">
        <button
          type="button"
          className="mini-btn"
          onClick={onTalk}
          disabled={!canTalk || disabled}
        >
          대화하기
        </button>
        <button
          type="button"
          className={`mini-btn ${inspirationArmed ? "gold" : ""}`}
          aria-pressed={inspirationArmed}
          onClick={onToggleInspiration}
          disabled={disabled}
        >
          영감 ★ {inspiration}/3
        </button>
      </div>
    </div>
  );
}
