import { NextRequest, NextResponse } from "next/server";
import { GameState, PlayerAction, GameResponse, ChoiceOption } from "@/lib/types";
import { processAction, getAvailableDirections } from "@/lib/engine";
import { buildSystemPrompt, buildUserMessage } from "@/lib/prompt";
import { buildStatusWindow } from "@/lib/status";
import { createInitialState } from "@/lib/initial-state";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

type GeminiRole = "user" | "model";
type GameNarrationData = {
  narration: string;
  choices: { label: string; text: string }[];
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type } = body;

    if (type === "start_game") {
      return handleStartGame(body.playerName);
    }

    if (type === "player_action") {
      return handlePlayerAction(body.gameState, body.action, body.choiceText);
    }

    return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  } catch (error) {
    console.error("Game API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleStartGame(playerName: string): Promise<NextResponse> {
  const state = createInitialState(playerName);
  const directions = getAvailableDirections(state);

  const engineResult = {
    newState: state,
    eventSummary: `${playerName}(전사), 피나(도적), 미나(마법사)가 던전 입구(1층 C6)에 도착했다. 어두운 미궁이 앞에 펼쳐져 있다.`,
    nextActions: directions,
  };

  const systemPrompt = buildSystemPrompt(state);
  const userMessage = buildUserMessage(engineResult);

  const narrationData = await callGemini(
    systemPrompt,
    [{ role: "user", content: userMessage }]
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

async function handlePlayerAction(
  gameState: GameState,
  action: PlayerAction,
  choiceText?: string
): Promise<NextResponse> {
  const engineResult = processAction(gameState, action);
  const { newState } = engineResult;

  if (newState.phase === "game_over") {
    const endNarration = await getEndingNarration(newState, "defeat", choiceText);
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
    const endNarration = await getEndingNarration(newState, "victory", choiceText);
    return NextResponse.json({
      narration: endNarration,
      eventSummary: engineResult.eventSummary,
      choices: [],
      gameState: newState,
      statusWindow: buildStatusWindow(newState),
      diceResult: engineResult.diceResult,
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

  const narrationData = await callGemini(systemPrompt, messages);

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

async function callGemini(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<GameNarrationData> {
  const text = await generateGeminiText(systemPrompt, messages, {
    responseMimeType: "application/json",
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch {
    // JSON 파싱 실패 시 텍스트 그대로 반환
  }

  return {
    narration: text,
    choices: [
      { label: "계속 탐험", text: "주위를 둘러본다" },
      { label: "경계하며 전진", text: "무기를 꺼내들고 조심스럽게 전진한다" },
      { label: "주변 탐색", text: "주변을 자세히 살핀다" },
    ],
  };
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

async function generateGeminiText(
  systemPrompt: string,
  messages: { role: "user" | "assistant"; content: string }[],
  options?: { responseMimeType?: "application/json" | "text/plain" }
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `${GEMINI_API_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: messages.map((message) => ({
          role: toGeminiRole(message.role),
          parts: [{ text: message.content }],
        })),
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.8,
          responseMimeType: options?.responseMimeType ?? "text/plain",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text ?? "")
    .join("");

  if (!text) {
    throw new Error("Gemini API returned empty response");
  }

  return text;
}

function toGeminiRole(role: "user" | "assistant"): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

async function getEndingNarration(
  state: GameState,
  type: "victory" | "defeat",
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

  return generateGeminiText(systemPrompt, [
    {
      role: "user",
      content: `전사: ${state.party.members[0].name}, 현재 ${state.party.floor}층. ${lastAction || ""}. 엔딩 나레이션을 해주세요. 텍스트만 반환하세요 (JSON 아님).`,
    },
  ]);

}
