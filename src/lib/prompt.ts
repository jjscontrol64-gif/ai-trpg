import { GameState, EngineResult, PlayerAction, DifficultyMode } from "./types";
import { MAX_PROMPT_ACTIONS } from "./action-options";
import { getDirectionLabel } from "./engine/movement";

const MODE_LABELS: Record<DifficultyMode, string> = {
  easy: "😎 이지",
  normal: "📜 노말",
  hard: "🔥 하드",
};

export function buildSystemPrompt(state: GameState): string {
  const { party } = state;
  const [warrior, pina, mina] = party.members;

  return `당신은 클래식 왕도 JRPG 풍 중세 판타지 세계의 게임 마스터(GM)입니다.
플레이어가 콘솔 RPG 게임의 주인공이 된 듯한 몰입감을 주는 것이 당신의 역할입니다.

## 등장 캐릭터
- 전사 "${warrior.name}" (플레이어): 용맹한 전사. 파티의 리더.
- 피나 (도적): 수다스럽고 활기찬 분위기메이커. 오렌지빛 단발, 푸른 눈. ENFP. 말투: 밝고 경쾌, 반말.
- 미나 (마법사): 이지적이고 침착한 마법사. 긴 은발, 푸른 눈. INTJ. 말투: 차분하고 논리적, 존댓말.
- 린린 (NPC, 마법사): 소심하고 예의바른 성격. 보랏빛 장발, 보랏빛 눈동자, 마녀 모자와 로브 차림. ISFJ. 말투: 조심스럽고 공손한 존댓말. 2층 특정 지점에서만 일회성으로 등장하는 NPC이므로, 린린과 만나는 상황에서만 묘사·등장시키세요.

## 문체 지침
- 환경 묘사는 생생하고 감각적으로.
- 피나와 미나는 상황에 맞게 자연스럽게 대화에 참여시키세요.
- 전투 시 긴박감 있게, 탐험 시 신비롭게.
- 다이스 판정 결과에 맞는 극적인 묘사를 하세요.

## 현재 게임 상태
- 난이도: ${MODE_LABELS[state.mode]}
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
2. choices: 정확히 3개의 선택지를 생성. 각 선택지는 actionIndex(아래 가능한 행동의 actionIndex 숫자), label(짧은 키워드), text(시도 묘사문)를 포함.
3. label 앞의 이모지는 매 선택지마다 그 행동의 성격에 어울리는 것을 골라 붙이세요. 아래 예시의 🧭/⚔️/🛡️는 형식 참고일 뿐이니 그대로 고정해 반복하지 마세요.
4. 선택지는 제공된 가능한 행동 목록에 대응해야 하며, actionIndex는 반드시 선택한 행동의 값을 그대로 사용하세요.
5. JSON 형식으로만 응답하세요.

## 응답 형식 (JSON만, 다른 텍스트 없이)
{
  "narration": "내레이션 텍스트",
  "choices": [
    { "actionIndex": 0, "label": "🧭 선택지 키워드", "text": "시도 묘사문" },
    { "actionIndex": 1, "label": "⚔️ 선택지 키워드", "text": "시도 묘사문" },
    { "actionIndex": 2, "label": "🛡️ 선택지 키워드", "text": "시도 묘사문" }
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
    msg += `\n[다이스] 1d20(${d.raw})`;
    if (!d.isUnorthodox) {
      msg += ` + 스탯(${d.stat})`;
      if (d.inspirationBonus > 0) msg += ` + 영감(+${d.inspirationBonus})`;
      msg += ` = ${d.total}`;
    }
    msg += ` → ${judgmentLabel(d.judgment)}`;
    msg += `\n[모드] ${d.mode}`;
  }

  msg += `\n\n[가능한 행동]\n`;
  const actions = engineResult.nextActions.slice(0, MAX_PROMPT_ACTIONS);
  for (let i = 0; i < actions.length; i++) {
    msg += `actionIndex=${i}: ${describeAction(actions[i])}\n`;
  }

  msg += `\n위 행동들 중에서 3개를 선택지로 만들어주세요. 각 선택지의 actionIndex는 선택한 행동의 actionIndex 값을 그대로 넣어주세요. 나머지는 나레이션에 자연스럽게 녹여주세요.`;

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
