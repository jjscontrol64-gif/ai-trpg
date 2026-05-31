"use client";

import { DiceRollResult } from "@/lib/types";

interface Props {
  result: DiceRollResult;
  summary?: string;
}

const judgmentStyle: Record<string, { label: string; color: string }> = {
  critical_success: { label: "대성공", color: "#ffd700" },
  success: { label: "성공", color: "var(--accent-green)" },
  failure: { label: "실패", color: "var(--text-muted)" },
  critical_failure: { label: "대실패", color: "var(--accent-red)" },
};

const modeLabel: Record<string, string> = {
  easy: "😎 이지",
  normal: "📜 노말",
  hard: "🔥 하드",
};

export default function DiceResult({ result, summary }: Props) {
  const j = judgmentStyle[result.judgment];

  return (
    <div className="dice-block animate-fade-in">
      <div className="font-bold mb-1 tracking-[0.2em] uppercase" style={{ color: "var(--accent-gold)" }}>
        🎲 다이스룰
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        [{modeLabel[result.mode]}]
      </div>
      <div style={{ color: "var(--text-secondary)" }}>
        [판정] 1d20({result.raw})
        {!result.isUnorthodox && (
          <>
            {" "}+ 스탯({result.stat})
            {result.inspirationBonus > 0 && ` + 영감(+${result.inspirationBonus})`}
            {" "}= {result.total}
          </>
        )}
        {result.isUnorthodox && ` = ${result.total} (비정석적 선택)`}
      </div>
      <div>
        [결과]{" "}
        <span className="font-bold" style={{ color: j.color }}>
          {j.label}
        </span>
      </div>
      {summary ? (
        <div style={{ color: "var(--text-secondary)" }}>
          [발생] {summary}
        </div>
      ) : null}
    </div>
  );
}
