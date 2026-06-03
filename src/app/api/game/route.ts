import { NextRequest, NextResponse } from "next/server";
import { ChoiceOption, GameState, PlayerAction, GameResponse, DifficultyMode } from "@/lib/types";
import { processAction, getAvailableDirections, getTalkBiasedActions } from "@/lib/engine";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { buildStatusWindow } from "@/lib/status";
import { createInitialState } from "@/lib/initial-state";
import { normalizeGameState } from "@/lib/state-normalization";
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
const API_KEY_SESSION_COOKIE = "ai_trpg_api_key_session";
const SECURE_API_KEY_SESSION_COOKIE = "__Host-ai_trpg_api_key_session";
const AI_PROMPT_HISTORY_LIMIT = 10;
const apiKeySessions = new Map<string, ApiKeySession>();

class UnknownAIModelPresetError extends Error {}

export function GET(req: NextRequest) {
  pruneExpiredApiKeySessions();

  const session = getApiKeySession(req);
  if (!session) {
    const response = NextResponse.json({ authenticated: false });
    deleteApiKeySessionCookies(response);
    return response;
  }

  session.data.expiresAt = Date.now() + API_KEY_SESSION_TTL_MS;

  return withApiKeySessionCookie(
    NextResponse.json({
      authenticated: true,
      modelPresetId: session.data.modelPresetId,
      provider: session.data.provider,
      model: session.data.model,
    }),
    req,
    {
      apiKey: session.data.apiKey,
      apiKeySessionId: session.id,
      modelPresetId: session.data.modelPresetId,
      provider: session.data.provider,
      model: session.data.model,
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const modelPresetId =
      typeof body.modelPresetId === "string" ? body.modelPresetId : "";

    if (
      type !== "configure_api_key" &&
      type !== "start_game" &&
      type !== "player_action" &&
      type !== "talk"
    ) {
      return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
    }

    const resolvedAIModel = resolveAIModel(req, apiKey, modelPresetId);

    if (type === "configure_api_key") {
      return withApiKeySessionCookie(
        NextResponse.json({ ok: true }),
        req,
        resolvedAIModel
      );
    }

    if (type === "start_game") {
      return withApiKeySessionCookie(
        await handleStartGame(
          body.playerName,
          parseDifficulty(body.difficulty),
          resolvedAIModel
        ),
        req,
        resolvedAIModel
      );
    }

    if (type === "player_action") {
      return withApiKeySessionCookie(
        await handlePlayerAction(
          body.gameState,
          body.action,
          body.choiceText,
          resolvedAIModel
        ),
        req,
        resolvedAIModel
      );
    }

    if (type === "talk") {
      return withApiKeySessionCookie(
        await handleTalk(body.gameState, resolvedAIModel),
        req,
        resolvedAIModel
      );
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
  req: NextRequest,
  apiKey: string,
  modelPresetId: string
): ResolvedAIModel {
  if (apiKey) {
    const preset = resolveAIModelPreset(modelPresetId);
    if (!preset) {
      throw new UnknownAIModelPresetError();
    }

    return {
      apiKey,
      apiKeySessionId: createApiKeySession(apiKey, preset.id),
      modelPresetId: preset.id,
      provider: preset.provider,
      model: preset.model,
    };
  }

  const session = getApiKeySession(req);
  if (session) {
    session.data.expiresAt = Date.now() + API_KEY_SESSION_TTL_MS;
    return {
      apiKey: session.data.apiKey,
      apiKeySessionId: session.id,
      modelPresetId: session.data.modelPresetId,
      provider: session.data.provider,
      model: session.data.model,
    };
  }

  const preset = resolveAIModelPreset(modelPresetId);
  if (!preset) {
    throw new UnknownAIModelPresetError();
  }

  return {
    apiKey: "",
    apiKeySessionId: "",
    modelPresetId: preset.id,
    provider: preset.provider,
    model: preset.model,
  };
}

function withApiKeySessionCookie(
  response: NextResponse,
  req: NextRequest,
  resolvedAIModel: ResolvedAIModel
): NextResponse {
  if (!resolvedAIModel.apiKeySessionId) {
    return response;
  }

  const secure = isSecureRequest(req);
  response.cookies.set(getApiKeySessionCookieName(req), resolvedAIModel.apiKeySessionId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: API_KEY_SESSION_TTL_MS / 1000,
  });

  return response;
}

function getApiKeySession(
  req: NextRequest
): { id: string; data: ApiKeySession } | null {
  const sessionId =
    req.cookies.get(getApiKeySessionCookieName(req))?.value ??
    req.cookies.get(API_KEY_SESSION_COOKIE)?.value ??
    req.cookies.get(SECURE_API_KEY_SESSION_COOKIE)?.value ??
    "";
  if (!sessionId) {
    return null;
  }

  const session = apiKeySessions.get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    apiKeySessions.delete(sessionId);
    return null;
  }

  return { id: sessionId, data: session };
}

function getApiKeySessionCookieName(req: NextRequest): string {
  return isSecureRequest(req)
    ? SECURE_API_KEY_SESSION_COOKIE
    : API_KEY_SESSION_COOKIE;
}

function isSecureRequest(req: NextRequest): boolean {
  const forwardedProto = req.headers.get("x-forwarded-proto");
  return forwardedProto === "https" || req.nextUrl.protocol === "https:";
}

function deleteApiKeySessionCookies(response: NextResponse): void {
  response.cookies.delete(API_KEY_SESSION_COOKIE);
  response.cookies.delete(SECURE_API_KEY_SESSION_COOKIE);
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

function parseDifficulty(value: unknown): DifficultyMode {
  return value === "easy" || value === "hard" ? value : "normal";
}

async function handleStartGame(
  playerName: string,
  difficulty: DifficultyMode,
  resolvedAIModel: ResolvedAIModel
): Promise<NextResponse> {
  const state = createInitialState(playerName, difficulty);
  const directions = getAvailableDirections(state);

  const engineResult = {
    newState: state,
    eventSummary: `${playerName}(전사), 에이미(도적), 실루엘라(마법사)가 던전 입구(1층 C6)에 도착했다. 어두운 미궁이 앞에 펼쳐져 있다.`,
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
  };

  return NextResponse.json(response);
}

async function handleTalk(
  gameState: GameState,
  resolvedAIModel: ResolvedAIModel
): Promise<NextResponse> {
  if (!gameState) {
    return NextResponse.json(
      { error: "대화하기는 비전투 진행 중에만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  const normalizedState = normalizeGameState(gameState);
  if (
    normalizedState.combat.active ||
    normalizedState.phase === "combat" ||
    normalizedState.phase === "game_over" ||
    normalizedState.phase === "victory"
  ) {
    return NextResponse.json(
      { error: "대화하기는 비전투 진행 중에만 사용할 수 있습니다." },
      { status: 400 }
    );
  }

  const actions = getTalkBiasedActions(normalizedState);
  const engineResult = {
    newState: normalizedState,
    eventSummary: "동료들과 잠시 의견을 나누며 다음 행동을 다시 가늠한다.",
    nextActions: actions,
  };

  const systemPrompt = buildSystemPrompt(normalizedState);
  const history = normalizedState.messageHistory.slice(-AI_PROMPT_HISTORY_LIMIT);
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
    gameState: normalizedState,
    statusWindow: buildStatusWindow(normalizedState),
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
  if (!gameState) {
    return NextResponse.json({ error: "Invalid game state" }, { status: 400 });
  }

  const normalizedState = normalizeGameState(gameState);
  const engineResult = processAction(normalizedState, action);
  const { newState } = engineResult;

  if (action.type === "ending_choice") {
    const endingNarration = await getEndingChoiceNarration(
      newState,
      action.choiceId,
      resolvedAIModel,
      choiceText
    );
    return NextResponse.json({
      narration: endingNarration,
      eventSummary: engineResult.eventSummary,
      choices: [],
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
    } satisfies GameResponse);
  }

  if (newState.phase === "game_over") {
    const endNarration = await getEndingNarration(newState, "defeat", resolvedAIModel, choiceText);
    return NextResponse.json({
      narration: endNarration,
      eventSummary: engineResult.eventSummary,
      choices: [],
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
    } satisfies GameResponse);
  }

  if (newState.phase === "victory") {
    const endNarration = await getEndingNarration(newState, "victory", resolvedAIModel, choiceText);
    const choices = buildEndingChoices(newState);
    return NextResponse.json({
      narration: endNarration,
      eventSummary: engineResult.eventSummary,
      choices,
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
    } satisfies GameResponse);
  }

  const systemPrompt = buildSystemPrompt(newState);

  const history = newState.messageHistory.slice(-AI_PROMPT_HISTORY_LIMIT);
  const messages = [
    ...history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user" as const,
      content: buildUserMessage(
        engineResult,
        choiceText,
        action.type === "affinity_talk"
          ? { affinityTalk: { target: action.target } }
          : {}
      ),
    },
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
  const affinity = state.party.affinity;
  const systemPrompt = type === "victory"
    ? `당신은 TRPG 게임 마스터입니다. 정복 엔딩을 연출하세요.
레드드래곤을 물리친 후, 시점이 TRPG 테이블로 전환됩니다.
에이미와 실루엘라가 환호성을 지르고, 간식을 먹으며 오늘 세션의 하이라이트를 떠드는 장면으로 마무리하세요.
동료 호감도는 에이미 ${affinity.pina}단계, 실루엘라 ${affinity.mina}단계입니다. 높은 호감도는 동료 유대의 따뜻한 뉘앙스로만 반영하세요.
고풍스러운 판타지 문체에서 현실의 따뜻한 톤으로 자연스럽게 전환하세요.`
    : `당신은 TRPG 게임 마스터입니다. 패배 엔딩을 연출하세요.
파티가 전멸했습니다. 시점이 TRPG 테이블로 전환됩니다.
세션을 마친 에이미·실루엘라가 후기를 나누며 훈훈하게 마무리하는 장면을 그려주세요.
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

function buildEndingChoices(state: GameState): ChoiceOption[] {
  const choices: ChoiceOption[] = [];
  const { affinity } = state.party;

  if (affinity.pina >= 3) {
    choices.push({
      label: "🗡️ 에이미 — 약속의 후일담",
      text: "에이미와 오늘 모험 뒤의 약속을 나눈다.",
      action: { type: "ending_choice", choiceId: "pina_promise" },
    });
  }

  if (affinity.mina >= 3) {
    choices.push({
      label: "🔮 실루엘라 — 조용한 후일담",
      text: "실루엘라와 세션이 남긴 의미를 차분히 되짚는다.",
      action: { type: "ending_choice", choiceId: "mina_reflection" },
    });
  }

  choices.push({
    label: "🎲 모두 — 세션 마무리",
    text: "에이미와 실루엘라와 함께 오늘의 세션을 따뜻하게 마무리한다.",
    action: { type: "ending_choice", choiceId: "shared_table" },
  });

  return choices.slice(0, 3);
}

async function getEndingChoiceNarration(
  state: GameState,
  choiceId: string,
  resolvedAIModel: ResolvedAIModel,
  lastAction?: string
): Promise<string> {
  const focus = {
    pina_promise:
      "에이미가 활기찬 말투로 다음 모험의 약속을 꺼내고, 플레이어와 쌓은 신뢰가 동료 유대로 드러나는 후일담",
    mina_reflection:
      "실루엘라가 차분한 존댓말로 오늘 세션의 의미를 정리하고, 플레이어에게 조용한 신뢰를 표현하는 후일담",
    shared_table:
      "에이미와 실루엘라가 함께 오늘의 하이라이트를 되짚으며 테이블을 정리하는 공통 후일담",
  }[choiceId] ?? "파티가 함께 정복 세션을 마무리하는 공통 후일담";

  const systemPrompt = `당신은 TRPG 게임 마스터입니다. 정복 엔딩 이후의 짧은 후일담 에필로그를 작성하세요.
선택된 후일담: ${focus}.
동료 호감도는 에이미 ${state.party.affinity.pina}단계, 실루엘라 ${state.party.affinity.mina}단계입니다.
세계관 톤은 클래식 왕도 JRPG 풍의 동료 유대로 유지하고, 과한 연애 묘사는 피하세요.
텍스트만 반환하세요. JSON은 반환하지 마세요.`;

  const aiProvider = createAIProvider(resolvedAIModel.provider);
  return aiProvider.generateText(
    systemPrompt,
    [
      {
        role: "user",
        content: `전사: ${state.party.members[0].name}. 플레이어 선택: ${lastAction || choiceId}. 2~4문단의 후일담을 작성하세요.`,
      },
    ],
    {
      apiKey: resolvedAIModel.apiKey,
      model: resolvedAIModel.model,
      json: false,
    }
  );
}
