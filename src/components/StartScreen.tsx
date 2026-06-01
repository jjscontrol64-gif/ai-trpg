"use client";

import { useState } from "react";
import { AI_MODEL_PRESETS } from "@/lib/ai/model-presets";
import { DifficultyMode } from "@/lib/types";

interface StartScreenProps {
  onStart: (
    name: string,
    apiKey: string,
    modelPresetId: string,
    difficulty: DifficultyMode
  ) => void;
  onResume: (apiKey: string, modelPresetId: string) => void;
  loading: boolean;
  hasSave: boolean;
  savedPlayerName?: string;
  initialModelPresetId: string;
}

const DIFFICULTY_OPTIONS: {
  id: DifficultyMode;
  label: string;
  description: string;
}[] = [
  { id: "easy", label: "😎 이지", description: "판정이 관대합니다" },
  { id: "normal", label: "📜 노말", description: "표준 균형" },
  { id: "hard", label: "🔥 하드", description: "판정이 가혹합니다" },
];

export default function StartScreen({
  onStart,
  onResume,
  loading,
  hasSave,
  savedPlayerName,
  initialModelPresetId,
}: StartScreenProps) {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelPresetId, setModelPresetId] = useState(initialModelPresetId);
  const [difficulty, setDifficulty] = useState<DifficultyMode>("normal");
  const selectedModel =
    AI_MODEL_PRESETS.find((preset) => preset.id === modelPresetId) ??
    AI_MODEL_PRESETS[0];
  const providerLabel = getProviderLabel(selectedModel.provider);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && apiKey.trim()) {
      onStart(name.trim(), apiKey.trim(), selectedModel.id, difficulty);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(191,143,74,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(50,89,150,0.16),transparent_28%)]" />
      <div className="relative grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1.1fr)_380px]">
        <section className="panel-shell flex flex-col justify-between">
          <div>
            <p className="panel-kicker">Dungeon Crawl Narrative</p>
            <h1
              className="text-5xl font-semibold tracking-[0.08em] sm:text-6xl"
              style={{ color: "var(--accent-gold)", fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              던전 TRPG
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8" style={{ color: "var(--text-secondary)" }}>
              AI 나레이터와 함께 3층 미궁을 돌파하는 텍스트 기반 던전 탐험.
              전사를 조작하며 피나, 미나와 함께 각 층의 보스를 무너뜨리고 최하층의
              레드드래곤까지 도달합니다.
            </p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ["1d20 판정", "모든 주요 행동은 1d20과 스탯, 영감으로 결정됩니다."],
              ["3인 파티", "전사, 피나, 미나의 특수액션을 조합해 전투와 탐험을 진행합니다."],
              ["층별 보스", "리치, 발록, 레드드래곤을 쓰러뜨리면 다음 층이 열립니다."],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-[1.4rem] border border-white/6 bg-black/10 px-4 py-4"
              >
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {title}
                </div>
                <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
                  {description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <aside className="panel-shell">
          {hasSave ? (
            <div
              className="mb-6 rounded-[1.5rem] border border-[color:rgba(191,143,74,0.28)] bg-black/10 p-5 text-left text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <p className="panel-kicker">Saved Expedition</p>
              <div className="mt-2 text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {savedPlayerName ?? "Adventurer"}
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                Select a model and enter its API key to continue. The key is not saved.
              </p>
              <button
                type="button"
                onClick={() => onResume(apiKey.trim(), selectedModel.id)}
                disabled={!apiKey.trim() || loading}
                className="mt-4 w-full rounded-[1.2rem] px-4 py-3 text-sm font-semibold transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
                style={{
                  background: apiKey.trim()
                    ? "linear-gradient(135deg, var(--accent-gold), #f6d28d)"
                    : "var(--bg-panel-soft)",
                  color: apiKey.trim() ? "#1a1207" : "var(--text-muted)",
                }}
              >
                {loading ? "Loading..." : "Continue"}
              </button>
            </div>
          ) : null}

          <div className="space-y-2">
            <p className="panel-kicker">Start Expedition</p>
            <h2 className="panel-title">전사의 이름</h2>
            <p className="text-sm leading-6" style={{ color: "var(--text-secondary)" }}>
              파티 리더의 이름을 정하면 던전 입구 `C6`에서 탐험이 시작됩니다.
            </p>
          </div>

          <div
            className="mt-6 rounded-[1.5rem] border border-white/6 bg-black/10 p-5 text-left text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <span>전사</span>
                <span>HP 10/10 · STR 4</span>
              </div>
              <div className="flex items-center justify-between">
                <span>피나</span>
                <span>DEX 4 · 암습/패스파인딩</span>
              </div>
              <div className="flex items-center justify-between">
                <span>미나</span>
                <span>INT 4 · 마력속박/연금생성</span>
              </div>
              <div className="mt-2 border-t border-white/6 pt-3">
                소지품: 회복물약 ×2
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="player-name"
                className="mb-2 block text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                전사의 이름을 입력하세요
              </label>
              <input
                id="player-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 아르곤"
                maxLength={20}
                className="w-full rounded-[1.2rem] border border-[color:var(--border-color)] bg-[color:var(--bg-panel-soft)] px-4 py-3 text-center text-lg outline-none transition focus:border-[color:var(--accent-gold)]"
                style={{
                  color: "var(--text-primary)",
                }}
                autoFocus
                disabled={loading}
              />
            </div>
            <div>
              <span
                className="mb-2 block text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                난이도
              </span>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map((option) => {
                  const active = difficulty === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setDifficulty(option.id)}
                      disabled={loading}
                      aria-pressed={active}
                      className="rounded-[1.2rem] border px-2 py-3 text-center text-sm transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
                      style={{
                        borderColor: active
                          ? "var(--accent-gold)"
                          : "var(--border-color)",
                        background: active
                          ? "rgba(191,143,74,0.16)"
                          : "var(--bg-panel-soft)",
                        color: active
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                      }}
                    >
                      <span className="block font-semibold">{option.label}</span>
                      <span
                        className="mt-1 block text-[0.7rem] leading-4"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label
                htmlFor="model-preset"
                className="mb-2 block text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                AI 모델
              </label>
              <select
                id="model-preset"
                value={selectedModel.id}
                onChange={(e) => setModelPresetId(e.target.value)}
                className="w-full rounded-[1.2rem] border border-[color:var(--border-color)] bg-[color:var(--bg-panel-soft)] py-3 pl-4 pr-10 text-center text-sm outline-none transition focus:border-[color:var(--accent-gold)]"
                style={{
                  color: "var(--text-primary)",
                  colorScheme: "dark",
                }}
                disabled={loading}
              >
                {AI_MODEL_PRESETS.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    style={{
                      backgroundColor: "#211a14",
                      color: "#f4ead8",
                    }}
                  >
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="ai-api-key"
                className="mb-2 block text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {providerLabel} API Key
              </label>
              <input
                id="ai-api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={getApiKeyPlaceholder(selectedModel.provider)}
                className="w-full rounded-[1.2rem] border border-[color:var(--border-color)] bg-[color:var(--bg-panel-soft)] px-4 py-3 text-center text-sm outline-none transition focus:border-[color:var(--accent-gold)]"
                style={{
                  color: "var(--text-primary)",
                }}
                autoComplete="off"
                spellCheck={false}
                disabled={loading}
              />
              <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                Key is kept only in memory for this session and is sent to the server only for AI provider calls.
              </p>
            </div>
            <button
              type="submit"
              disabled={!name.trim() || !apiKey.trim() || loading}
              className="w-full rounded-[1.2rem] px-4 py-3 text-lg font-semibold transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
              style={{
                background: name.trim() && apiKey.trim()
                  ? "linear-gradient(135deg, var(--accent-gold), #f6d28d)"
                  : "var(--bg-panel-soft)",
                color: name.trim() && apiKey.trim() ? "#1a1207" : "var(--text-muted)",
              }}
            >
              {loading ? "던전 진입 중..." : "던전에 입장하다"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function getProviderLabel(provider: string): string {
  switch (provider) {
    case "claude":
      return "Claude";
    case "openai":
      return "OpenAI";
    default:
      return "Gemini";
  }
}

function getApiKeyPlaceholder(provider: string): string {
  switch (provider) {
    case "claude":
      return "sk-ant-...";
    case "openai":
      return "sk-...";
    default:
      return "AIza...";
  }
}
