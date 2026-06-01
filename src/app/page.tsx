"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import DiceResult from "@/components/DiceResult";
import InventoryPanel from "@/components/InventoryPanel";
import StartScreen from "@/components/StartScreen";
import StatusWindow from "@/components/StatusWindow";
import TRPGChoice from "@/components/TRPGChoice";
import {
  ChoiceOption,
  DifficultyMode,
  DiceRollResult,
  GameResponse,
  GameState,
  PlayerAction,
  StatusWindowData,
  StoryBeat,
} from "@/lib/types";
import { buildStatusWindow } from "@/lib/status";
import {
  createStorageProvider,
  isSaveSnapshot,
  SAVE_SCHEMA_VERSION,
  SaveSnapshot,
} from "@/lib/storage";
import { AI_MODEL_PRESETS } from "@/lib/ai/model-presets";

const storageProvider = createStorageProvider();
const DEFAULT_SAVE_ID = "default";
const DEFAULT_MODEL_PRESET_ID = AI_MODEL_PRESETS[0]?.id ?? "gemini-2.5-flash";
type ChoiceSubmitStatus = "idle" | "submitting" | "failed";
type SaveImportStatus = "idle" | "imported" | "error";

interface GameSnapshot {
  gameState: GameState;
  statusWindow: StatusWindowData;
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
}

function createGameSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return {
    ...snapshot,
    beats: [...snapshot.beats],
    currentChoices: [...snapshot.currentChoices],
  };
}

function restoreGameSnapshot(snapshot: GameSnapshot): GameSnapshot {
  return createGameSnapshot(snapshot);
}

function canApplyInspiration(action: PlayerAction): action is Extract<
  PlayerAction,
  { type: "attack" | "puzzle_attempt" | "trap_attempt" }
> {
  return (
    action.type === "attack" ||
    action.type === "puzzle_attempt" ||
    action.type === "trap_attempt"
  );
}

function applyInspirationToChoice(
  choice: ChoiceOption,
  shouldUseInspiration: boolean
): ChoiceOption {
  if (!shouldUseInspiration || !canApplyInspiration(choice.action)) {
    return choice;
  }

  return {
    ...choice,
    action: {
      ...choice.action,
      useInspiration: true,
    },
  };
}

async function postGame<T>(payload: unknown): Promise<T> {
  const response = await fetch("/api/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Game API request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Keep status-based fallback when the response body is not JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSaveFileName(playerName: string): string {
  const safePlayerName = playerName
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);

  return `ai-trpg-${safePlayerName || "save"}-${date}.json`;
}

function getPhaseLabel(phase?: GameState["phase"]) {
  switch (phase) {
    case "combat":
      return "전투 중";
    case "event":
      return "이벤트";
    case "victory":
      return "정복 완료";
    case "game_over":
      return "탐험 종료";
    default:
      return "탐험 중";
  }
}

function getModeLabel(mode?: GameState["mode"]) {
  switch (mode) {
    case "easy":
      return "😎 이지";
    case "hard":
      return "🔥 하드";
    default:
      return "📜 노말";
  }
}

export default function HomePage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [currentChoices, setCurrentChoices] = useState<ChoiceOption[]>([]);
  const [choiceSubmitStatus, setChoiceSubmitStatus] =
    useState<ChoiceSubmitStatus>("idle");
  const [lastSubmittedChoice, setLastSubmittedChoice] =
    useState<ChoiceOption | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [statusWindow, setStatusWindow] = useState<StatusWindowData | null>(null);
  const [previousSnapshot, setPreviousSnapshot] = useState<GameSnapshot | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [modelPresetId, setModelPresetId] = useState(DEFAULT_MODEL_PRESET_ID);
  const [apiKeySessionId, setApiKeySessionId] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<SaveSnapshot | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [importStatus, setImportStatus] = useState<SaveImportStatus>("idle");
  const [inspirationArmed, setInspirationArmed] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    storageProvider.load(DEFAULT_SAVE_ID).then((snapshot) => {
      if (!cancelled) {
        setSavedSnapshot(snapshot);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [beats, isPending]);

  useEffect(() => {
    if (!gameState || gameState.party.inspiration <= 0) {
      setInspirationArmed(false);
    }
  }, [gameState]);

  const latestAssistantBeat = useMemo(() => {
    return [...beats].reverse().find((beat) => beat.role === "assistant") as
      | Extract<StoryBeat, { role: "assistant" }>
      | undefined;
  }, [beats]);

  const canTalk =
    Boolean(gameState) &&
    !gameState?.combat.active &&
    gameState?.phase !== "combat" &&
    gameState?.phase !== "game_over" &&
    gameState?.phase !== "victory";

  const handleStart = (
    name: string,
    apiKey: string,
    selectedModelPresetId: string,
    difficulty: DifficultyMode
  ) => {
    startTransition(async () => {
      try {
        setError(null);
        const response = await postGame<GameResponse>({
          type: "start_game",
          playerName: name,
          modelPresetId: selectedModelPresetId,
          difficulty,
          apiKey,
        });

        setPlayerName(name);
        setAiApiKey("");
        setModelPresetId(selectedModelPresetId);
        setApiKeySessionId(response.apiKeySessionId ?? "");
        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setLastSubmittedChoice(null);
        setPreviousSnapshot(null);
        setInspirationArmed(false);
        setBeats([
          {
            id: createId(),
            role: "assistant",
            narration: response.narration,
            eventSummary: response.eventSummary,
            diceResult: response.diceResult,
          },
        ]);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "게임 시작에 실패했습니다.");
      }
    });
  };

  const handleResume = (apiKey: string, selectedModelPresetId: string) => {
    if (!savedSnapshot) return;

    setError(null);
    setChoiceSubmitStatus("idle");
    setLastSubmittedChoice(null);
    setPreviousSnapshot(null);
    setPlayerName(savedSnapshot.playerName);
    setAiApiKey(apiKey);
    setModelPresetId(selectedModelPresetId);
    setApiKeySessionId("");
    setGameState(savedSnapshot.gameState);
    setStatusWindow(buildStatusWindow(savedSnapshot.gameState));
    setCurrentChoices(savedSnapshot.currentChoices);
    setBeats(savedSnapshot.beats);
    setInspirationArmed(false);
  };

  const handleSave = () => {
    if (!gameState || !playerName) return;

    startTransition(async () => {
      try {
        setSaveStatus("idle");
        const snapshot: SaveSnapshot = {
          schemaVersion: SAVE_SCHEMA_VERSION,
          saveId: DEFAULT_SAVE_ID,
          playerName,
          gameState,
          beats,
          currentChoices,
          savedAt: new Date().toISOString(),
        };

        await storageProvider.save(snapshot);
        setSavedSnapshot(snapshot);
        setSaveStatus("saved");
        window.setTimeout(() => setSaveStatus("idle"), 1800);
      } catch {
        setSaveStatus("error");
      }
    });
  };

  const handleExportSave = () => {
    if (!gameState || !playerName) return;

    const snapshot: SaveSnapshot = {
      schemaVersion: SAVE_SCHEMA_VERSION,
      saveId: DEFAULT_SAVE_ID,
      playerName,
      gameState,
      beats,
      currentChoices,
      savedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = createSaveFileName(playerName);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSave = (file: File) => {
    startTransition(async () => {
      try {
        setImportStatus("idle");
        const parsed = JSON.parse(await file.text()) as unknown;

        if (!isSaveSnapshot(parsed)) {
          setImportStatus("error");
          return;
        }

        const snapshot: SaveSnapshot = {
          ...parsed,
          saveId: DEFAULT_SAVE_ID,
        };

        await storageProvider.save(snapshot);
        setSavedSnapshot(snapshot);
        setImportStatus("imported");
      } catch {
        setImportStatus("error");
      }
    });
  };

  const handleChoice = (
    choice: ChoiceOption,
    appendUserBeat = true,
    updateHistory = true
  ) => {
    if (!gameState || !statusWindow || choiceSubmitStatus === "submitting") return;

    const submittedChoice = applyInspirationToChoice(
      choice,
      inspirationArmed && gameState.party.inspiration > 0
    );

    if (updateHistory) {
      setPreviousSnapshot(
        createGameSnapshot({
          gameState,
          statusWindow,
          beats,
          currentChoices,
        })
      );
    }
    setChoiceSubmitStatus("submitting");
    setLastSubmittedChoice(submittedChoice);
    setInspirationArmed(false);
    startTransition(async () => {
      try {
        setError(null);
        if (appendUserBeat) {
          setBeats((prev) => [
            ...prev,
            {
              id: createId(),
              role: "user",
              text: submittedChoice.label,
            },
          ]);
        }

        const response = await postGame<GameResponse>({
          type: "player_action",
          gameState,
          action: submittedChoice.action,
          choiceText: submittedChoice.text,
          apiKeySessionId,
          modelPresetId,
          apiKey: apiKeySessionId ? undefined : aiApiKey,
        });

        setAiApiKey("");
        setApiKeySessionId(response.apiKeySessionId ?? apiKeySessionId);
        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setLastSubmittedChoice(null);
        setBeats((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            narration: response.narration,
            eventSummary: response.eventSummary,
            diceResult: response.diceResult,
          },
        ]);
      } catch (caught) {
        setChoiceSubmitStatus("failed");
        setError(caught instanceof Error ? caught.message : "행동 처리에 실패했습니다.");
      }
    });
  };

  const handleRetryChoice = () => {
    if (!lastSubmittedChoice || choiceSubmitStatus !== "failed") return;
    handleChoice(lastSubmittedChoice, false, false);
  };

  const handleTalk = () => {
    if (!gameState || !statusWindow || !canTalk || choiceSubmitStatus === "submitting") return;

    setChoiceSubmitStatus("submitting");
    setLastSubmittedChoice(null);
    setInspirationArmed(false);
    startTransition(async () => {
      try {
        setError(null);
        const response = await postGame<GameResponse>({
          type: "talk",
          gameState,
          apiKeySessionId,
          modelPresetId,
          apiKey: apiKeySessionId ? undefined : aiApiKey,
        });

        setAiApiKey("");
        setApiKeySessionId(response.apiKeySessionId ?? apiKeySessionId);
        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setBeats((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            narration: response.narration,
            eventSummary: response.eventSummary,
            diceResult: response.diceResult,
          },
        ]);
      } catch (caught) {
        setChoiceSubmitStatus("failed");
        setError(caught instanceof Error ? caught.message : "대화 생성에 실패했습니다.");
      }
    });
  };

  const handleBack = () => {
    if (!previousSnapshot || choiceSubmitStatus === "submitting") return;

    const snapshot = restoreGameSnapshot(previousSnapshot);
    setGameState(snapshot.gameState);
    setStatusWindow(snapshot.statusWindow);
    setBeats(snapshot.beats);
    setCurrentChoices(snapshot.currentChoices);
    setChoiceSubmitStatus("idle");
    setLastSubmittedChoice(null);
    setPreviousSnapshot(null);
    setInspirationArmed(false);
    setError(null);
  };

  if (!gameState || !statusWindow) {
    return (
      <StartScreen
        onStart={handleStart}
        onResume={handleResume}
        onImportSave={handleImportSave}
        loading={isPending}
        hasSave={Boolean(savedSnapshot)}
        savedPlayerName={savedSnapshot?.playerName}
        initialModelPresetId={modelPresetId}
        importStatus={importStatus}
      />
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="panel-shell">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="panel-kicker">Live Session</p>
              <h1
                className="text-4xl font-semibold sm:text-5xl"
                style={{ color: "var(--accent-gold)", fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {playerName}의 던전 탐험
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                응답은 설계 문서의 순서대로 출력됩니다. 다이스 판정이 있는 턴에는
                판정 블록이 먼저 나타나고, 이후 나레이션과 선택지가 이어집니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                getModeLabel(gameState.mode),
                getPhaseLabel(gameState.phase),
                `${statusWindow.party.floor} ${statusWindow.party.loc}`,
              ].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {pill}
                </span>
              ))}
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em] transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ color: "var(--text-secondary)" }}
              >
                {saveStatus === "saved"
                  ? "Saved"
                  : saveStatus === "error"
                    ? "Save failed"
                    : "Save"}
              </button>
              <button
                type="button"
                onClick={handleExportSave}
                disabled={isPending}
                className="rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em] transition hover:-translate-y-px disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ color: "var(--text-secondary)" }}
              >
                Export
              </button>
              <button
                type="button"
                onClick={handleBack}
                disabled={!previousSnapshot || choiceSubmitStatus === "submitting"}
                className="rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                style={{ color: "var(--text-secondary)" }}
              >
                뒤로가기
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-[1.35rem] border border-[color:rgba(210,101,87,0.35)] bg-[rgba(210,101,87,0.08)] px-4 py-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_380px]">
          <section className="space-y-5">
            <div className="panel-shell">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="panel-kicker">Narration Feed</p>
                  <h2 className="panel-title">대화 / 나레이션</h2>
                </div>
                {isPending ? (
                  <span
                    className="rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    처리 중...
                  </span>
                ) : null}
              </div>

              <div ref={logRef} className="mt-5 max-h-[68vh] space-y-4 overflow-y-auto pr-1">
                {beats.map((beat) => {
                  if (beat.role === "user") {
                    return (
                      <div key={beat.id} className="flex justify-end">
                        <div className="max-w-[78%] rounded-[1.3rem] border border-[color:rgba(121,164,218,0.16)] bg-[rgba(121,164,218,0.08)] px-4 py-3 text-sm" style={{ color: "var(--text-primary)" }}>
                          {beat.text}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <article key={beat.id} className="story-card animate-fade-in">
                      {beat.diceResult ? (
                        <DiceResult result={beat.diceResult} summary={beat.eventSummary} />
                      ) : null}
                      <div className={beat.diceResult ? "mt-4" : ""}>
                        <div className="text-[0.68rem] uppercase tracking-[0.22em]" style={{ color: "var(--text-muted)" }}>
                          GM Narration
                        </div>
                        <p className="story-copy mt-3 whitespace-pre-line">{beat.narration}</p>
                        {!beat.diceResult ? (
                          <div className="story-summary">{beat.eventSummary}</div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="panel-shell">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="panel-kicker">TRPG Choice</p>
                  <h2 className="panel-title">행동 선택</h2>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    ★ {gameState.party.inspiration}/3
                  </span>
                  <button
                    type="button"
                    onClick={handleTalk}
                    disabled={!canTalk || choiceSubmitStatus === "submitting"}
                    className="inline-flex h-9 items-center rounded-full border border-white/8 bg-black/15 px-3 text-xs font-semibold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    대화하기
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={inspirationArmed}
                    onClick={() => setInspirationArmed((armed) => !armed)}
                    disabled={choiceSubmitStatus === "submitting"}
                    className="inline-flex h-9 min-w-[7.75rem] items-center justify-between gap-2 rounded-full border border-white/8 bg-black/15 px-3 text-xs font-semibold transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{
                      color: inspirationArmed ? "#1a1207" : "var(--text-secondary)",
                      background: inspirationArmed
                        ? "linear-gradient(135deg, var(--accent-gold), #f6d28d)"
                        : "rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    <span>영감</span>
                    <span
                      className="inline-flex h-5 w-9 items-center rounded-full border border-white/10 bg-black/20 p-0.5"
                      aria-hidden="true"
                    >
                      <span
                        className="h-4 w-4 rounded-full bg-current transition-transform"
                        style={{
                          transform: inspirationArmed
                            ? "translateX(1rem)"
                            : "translateX(0)",
                        }}
                      />
                    </span>
                  </button>
                </div>
              </div>

              {currentChoices.length > 0 ? (
                <div className="mt-5">
                  <TRPGChoice
                    choice1={currentChoices[0]}
                    choice2={currentChoices[1]}
                    choice3={currentChoices[2]}
                    onSelect={handleChoice}
                    disabled={choiceSubmitStatus === "submitting"}
                  />
                  {/* <button
                    type="button"
                    onClick={handleRetryChoice}
                    disabled={
                      choiceSubmitStatus !== "failed" ||
                      !lastSubmittedChoice
                    }
                    className="mt-3 rounded-full border border-white/8 bg-black/15 px-4 py-2 text-xs tracking-[0.14em] transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    다시 시도
                  </button> */}
                </div>
              ) : (
                <div className="mt-5 rounded-[1.35rem] border border-white/6 bg-black/10 px-4 py-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                  {gameState.phase === "victory"
                    ? "레드드래곤을 쓰러뜨렸습니다. 정복 엔딩이 출력된 상태입니다."
                    : gameState.phase === "game_over"
                      ? "파티가 전멸했습니다. 패배 엔딩이 출력된 상태입니다."
                      : choiceSubmitStatus === "submitting"
                        ? "다음 선택지를 생성하고 있습니다."
                        : latestAssistantBeat?.eventSummary ?? "선택 가능한 행동이 없습니다."}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
            <StatusWindow
              warrior={statusWindow.warrior}
              pina={statusWindow.pina}
              mina={statusWindow.mina}
              monster={statusWindow.monster}
              party={statusWindow.party}
            />

            <InventoryPanel
              inventory={gameState.party.inventory}
              members={gameState.party.members}
              onUse={handleChoice}
              disabled={
                choiceSubmitStatus === "submitting" ||
                gameState.phase === "victory" ||
                gameState.phase === "game_over"
              }
            />

            <section className="panel-shell">
              <p className="panel-kicker">Rule Notes</p>
              <h2 className="panel-title">핵심 규칙</h2>
              <div className="mt-4 grid gap-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                <div className="rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3">
                  정석적 선택: `1d20 + 스탯 + 영감`
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3">
                  비정석적 선택: `1d20`만 사용, 15 이상이면 성공
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3">
                  영감은 최대 `★★★`, 사용 시 다음 판정에 `+5`
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
