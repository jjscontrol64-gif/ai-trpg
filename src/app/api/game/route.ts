import { NextRequest, NextResponse } from "next/server";
import { GameState, PlayerAction, GameResponse } from "@/lib/types";
import { processAction, getAvailableDirections, getTalkBiasedActions } from "@/lib/engine";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { buildStatusWindow } from "@/lib/status";
import { createInitialState } from "@/lib/initial-state";
import {
  AIProviderModelNotFoundError,
  AIProviderQuotaError,
  AIProviderId,
  InvalidApiKeyError,
  MissingApiKeyError,
  TemporaryAIProviderError,
  createAIProvider,
  resolveAIModelPreset,
} from "@/lib/ai";
import { mapChoicesToActions, ModelChoice, normalizeActionIndex } from "@/lib/action-options";

type GameNarrationData = {
  narration: string;
  choices: ModelChoice[];
};

type ApiKeySession = {
  apiKey: string;
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
  expiresAt: number;
};

type ResolvedAIModel = {
  apiKey: string;
  apiKeySessionId: string;
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
};

const API_KEY_SESSION_TTL_MS = 30 * 60 * 1000;
const apiKeySessions = new Map<string, ApiKeySession>();

class UnknownAIModelPresetError extends Error {}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKeySessionId =
      typeof body.apiKeySessionId === "string" ? body.apiKeySessionId : "";
    const modelPresetId =
      typeof body.modelPresetId === "string" ? body.modelPresetId : "";

    if (
      type !== "start_game" &&
      type !== "player_action" &&
      type !== "talk"
    ) {
      return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }

    const resolvedAIModel = resolveAIModel(apiKey, apiKeySessionId, modelPresetId);

    if (type === "start_game") {
      return await handleStartGame(body.playerName, resolvedAIModel);
    }

    if (type === "player_action") {
      return await handlePlayerAction(
        body.gameState,
        body.action,
        body.choiceText,
        resolvedAIModel
      );
    }

    if (type === "talk") {
      return await handleTalk(body.gameState, resolvedAIModel);
    }

    return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  } catch (error) {
    console.error("Game API error:", error);
    if (isMissingApiKeyError(error)) {
      return NextResponse.json(
        { error: "AI provider API key is required." },
        { status: 400 }
      );
    }

    if (error instanceof UnknownAIModelPresetError) {
      return NextResponse.json(
        { error: "Unknown AI model preset." },
        { status: 400 }
      );
    }

    if (error instanceof InvalidApiKeyError) {
      return NextResponse.json(
        { error: "AI provider API key is invalid or unauthorized." },
        { status: 400 }
      );
    }

    if (error instanceof AIProviderQuotaError) {
      return NextResponse.json(
        { error: "AI provider quota or billing limit has been exceeded." },
        { status: 402 }
      );
    }

    if (error instanceof AIProviderModelNotFoundError) {
      return NextResponse.json(
        { error: "Selected AI model is unavailable or not enabled for this API key." },
        { status: 400 }
      );
    }

    if (isTemporaryAIProviderError(error)) {
      return NextResponse.json(
        {
          error:
            "AI provider is temporarily unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function resolveAIModel(
  apiKey: string,
  apiKeySessionId: string,
  modelPresetId: string
): ResolvedAIModel {
  if (apiKeySessionId) {
    const session = apiKeySessions.get(apiKeySessionId);
    if (session && session.expiresAt > Date.now()) {
      session.expiresAt = Date.now() + API_KEY_SESSION_TTL_MS;
      return {
        apiKey: session.apiKey,
        apiKeySessionId,
        modelPresetId: session.modelPresetId,
        provider: session.provider,
        model: session.model,
      };
    }

    apiKeySessions.delete(apiKeySessionId);
  }

  const preset = resolveAIModelPreset(modelPresetId);
  if (!preset) {
    throw new UnknownAIModelPresetError();
  }

  if (apiKey) {
    return {
      apiKey,
      apiKeySessionId: createApiKeySession(apiKey, preset.id),
      modelPresetId: preset.id,
      provider: preset.provider,
      model: preset.model,
    };
  }

  return {
    apiKey: "",
    apiKeySessionId: "",
    modelPresetId: preset.id,
    provider: preset.provider,
    model: preset.model,
  };
}

function createApiKeySession(apiKey: string, modelPresetId: string): string {
  pruneExpiredApiKeySessions();
  const preset = resolveAIModelPreset(modelPresetId);
  if (!preset) {
    throw new UnknownAIModelPresetError();
  }

  const sessionId = crypto.randomUUID();
  apiKeySessions.set(sessionId, {
    apiKey,
    modelPresetId: preset.id,
    provider: preset.provider,
    model: preset.model,
    expiresAt: Date.now() + API_KEY_SESSION_TTL_MS,
  });
  return sessionId;
}

function pruneExpiredApiKeySessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of apiKeySessions) {
    if (session.expiresAt <= now) {
      apiKeySessions.delete(sessionId);
    }
  }
}

function isMissingApiKeyError(error: unknown): boolean {
  return error instanceof MissingApiKeyError;
}

function isTemporaryAIProviderError(error: unknown): boolean {
  return error instanceof TemporaryAIProviderError;
}

async function handleStartGame(
  playerName: string,
  resolvedAIModel: ResolvedAIModel
): Promise<NextResponse> {
  const state = createInitialState(playerName);
  const directions = getAvailableDirections(state);

  const engineResult = {
    newState: state,
    eventSummary: `${playerName}(전사), 피나(도적), 미나(마법사)가 던전 입구(1층 C6)에 도착했다. 어두운 미궁이 앞에 펼쳐져 있다.`,
    nextActions: directions,
  };

  const systemPrompt = buildSystemPrompt(state);
  const userMessage = buildUserMessage(engineResult);

  const narrationData = await generateNarrationData(
    systemPrompt,
    [{ role: "user", content: userMessage }],
    resolvedAIModel
  );

  const choices = mapChoicesToActions(narrationData.choices, directions);
  const statusWindow = buildStatusWindow(state);

  const response: GameResponse = {
    narration: narrationData.narration,
    eventSummary: engineResult.eventSummary,
    choices,
    gameState: state,
    statusWindow,
    apiKeySessionId: resolvedAIModel.apiKeySessionId,
  };

  return NextResponse.json(response);
}

async function handleTalk(
  gameState: GameState,
  resolvedAIModel: ResolvedAIModel
): Promise<NextResponse> {
  if (
    !gameState ||
    gameState.combat.active ||
    gameState.phase === "combat" ||
    gameState.phase === "game_over" ||
    gameState.phase === "victory"
  ) {
    return NextResponse.json(
      { error: "대화하기는 비전투 진행 중에만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  const apiKeySessionId = resolvedAIModel.apiKeySessionId;
  const actions = getTalkBiasedActions(gameState);
  const engineResult = {
    newState: gameState,
    eventSummary: "동료들과 잠시 의견을 나누며 다음 행동을 다시 가늠한다.",
    nextActions: actions,
  };

  const systemPrompt = buildSystemPrompt(gameState);
  const history = gameState.messageHistory.slice(-10);
  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: buildUserMessage(engineResult, undefined, { talkBiased: true }),
    },
  ];

  const narrationData = await generateNarrationData(systemPrompt, messages, resolvedAIModel);
  const choices = mapChoicesToActions(narrationData.choices, actions);

  return NextResponse.json({
    narration: narrationData.narration,
    eventSummary: engineResult.eventSummary,
    choices,
    gameState,
    statusWindow: buildStatusWindow(gameState),
    apiKeySessionId,
  } satisfies GameResponse);
}

async function handlePlayerAction(
  gameState: GameState,
  action: PlayerAction,
  choiceText?: string,
  resolvedAIModel?: ResolvedAIModel
): Promise<NextResponse> {
  if (!resolvedAIModel) {
    throw new UnknownAIModelPresetError();
  }

  const apiKeySessionId = resolvedAIModel.apiKeySessionId;
  const engineResult = processAction(gameState, action);
  const { newState } = engineResult;

  if (newState.phase === "game_over") {
    const endNarration = await getEndingNarration(newState, "defeat", resolvedAIModel, choiceText);
    return NextResponse.json({
      narration: endNarration,
      eventSummary: engineResult.eventSummary,
      choices: [],
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
      apiKeySessionId,
    } satisfies GameResponse);
  }

  if (newState.phase === "victory") {
    const endNarration = await getEndingNarration(newState, "victory", resolvedAIModel, choiceText);
    return NextResponse.json({
      narration: endNarration,
      eventSummary: engineResult.eventSummary,
      choices: [],
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
      apiKeySessionId,
    } satisfies GameResponse);
  }

  const systemPrompt = buildSystemPrompt(newState);

  const history = newState.messageHistory.slice(-10);
  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: buildUserMessage(engineResult, choiceText) },
  ];

  const narrationData = await generateNarrationData(systemPrompt, messages, resolvedAIModel);

  newState.messageHistory.push(
    { role: "user", content: choiceText || engineResult.eventSummary },
    { role: "assistant", content: narrationData.narration }
  );

  if (newState.messageHistory.length > 20) {
    newState.messageHistory = newState.messageHistory.slice(-20);
  }

  const choices = mapChoicesToActions(
    narrationData.choices,
    engineResult.nextActions
  );
  const statusWindow = buildStatusWindow(newState);

  const response: GameResponse = {
    narration: narrationData.narration,
    eventSummary: engineResult.eventSummary,
    diceResult: engineResult.diceResult,
    choices,
    gameState: newState,
    statusWindow,
    apiKeySessionId,
  };

  return NextResponse.json(response);
}

async function generateNarrationData(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  resolvedAIModel: ResolvedAIModel
): Promise<GameNarrationData> {
  const aiProvider = createAIProvider(resolvedAIModel.provider);
  const text = await aiProvider.generateText(systemPrompt, messages, {
    apiKey: resolvedAIModel.apiKey,
    model: resolvedAIModel.model,
    json: true,
  });

  const parsed = parseNarrationData(text);
  if (parsed) {
    return parsed;
  }

  return {
    narration: normalizeNarrationText(text),
    choices: fallbackChoices(),
  };
}

function parseNarrationData(text: string): GameNarrationData | null {
  const jsonText = extractJsonObject(text);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText) as Partial<GameNarrationData>;
      if (typeof parsed.narration === "string") {
        return {
          narration: normalizeNarrationText(parsed.narration),
          choices: normalizeChoices(parsed.choices),
        };
      }
    } catch {
      // Fall through to partial JSON recovery.
    }
  }

  const partialNarration = extractPartialJsonString(text, "narration");
  if (partialNarration) {
    return {
      narration: normalizeNarrationText(partialNarration),
      choices: fallbackChoices(),
    };
  }

  return null;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function extractPartialJsonString(text: string, key: string): string | null {
  const keyIndex = text.indexOf('"' + key + '"');
  if (keyIndex < 0) return null;

  const colonIndex = text.indexOf(":", keyIndex);
  if (colonIndex < 0) return null;

  const quoteIndex = text.indexOf('"', colonIndex + 1);
  if (quoteIndex < 0) return null;

  let value = "";
  let escaped = false;

  for (let index = quoteIndex + 1; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      value += "\\" + char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      break;
    }

    value += char;
  }

  return decodeJsonStringValue(value);
}

function decodeJsonStringValue(value: string): string {
  const safeValue = value.endsWith("\\") ? value.slice(0, -1) : value;

  try {
    return JSON.parse('"' + safeValue.replace(/"/g, '\\"') + '"');
  } catch {
    return safeValue;
  }
}

function normalizeNarrationText(text: string): string {
  return text
    .replace(/^\s*\{?\s*"narration"\s*:\s*"?/, "")
    .replace(/",?\s*"choices"[\s\S]*$/, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeChoices(
  choices: GameNarrationData["choices"] | undefined
): GameNarrationData["choices"] {
  if (!Array.isArray(choices) || choices.length === 0) {
    return fallbackChoices();
  }

  const normalized = choices
    .filter(
      (choice) =>
        typeof choice?.label === "string" && typeof choice?.text === "string"
    )
    .map((choice) => ({
      label: choice.label,
      text: choice.text,
      actionIndex: normalizeActionIndex(choice.actionIndex),
    }))
    .slice(0, 3);

  return normalized.length > 0 ? normalized : fallbackChoices();
}

function fallbackChoices(): GameNarrationData["choices"] {
  return [
    { label: "\uacc4\uc18d \ud0d0\ud5d8", text: "\uc8fc\uc704\ub97c \ub458\ub7ec\ubcf8\ub2e4" },
    { label: "\uc870\uc2ec\ud788 \uc804\uc9c4", text: "\ubb34\uae30\ub97c \uc900\ube44\ud558\uace0 \ucc9c\ucc9c\ud788 \uc804\uc9c4\ud55c\ub2e4" },
    { label: "\uc8fc\ubcc0 \ud0d0\uc0c9", text: "\uc8fc\ubcc0\uc744 \uc790\uc138\ud788 \uc0b4\ud540\ub2e4" },
  ];
}

async function getEndingNarration(
  state: GameState,
  type: "victory" | "defeat",
  resolvedAIModel: ResolvedAIModel,
  lastAction?: string
): Promise<string> {
  const systemPrompt = type === "victory"
    ? `당신은 TRPG 게임 마스터입니다. 정복 엔딩을 연출하세요.
레드드래곤을 물리친 후, 시점이 TRPG 테이블로 전환됩니다.
피나와 미나가 환호성을 지르고, 간식을 먹으며 오늘 세션의 하이라이트를 떠드는 장면으로 마무리하세요.
고풍스러운 판타지 문체에서 현실의 따뜻한 톤으로 자연스럽게 전환하세요.`
    : `당신은 TRPG 게임 마스터입니다. 패배 엔딩을 연출하세요.
파티가 전멸했습니다. 시점이 TRPG 테이블로 전환됩니다.
세션을 마친 피나·미나가 후기를 나누며 훈훈하게 마무리하는 장면을 그려주세요.
패배는 부정적 종결이 아닌 TRPG 경험의 일부임을 느끼게 해주세요.`;

  const aiProvider = createAIProvider(resolvedAIModel.provider);

  return aiProvider.generateText(systemPrompt, [
    {
      role: "user",
      content: `전사: ${state.party.members[0].name}, 현재 ${state.party.floor}층. ${lastAction || ""}. 엔딩 나레이션을 해주세요. 텍스트만 반환하세요 (JSON 아님).`,
    },
  ], {
    apiKey: resolvedAIModel.apiKey,
    model: resolvedAIModel.model,
    json: false,
  });

}
