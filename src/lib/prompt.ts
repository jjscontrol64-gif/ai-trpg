import {
  GameState,
  EngineResult,
  PlayerAction,
  DifficultyMode,
  Character,
  StatType,
} from "./types";
import { MAX_PROMPT_ACTIONS } from "./action-options";
import { getDirectionLabel } from "./engine/movement";
import { getEffectiveStat } from "./engine/dice";
import { normalizeAffinity } from "./state-normalization";

const MODE_LABELS: Record<DifficultyMode, string> = {
  easy: "😎 이지",
  normal: "📜 노말",
  hard: "🔥 하드",
};

const ROLE_LABELS: Record<Character["role"], string> = {
  warrior: "전사",
  rogue: "도적",
  mage: "마법사",
};

const STAT_LABELS: Record<StatType, string> = {
  str: "STR",
  dex: "DEX",
  int: "INT",
};

type UserMessageOptions = {
  talkBiased?: boolean;
};

export function buildSystemPrompt(state: GameState): string {
  const { party } = state;
  const [warrior, pina, mina] = party.members;
  const affinity = normalizeAffinity(party.affinity);

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

## 동료 호감도
- 피나: ${affinity.pina}단계 / 미나: ${affinity.mina}단계
- 호감도가 높은 동료일수록 플레이어에게 더 친밀하고 마음을 여는 말투로 대화에 참여시키세요.
- 단, 세계관 톤은 클래식 왕도 JRPG 풍의 동료 유대로 유지하고 과한 연애 묘사는 피하세요.
- "대화하기"는 상태 변화 없는 일반 대화입니다. "안전지대 호감도 대화"는 엔진이 호감도를 올리는 별도 이벤트입니다.

## 응답 규칙
1. narration: 내레이션 텍스트. 피나·미나의 대사를 자연스럽게 포함.
2. choices: 정확히 3개의 선택지를 생성. 각 선택지는 actionIndex(아래 가능한 행동의 actionIndex 숫자), label(짧은 키워드), text(시도 묘사문)를 포함.
3. 가능한 행동에는 수행 캐릭터와 능력치가 "이름(역할, 스탯 값)" 형태로 표시됩니다. 판정·전투 행동은 해당 능력치가 가장 높은 캐릭터를 우선 선택하세요. (예: 고대 문자 해독 등 지능 판정은 INT가 높은 미나, 힘 판정은 전사, 민첩 판정은 피나)
4. label에는 수행하는 캐릭터의 이름을 반드시 포함하고(예: "📖 미나 — 문자 해독"), text는 그 캐릭터가 행동하는 모습을 묘사하세요. 단, "휴식하고 길을 나선다"처럼 특정 캐릭터가 수행하지 않는 선택지는 명령형 라벨로 작성해도 됩니다.
5. label 앞의 이모지는 매 선택지마다 그 행동의 성격에 어울리는 것을 골라 붙이세요. 아래 예시의 🧭/⚔️/🛡️는 형식 참고일 뿐이니 그대로 고정해 반복하지 마세요.
6. 선택지는 제공된 가능한 행동 목록에 대응해야 하며, actionIndex는 반드시 선택한 행동의 값을 그대로 사용하세요.
7. JSON 형식으로만 응답하세요.

## 응답 형식 (JSON만, 다른 텍스트 없이)
{
  "narration": "내레이션 텍스트",
  "choices": [
    { "actionIndex": 0, "label": "🧭 ${warrior.name} — 선택지 키워드", "text": "시도 묘사문" },
    { "actionIndex": 1, "label": "⚔️ 피나 — 선택지 키워드", "text": "시도 묘사문" },
    { "actionIndex": 2, "label": "🛡️ 미나 — 선택지 키워드", "text": "시도 묘사문" }
  ]
}`;
}

export function buildUserMessage(
  engineResult: EngineResult,
  previousChoice?: string,
  options: UserMessageOptions = {}
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
  const members = engineResult.newState.party.members;
  const actions = engineResult.nextActions.slice(0, MAX_PROMPT_ACTIONS);
  for (let i = 0; i < actions.length; i++) {
    msg += `actionIndex=${i}: ${describeAction(actions[i], members)}\n`;
  }

  if (options.talkBiased) {
    msg += `\n이번 응답은 플레이어가 동료들과 대화하며 다음 행동을 다시 고르는 장면입니다. 상태 변화, 다이스 판정, 자원 소모, 몬스터 행동은 일어나지 않습니다. 피나와 미나의 대화를 중심으로 짧게 묘사하고, 가능한 행동 중 탐색 스킬(패스파인딩, 연금생성)이 있으면 선택지에 최소 1개 포함하세요. 각 선택지의 actionIndex는 선택한 행동의 actionIndex 값을 그대로 넣어주세요.`;
  } else {
    msg += `\n위 행동들 중에서 3개를 선택지로 만들어주세요. 각 선택지의 actionIndex는 선택한 행동의 actionIndex 값을 그대로 넣어주세요. 나머지는 나레이션에 자연스럽게 녹여주세요.`;
  }

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

// 판정 캐릭터를 "이름(역할, 스탯 값)" 형태로 표기해 모델이 적합한 캐릭터를 고를 수 있게 한다.
function describeActor(character: Character, stat: StatType): string {
  return `${character.name}(${ROLE_LABELS[character.role]}, ${STAT_LABELS[stat]} ${getEffectiveStat(character, stat)})`;
}

function describeAction(action: PlayerAction, members: Character[]): string {
  switch (action.type) {
    case "move":
      return `${getDirectionLabel(action.direction)}으로 이동`;
    case "attack":
      return `공격 — ${members[action.characterIndex].name}${action.useInspiration ? " [영감 사용]" : ""}`;
    case "special_action":
      return `${action.actionName} 사용 — ${members[action.characterIndex].name}`;
    case "flee":
      return action.useSmokeBomb ? "연막탄으로 도주" : "도주 시도";
    case "use_item":
      return `아이템 사용 (${action.itemId})`;
    case "rest":
      return "휴식";
    case "puzzle_attempt":
      if (action.specialActionName === "활로개척") {
        return `활로개척 사용 — ${members[action.characterIndex].name}(수수께끼 무조건 대성공)`;
      }
      return `수수께끼 도전 (${STAT_LABELS[action.stat]} 판정) — ${describeActor(members[action.characterIndex], action.stat)}`;
    case "trap_attempt":
      if (action.specialActionName === "활로개척") {
        return `활로개척 사용 — ${members[action.characterIndex].name}(함정 무조건 대성공)`;
      }
      return `함정 돌파 (${STAT_LABELS[action.stat]} 판정) — ${describeActor(members[action.characterIndex], action.stat)}`;
    case "npc_interact":
      return "린린과 대화";
    case "pathfinding":
      return "패스파인딩 — 피나";
    case "alchemy":
      return "연금생성 — 미나";
    case "affinity_talk":
      return action.target === "pina"
        ? "안전지대 호감도 대화 — 피나와 대화하고 피나의 호감도 +1(최대 3)"
        : "안전지대 호감도 대화 — 미나와 대화하고 미나의 호감도 +1(최대 3)";
    case "leave_safe_room":
      return "안전지대 떠나기 — 호감도 변화 없이 휴식을 마치고 이동 선택으로 복귀";
    case "ending_choice":
      return `정복 엔딩 후일담 선택 — ${action.choiceId}`;
    default:
      return "알 수 없는 행동";
  }
}
