import { GameState, EngineResult, PlayerAction } from "./types";
import { getDirectionLabel } from "./engine/movement";

export function buildSystemPrompt(state: GameState): string {
  const { party } = state;
  const [warrior, pina, mina] = party.members;

  return `당신은 톨킨 풍 중세 판타지 세계의 게임 마스터(GM)입니다.
자연스러운 한국어로, 고풍스럽고 서사적인 문체로 내레이션하세요.

## 등장 캐릭터
- 전사 "${warrior.name}" (플레이어): 용맹한 전사. 파티의 리더.
- 피나 (도적): 수다스럽고 활기찬 분위기메이커. 오렌지빛 단발, 푸른 눈. ENFP. 말투: 밝고 경쾌, 반말.
- 미나 (마법사): 이지적이고 침착한 마법사. 긴 은발, 푸른 눈. INTJ. 말투: 차분하고 논리적, 존댓말.

## 문체 지침
- 환경 묘사는 생생하고 감각적으로.
- 피나와 미나는 상황에 맞게 자연스럽게 대화에 참여시키세요.
- 전투 시 긴박감 있게, 탐험 시 신비롭게.
- 다이스 판정 결과에 맞는 극적인 묘사를 하세요.

## 현재 게임 상태
- 층: ${party.floor}층
- 위치: ${party.position.col}${party.position.row}
- 영감: ${"★".repeat(party.inspiration)}${"☆".repeat(3 - party.inspiration)}
- 전투 중: ${state.combat.active ? "예" : "아니오"}
${state.combat.monster ? `- 몬스터: ${state.combat.monster.name} (HP: ${state.combat.monster.hp}/${state.combat.monster.maxHp})` : ""}

## 파티 상태
- ${warrior.name} (전사): HP ${warrior.hp}/${warrior.maxHp}
- 피나 (도적): HP ${pina.hp}/${pina.maxHp}
- 미나 (마법사): HP ${mina.hp}/${mina.maxHp}

## 응답 규칙
1. narration: 내레이션 텍스트. 피나·미나의 대사를 자연스럽게 포함.
2. choices: 정확히 3개의 선택지를 생성. 각 선택지는 label(짧은 키워드)과 text(시도 묘사문).
3. 선택지는 제공된 availableActions 목록에 대응해야 합니다.
4. JSON 형식으로만 응답하세요.

## 응답 형식 (JSON만, 다른 텍스트 없이)
{
  "narration": "내레이션 텍스트",
  "choices": [
    { "label": "🧭 선택지 키워드", "text": "시도 묘사문" },
    { "label": "⚔️ 선택지 키워드", "text": "시도 묘사문" },
    { "label": "🛡️ 선택지 키워드", "text": "시도 묘사문" }
  ]
}`;
}

export function buildUserMessage(
  engineResult: EngineResult,
  previousChoice?: string
): string {
  let msg = "";

  if (previousChoice) {
    msg += `[플레이어 행동] ${previousChoice}\n\n`;
  }

  msg += `[엔진 결과] ${engineResult.eventSummary}\n`;

  if (engineResult.diceResult) {
    const d = engineResult.diceResult;
    msg += `\n[다이스] 1d36(${d.raw})`;
    if (!d.isUnorthodox) {
      msg += ` + 스탯(${d.stat})`;
      if (d.inspirationBonus > 0) msg += ` + 영감(+${d.inspirationBonus})`;
      msg += ` = ${d.total}`;
    }
    msg += ` → ${judgmentLabel(d.judgment)}`;
    msg += `\n[모드] ${d.mode}`;
  }

  msg += `\n\n[가능한 행동]\n`;
  const actions = engineResult.nextActions.slice(0, 6);
  for (let i = 0; i < actions.length; i++) {
    msg += `${i + 1}. ${describeAction(actions[i])}\n`;
  }

  msg += `\n위 행동들 중에서 3개를 선택지로 만들어주세요. 나머지는 나레이션에 자연스럽게 녹여주세요.`;

  return msg;
}

function judgmentLabel(j: string): string {
  const labels: Record<string, string> = {
    critical_success: "대성공",
    success: "성공",
    failure: "실패",
    critical_failure: "대실패",
  };
  return labels[j] || j;
}

function describeAction(action: PlayerAction): string {
  switch (action.type) {
    case "move":
      return `${getDirectionLabel(action.direction)}으로 이동`;
    case "attack":
      return `공격 (캐릭터 ${action.characterIndex})${action.useInspiration ? " [영감 사용]" : ""}`;
    case "special_action":
      return `${action.actionName} 사용 (캐릭터 ${action.characterIndex})`;
    case "flee":
      return action.useSmokeBomb ? "연막탄으로 도주" : "도주 시도";
    case "use_item":
      return `아이템 사용 (${action.itemId})`;
    case "rest":
      return "휴식";
    case "puzzle_attempt":
      return `수수께끼 도전 (${action.stat}, 캐릭터 ${action.characterIndex})`;
    case "trap_attempt":
      return `함정 돌파 (${action.stat}, 캐릭터 ${action.characterIndex})`;
    case "npc_interact":
      return "린린과 대화";
    case "pathfinding":
      return "패스파인딩";
    case "alchemy":
      return "연금생성";
    default:
      return "알 수 없는 행동";
  }
}
