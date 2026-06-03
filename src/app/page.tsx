"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import CommandMenu from "@/components/CommandMenu";
import PartyDrawer from "@/components/PartyDrawer";
import PartyHud from "@/components/PartyHud";
import ScriptStage, { AttackFxEvent } from "@/components/ScriptStage";
import StartScreen from "@/components/StartScreen";
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
import { normalizeGameState } from "@/lib/state-normalization";
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
type GameSessionStatus =
  | { authenticated: false }
  | {
      authenticated: true;
      modelPresetId: string;
      provider: string;
      model: string;
    };

const ATTACK_FX_COLORS: Record<string, string> = {
  slash: "#ffe9bd",
  smash: "#ffe9bd",
  stab: "#cfeeff",
  ambush: "#c79bff",
  magic: "#bcd6ff",
  bind: "#bcd6ff",
};

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
    credentials: "same-origin",
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

async function getGameSessionStatus(): Promise<GameSessionStatus> {
  const response = await fetch("/api/game", {
    method: "GET",
    credentials: "same-origin",
  });

  if (!response.ok) {
    return { authenticated: false };
  }

  return response.json() as Promise<GameSessionStatus>;
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

function buildSaveSnapshot(
  playerName: string,
  modelPresetId: string,
  gameState: GameState,
  beats: StoryBeat[],
  currentChoices: ChoiceOption[]
): SaveSnapshot {
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    saveId: DEFAULT_SAVE_ID,
    playerName,
    modelPresetId,
    gameState,
    beats,
    currentChoices,
    savedAt: new Date().toISOString(),
  };
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

function getAttackEffectName(action: PlayerAction, state: GameState): string | null {
  if (action.type === "attack") {
    const role = state.party.members[action.characterIndex]?.role;

    if (role === "warrior") return "slash";
    if (role === "rogue") return "stab";
    if (role === "mage") return "magic";
  }

  if (action.type === "special_action") {
    if (action.actionName === "강타") return "smash";
    if (action.actionName === "암습") return "ambush";
    if (action.actionName === "마력속박") return "bind";
  }

  return null;
}

function createAttackFxEvent(
  action: PlayerAction,
  previousState: GameState,
  response: GameResponse
): AttackFxEvent | null {
  const effect = getAttackEffectName(action, previousState);

  if (!effect || !previousState.combat.monster) {
    return null;
  }

  const nextMonster = response.gameState.combat.monster;
  const damage = Math.max(
    0,
    previousState.combat.monster.hp - (nextMonster?.hp ?? 0)
  );
  const crit =
    response.diceResult?.judgment === "critical_success" || effect === "ambush";

  return {
    id: createId(),
    effect,
    damage,
    crit,
    color: ATTACK_FX_COLORS[effect] ?? "#fff",
    turns: effect === "bind" ? 2 : undefined,
  };
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
  const [modelPresetId, setModelPresetId] = useState(DEFAULT_MODEL_PRESET_ID);
  const [savedSnapshot, setSavedSnapshot] = useState<SaveSnapshot | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [importStatus, setImportStatus] = useState<SaveImportStatus>("idle");
  const [inspirationArmed, setInspirationArmed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [attackFxEvent, setAttackFxEvent] = useState<AttackFxEvent | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    storageProvider.load(DEFAULT_SAVE_ID).then(async (snapshot) => {
      if (cancelled) return;

      setSavedSnapshot(snapshot);
      if (!snapshot) return;

      const sessionStatus = await getGameSessionStatus();
      if (cancelled || !sessionStatus.authenticated) {
        return;
      }

      const restoredModelPresetId =
        snapshot.modelPresetId || sessionStatus.modelPresetId || DEFAULT_MODEL_PRESET_ID;
      const normalizedGameState = normalizeGameState(snapshot.gameState);

      setPlayerName(snapshot.playerName);
      setModelPresetId(restoredModelPresetId);
      setGameState(normalizedGameState);
      setStatusWindow(buildStatusWindow(normalizedGameState));
      setCurrentChoices(snapshot.currentChoices);
      setBeats(snapshot.beats);
      setChoiceSubmitStatus("idle");
      setLastSubmittedChoice(null);
      setPreviousSnapshot(null);
      setInspirationArmed(false);
      setAttackFxEvent(null);
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

  useEffect(() => {
    if (
      !gameState ||
      !playerName ||
      choiceSubmitStatus !== "idle"
    ) {
      return;
    }

    const snapshot = buildSaveSnapshot(
      playerName,
      modelPresetId,
      gameState,
      beats,
      currentChoices
    );

    setSavedSnapshot(snapshot);
    storageProvider.save(snapshot).catch(() => {
      setSaveStatus("error");
    });
  }, [
    beats,
    choiceSubmitStatus,
    currentChoices,
    gameState,
    modelPresetId,
    playerName,
  ]);

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
        setModelPresetId(selectedModelPresetId);
        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setLastSubmittedChoice(null);
        setPreviousSnapshot(null);
        setInspirationArmed(false);
        setAttackFxEvent(null);
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

    startTransition(async () => {
      try {
        setError(null);
        await postGame<{ ok: boolean }>({
          type: "configure_api_key",
          modelPresetId: selectedModelPresetId,
          apiKey,
        });

        setChoiceSubmitStatus("idle");
        setLastSubmittedChoice(null);
        setPreviousSnapshot(null);
        setPlayerName(savedSnapshot.playerName);
        setModelPresetId(selectedModelPresetId);
        const normalizedGameState = normalizeGameState(savedSnapshot.gameState);
        setGameState(normalizedGameState);
        setStatusWindow(buildStatusWindow(normalizedGameState));
        setCurrentChoices(savedSnapshot.currentChoices);
        setBeats(savedSnapshot.beats);
        setInspirationArmed(false);
        setAttackFxEvent(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "API key setup failed.");
      }
    });
  };

  const handleSave = () => {
    if (!gameState || !playerName) return;

    startTransition(async () => {
      try {
        setSaveStatus("idle");
        const snapshot: SaveSnapshot = {
          ...buildSaveSnapshot(
            playerName,
            modelPresetId,
            gameState,
            beats,
            currentChoices
          ),
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
      ...buildSaveSnapshot(
        playerName,
        modelPresetId,
        gameState,
        beats,
        currentChoices
      ),
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
          gameState: normalizeGameState(parsed.gameState),
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
          modelPresetId,
        });
        const nextAttackFxEvent = createAttackFxEvent(
          submittedChoice.action,
          gameState,
          response
        );

        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setLastSubmittedChoice(null);
        setAttackFxEvent(nextAttackFxEvent);
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
          modelPresetId,
        });

        setGameState(response.gameState);
        setStatusWindow(response.statusWindow);
        setCurrentChoices(response.choices);
        setChoiceSubmitStatus("idle");
        setAttackFxEvent(null);
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
    setAttackFxEvent(null);
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
    <main className="play">
      <header className="topbar panel-shell">
        <h1 className="game-title">{playerName}의 던전 탐험</h1>
        <div className="topbar-actions">
          <span className="pill">{getModeLabel(gameState.mode)}</span>
          <span className="pill">{getPhaseLabel(gameState.phase)}</span>
          <button className="pill" onClick={handleSave} disabled={isPending}>
            {saveStatus === "saved"
              ? "Saved"
              : saveStatus === "error"
                ? "Save failed"
                : "Save"}
          </button>
          <button className="pill" onClick={handleExportSave} disabled={isPending}>
            Export
          </button>
          <button
            className="pill"
            onClick={handleBack}
            disabled={!previousSnapshot || choiceSubmitStatus === "submitting"}
          >
            뒤로가기
          </button>
        </div>
      </header>

      {error ? <div className="play-error">{error}</div> : null}

      <PartyHud status={statusWindow} onOpenDrawer={() => setDrawerOpen(true)} />

      <div className="stage">
        <ScriptStage
          beats={beats}
          monster={statusWindow.monster}
          isPending={isPending}
          logRef={logRef}
          attackFxEvent={attackFxEvent}
        />
        <CommandMenu
          choices={currentChoices}
          onSelect={handleChoice}
          onTalk={handleTalk}
          canTalk={canTalk}
          inspirationArmed={inspirationArmed}
          onToggleInspiration={() => setInspirationArmed((armed) => !armed)}
          inspiration={gameState.party.inspiration}
          disabled={choiceSubmitStatus === "submitting" || drawerOpen}
          emptyMessage={
            gameState.phase === "victory"
              ? "레드드래곤을 쓰러뜨렸습니다. 정복 엔딩이 출력된 상태입니다."
              : gameState.phase === "game_over"
                ? "파티가 전멸했습니다. 패배 엔딩이 출력된 상태입니다."
                : choiceSubmitStatus === "submitting"
                  ? "다음 선택지를 생성하고 있습니다."
                  : latestAssistantBeat?.eventSummary ?? undefined
          }
        />
      </div>

      <PartyDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        status={statusWindow}
        inventory={gameState.party.inventory}
        members={gameState.party.members}
        onUse={handleChoice}
        inventoryDisabled={
          choiceSubmitStatus === "submitting" ||
          gameState.phase === "victory" ||
          gameState.phase === "game_over"
        }
        onSave={handleSave}
        onExport={handleExportSave}
        saveStatus={saveStatus}
        actionsDisabled={isPending}
      />
    </main>
  );
}
