import { NextRequest, NextResponse } from "next/server";
import { GameState, PlayerAction, GameResponse, ChoiceOption } from "@/lib/types";
import { processAction, getAvailableDirections } from "@/lib/engine";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { buildStatusWindow } from "@/lib/status";
import { createInitialState } from "@/lib/initial-state";
import { createAIProvider } from "@/lib/ai";

type GameNarrationData = {
  narration: string;
  choices: { label: string; text: string }[];
};

type ApiKeySession = {
  apiKey: string;
  expiresAt: number;
};

type ResolvedApiKey = {
  apiKey: string;
  apiKeySessionId: string;
};

const aiProvider = createAIProvider();
const API_KEY_SESSION_TTL_MS = 30 * 60 * 1000;
const apiKeySessions = new Map<string, ApiKeySession>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const apiKeySessionId =
      typeof body.apiKeySessionId === "string" ? body.apiKeySessionId : "";
    const resolvedApiKey = resolveApiKey(apiKey, apiKeySessionId);

    if (type === "start_game") {
      return handleStartGame(body.playerName, resolvedApiKey);
    }

    if (type === "player_action") {
      return handlePlayerAction(
        body.gameState,
        body.action,
        body.choiceText,
        resolvedApiKey
      );
    }

    return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  } catch (error) {
    console.error("Game API error:", error);
    if (isMissingApiKeyError(error)) {
      return NextResponse.json(
        { error: "Gemini API key is required." },
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

function resolveApiKey(apiKey: string, apiKeySessionId: string): ResolvedApiKey {
  if (apiKey) {
    return {
      apiKey,
      apiKeySessionId: createApiKeySession(apiKey),
    };
  }

  if (apiKeySessionId) {
    const session = apiKeySessions.get(apiKeySessionId);
    if (session && session.expiresAt > Date.now()) {
      session.expiresAt = Date.now() + API_KEY_SESSION_TTL_MS;
      return {
        apiKey: session.apiKey,
        apiKeySessionId,
      };
    }

    apiKeySessions.delete(apiKeySessionId);
  }

  return {
    apiKey: "",
    apiKeySessionId: "",
  };
}

function createApiKeySession(apiKey: string): string {
  pruneExpiredApiKeySessions();
  const sessionId = crypto.randomUUID();
  apiKeySessions.set(sessionId, {
    apiKey,
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
  return (
    error instanceof Error &&
    error.message === "Gemini API key is required for this request"
  );
}

function isTemporaryAIProviderError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("Gemini API request failed (429)") ||
    error.message.includes("Gemini API request failed (503)")
  );
}

async function handleStartGame(
  playerName: string,
  resolvedApiKey: ResolvedApiKey
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
    resolvedApiKey.apiKey
  );

  const choices = mapChoicesToActions(narrationData.choices, directions);
  const statusWindow = buildStatusWindow(state);

  const response: GameResponse = {
    narration: narrationData.narration,
    eventSummary: engineResult.eventSummary,
    choices,
    gameState: state,
    statusWindow,
    apiKeySessionId: resolvedApiKey.apiKeySessionId,
  };

  return NextResponse.json(response);
}

async function handlePlayerAction(
  gameState: GameState,
  action: PlayerAction,
  choiceText?: string,
  resolvedApiKey?: ResolvedApiKey
): Promise<NextResponse> {
  const apiKey = resolvedApiKey?.apiKey;
  const apiKeySessionId = resolvedApiKey?.apiKeySessionId;
  const engineResult = processAction(gameState, action);
  const { newState } = engineResult;

  if (newState.phase === "game_over") {
    const endNarration = await getEndingNarration(newState, "defeat", choiceText, apiKey);
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
    const endNarration = await getEndingNarration(newState, "victory", choiceText, apiKey);
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

  const narrationData = await generateNarrationData(systemPrompt, messages, apiKey);

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
  apiKey?: string
): Promise<GameNarrationData> {
  const text = await aiProvider.generateText(systemPrompt, messages, {
    apiKey,
    responseMimeType: "application/json",
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

function mapChoicesToActions(
  modelChoices: { label: string; text: string }[],
  availableActions: PlayerAction[]
): ChoiceOption[] {
  return modelChoices.slice(0, 3).map((choice, idx) => ({
    label: choice.label,
    text: choice.text,
    action: availableActions[idx % availableActions.length] ?? availableActions[0],
  }));
}

async function getEndingNarration(
  state: GameState,
  type: "victory" | "defeat",
  lastAction?: string,
  apiKey?: string
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

  return aiProvider.generateText(systemPrompt, [
    {
      role: "user",
      content: `전사: ${state.party.members[0].name}, 현재 ${state.party.floor}층. ${lastAction || ""}. 엔딩 나레이션을 해주세요. 텍스트만 반환하세요 (JSON 아님).`,
    },
  ], { apiKey });

}
