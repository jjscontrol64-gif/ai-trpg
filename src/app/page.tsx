"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import DiceResult from "@/components/DiceResult";
import StartScreen from "@/components/StartScreen";
import StatusWindow from "@/components/StatusWindow";
import TRPGChoice from "@/components/TRPGChoice";
import {
  ChoiceOption,
  DiceRollResult,
  GameResponse,
  GameState,
  StatusWindowData,
} from "@/lib/types";

type StoryBeat =
  | {
      id: string;
      role: "assistant";
      narration: string;
      eventSummary: string;
      diceResult?: DiceRollResult;
    }
  | {
      id: string;
      role: "user";
      text: string;
    };

async function postGame<T>(payload: unknown): Promise<T> {
  const response = await fetch("/api/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`게임 API 호출 실패 (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [statusWindow, setStatusWindow] = useState<StatusWindowData | null>(null);
  const [playerName, setPlayerName] = useState("");
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [beats, isPending]);

  const latestAssistantBeat = useMemo(() => {
    return [...beats].reverse().find((beat) => beat.role === "assistant") as
      | Extract<StoryBeat, { role: "assistant" }>
      | undefined;
  }, [beats]);

  const handleStart = (name: string) => {
    startTransition(async () => {
      try {
        setError(null);
        const response = await postGame<GameResponse>({
          type: "start_game",
          playerName: name,
        });

        setPlayerName(name);
        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
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

  const handleChoice = (choice: ChoiceOption) => {
    if (!gameState) return;

    startTransition(async () => {
      try {
        setError(null);
        setCurrentChoices([]);
        setBeats((prev) => [
          ...prev,
          {
            id: createId(),
            role: "user",
            text: choice.label,
          },
        ]);

        const response = await postGame<GameResponse>({
          type: "player_action",
          gameState,
          action: choice.action,
          choiceText: choice.text,
        });

        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
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
        setError(caught instanceof Error ? caught.message : "행동 처리에 실패했습니다.");
      }
    });
  };

  if (!gameState || !statusWindow) {
    return <StartScreen onStart={handleStart} loading={isPending} />;
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
                        <p className="story-copy mt-3">{beat.narration}</p>
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
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  나레이션과 상태창 사이에 배치
                </span>
              </div>

              {currentChoices.length > 0 ? (
                <div className="mt-5">
                  <TRPGChoice
                    choice1={currentChoices[0]}
                    choice2={currentChoices[1]}
                    choice3={currentChoices[2]}
                    onSelect={handleChoice}
                    disabled={isPending}
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-[1.35rem] border border-white/6 bg-black/10 px-4 py-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                  {gameState.phase === "victory"
                    ? "레드드래곤을 쓰러뜨렸습니다. 정복 엔딩이 출력된 상태입니다."
                    : gameState.phase === "game_over"
                      ? "파티가 전멸했습니다. 패배 엔딩이 출력된 상태입니다."
                      : isPending
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

            <section className="panel-shell">
              <p className="panel-kicker">Rule Notes</p>
              <h2 className="panel-title">핵심 규칙</h2>
              <div className="mt-4 grid gap-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
                <div className="rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3">
                  정석적 선택: `1d36 + 스탯 + 영감`
                </div>
                <div className="rounded-[1.2rem] border border-white/6 bg-black/10 px-4 py-3">
                  비정석적 선택: `1d36`만 사용, 26 이상이면 성공
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
