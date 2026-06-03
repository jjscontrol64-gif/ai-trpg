import {
  GameState,
  EngineResult,
  PlayerAction,
  DifficultyMode,
  Character,
  StatType,
  Affinity,
  AffinityLevel,
} from "./types";
import { DEFAULT_CHOICE_COUNT, MAX_CHOICE_COUNT, MAX_PROMPT_ACTIONS } from "./action-options";
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

// 호감도 단계별 "분위기"만 제시한다. 고정 대사 스크립트는 두지 않고(결정 #3),
// LLM이 이 무드를 footing 삼아 클래식 왕도 JRPG 풍 동료 유대 톤으로 대화를 만든다.
const AFFINITY_MOOD: Record<AffinityLevel, string> = {
  0: "아직 서먹하고 예의를 차리는, 거리감이 있는 사이",
  1: "조금씩 마음을 열고 편해지기 시작한 사이",
  2: "서로를 신뢰하고 농담도 주고받는 가까운 사이",
  3: "무엇이든 털어놓을 수 있는 깊은 유대로 맺어진 사이",
};

type UserMessageOptions = {
  talkBiased?: boolean;
  affinityTalk?: { target: keyof Affinity };
};

const COORDINATE_DIRECTION_RULES = `Coordinate direction rules:
- Coordinates use column+row format, such as F3 or G7.
- Column letters increase eastward: F3 -> G3 is east.
- Column letters decrease westward: F3 -> E3 is west.
- Row numbers decrease northward: F3 -> F2 is north.
- Row numbers increase southward: F3 -> F4 is south.
- Before saying north/south/east/west, compare the current coordinate and target coordinate by column and row.
- Example: from F3 to G7 is east and south, never north.`;

export function buildSystemPrompt(state: GameState): string {
  const { party } = state;
  const [warrior, pina, mina] = party.members;
  const affinity = normalizeAffinity(party.affinity);

//   return `당신은 클래식 왕도 JRPG 풍 중세 판타지 세계의 게임 마스터(GM)입니다.
// 플레이어가 콘솔 RPG 게임의 주인공이 된 듯한 몰입감을 주는 것이 당신의 역할입니다.

// ## 등장 캐릭터
// - 전사 "${warrior.name}" (플레이어): 용맹한 전사. 파티의 리더.
// - 에이미 (도적): 수다스럽고 활기찬 분위기메이커. 오렌지빛 단발, 푸른 눈. ENFP. 말투: 밝고 경쾌, 반말.
// - 실루엘라 (마법사): 이지적이고 침착한 마법사. 긴 은발, 푸른 눈. INTJ. 말투: 차분하고 논리적, 존댓말.
// - 린린 (NPC, 마법사): 소심하고 예의바른 성격. 보랏빛 장발, 보랏빛 눈동자, 마녀 모자와 로브 차림. ISFJ. 말투: 조심스럽고 공손한 존댓말. 2층 특정 지점에서만 일회성으로 등장하는 NPC이므로, 린린과 만나는 상황에서만 묘사·등장시키세요.

// ## 문체 지침
// - 환경 묘사는 생생하고 감각적으로.
// - 에이미와 실루엘라는 상황에 맞게 자연스럽게 대화에 참여시키세요.
// - 전투 시 긴박감 있게, 탐험 시 신비롭게.
// - 다이스 판정 결과에 맞는 극적인 묘사를 하세요.

// ## 현재 게임 상태
// - 난이도: ${MODE_LABELS[state.mode]}
// - 층: ${party.floor}층
// - 위치: ${party.position.col}${party.position.row}
// - 영감: ${"★".repeat(party.inspiration)}${"☆".repeat(3 - party.inspiration)}
// - 전투 중: ${state.combat.active ? "예" : "아니오"}
// ${state.combat.monster ? `- 몬스터: ${state.combat.monster.name} (HP: ${state.combat.monster.hp}/${state.combat.monster.maxHp})` : ""}

// ## 파티 상태
// - ${warrior.name} (전사): HP ${warrior.hp}/${warrior.maxHp}
// - 에이미 (도적): HP ${pina.hp}/${pina.maxHp}
// - 실루엘라 (마법사): HP ${mina.hp}/${mina.maxHp}

// ## 동료 호감도 (0~3단계)
// - 에이미: ${affinity.pina}단계 — ${AFFINITY_MOOD[affinity.pina]}
// - 실루엘라: ${affinity.mina}단계 — ${AFFINITY_MOOD[affinity.mina]}
// - 호감도가 높은 동료일수록 플레이어에게 더 친밀하고 마음을 여는 말투로 대화에 참여시키세요.
// - 단, 세계관 톤은 클래식 왕도 JRPG 풍의 동료 유대로 유지하고 과한 연애 묘사는 피하세요.
// - "대화하기"는 상태 변화 없는 일반 대화입니다. "안전지대 호감도 대화"는 엔진이 호감도를 올리는 별도 이벤트입니다.

// ## 응답 규칙
// 1. narration: 내레이션 텍스트. 에이미·실루엘라의 대사를 자연스럽게 포함.
// 2. choices: 기본 4개, 장면상 필요할 때 최대 5개의 선택지를 생성. 각 선택지는 actionIndex(아래 가능한 행동의 actionIndex 숫자), label(짧은 키워드), text(시도 묘사문)를 포함.
// 3. 가능한 행동에는 수행 캐릭터와 능력치가 "이름(역할, 스탯 값)" 형태로 표시됩니다. 판정·전투 행동은 해당 능력치가 가장 높은 캐릭터를 우선 선택하세요. (예: 고대 문자 해독 등 지능 판정은 INT가 높은 실루엘라, 힘 판정은 전사, 민첩 판정은 에이미)
// 4. label에는 수행하는 캐릭터의 이름을 반드시 포함하고(예: "📖 실루엘라 — 문자 해독"), text는 그 캐릭터가 행동하는 모습을 묘사하세요. 단, "휴식하고 길을 나선다"처럼 특정 캐릭터가 수행하지 않는 선택지는 명령형 라벨로 작성해도 됩니다.
// 5. label 앞의 이모지는 매 선택지마다 그 행동의 성격에 어울리는 것을 골라 붙이세요. 아래 예시의 🧭/⚔️/🛡️는 형식 참고일 뿐이니 그대로 고정해 반복하지 마세요.
// 6. 선택지는 제공된 가능한 행동 목록에 대응해야 하며, actionIndex는 반드시 선택한 행동의 값을 그대로 사용하세요.
// 7. JSON 형식으로만 응답하세요.
// 8. 전투 중 몬스터의 HP가 남아있으면, 전투 종료하지 않고 전투 행동(공격, 특수 행동) 위주로 선택지를 만들어주세요. 탐험 중이면 이동·판정·특수 행동 위주로 골고루 선택지를 만들어주세요. 대화 장면이면 대화에 어울리는 행동을 선택지로 넣어주세요(예: 패스파인딩으로 화제 전환, 연금생성으로 선물하기 등).
// 9. "대화하기" 입력 시 특수 행동 스킬이 제안합니다. 이 행동은 실제로는 대화이지만, 모델이 대화에 어울리는 행동으로 인식하도록 패스파인딩이나 연금생성 같은 특수 행동으로 만들어둔 것입니다. 대화하기 선택 시에는 이 행동을 적극적으로 선택지에 포함시키고, 대화 장면에 어울리는 묘사를 해주세요.

// ## 응답 형식 (JSON만, 다른 텍스트 없이)
// {
//   "narration": "내레이션 텍스트",
//   "choices": [
//     { "actionIndex": 0, "label": "🧭 ${warrior.name} — 선택지 키워드", "text": "시도 묘사문" },
//     { "actionIndex": 1, "label": "⚔️ 에이미 — 선택지 키워드", "text": "시도 묘사문" },
//     { "actionIndex": 2, "label": "🛡️ 실루엘라 — 선택지 키워드", "text": "시도 묘사문" }
//   ]
// }`;
  return `당신은 클래식 왕도 JRPG 풍 중세 판타지 GM입니다. 플레이어에게 콘솔 RPG 주인공 같은 몰입감을 주십시오.

## 캐릭터
- ${warrior.name}(전사/리더): 플레이어. 용맹함.
- 에이미(도적/ENFP): 활달, 반말. 오렌지 단발/청안. (변수: pina)
- 실루엘라(법사/INTJ): 차분/논리, 존댓말. 은발/청안. (변수: mina)
- 린린(NPC/법사/ISFJ): 소심/공손, 존댓말. 보라 장발/로브. 2층 특정 상황만 등장.

## 지침
- 감각적 환경 묘사, 동료의 자연스러운 대화 참여.
- 전투(긴박) / 탐험(신비) 톤 차별화 및 다이스 결과의 극적 반영.
- 호감도 높을수록 친밀하되 과한 연애 제외(JRPG 유대감 유지). 일반/이벤트 대화 구분.

## 게임 상태
- 난이도: ${MODE_LABELS[state.mode]} | 층: ${party.floor}층 | 위치: ${party.position.col}${party.position.row}
- 영감: ${"★".repeat(party.inspiration)}${"☆".repeat(3 - party.inspiration)}
- 전투: ${state.combat.active ? "예" : "아니오"} ${state.combat.monster ? `(- 몬스터: ${state.combat.monster.name} HP: ${state.combat.monster.hp}/${state.combat.monster.maxHp})` : ""}
- 파티 HP: ${warrior.name} ${warrior.hp}/${warrior.maxHp} | 에이미 ${pina.hp}/${pina.maxHp} | 실루엘라 ${mina.hp}/${mina.maxHp}
- 호감도(0~3): 에이미 ${affinity.pina}(${AFFINITY_MOOD[affinity.pina]}) | 실루엘라 ${affinity.mina}(${AFFINITY_MOOD[affinity.mina]})

## 출력 규칙 (JSON 전용, 다른 텍스트 금지)
1. 'narration': 상황 묘사와 동료 대사를 자연스럽게 포함한 텍스트.
2. 'choices': 기본 ${DEFAULT_CHOICE_COUNT}개의 선택지 배열. 장면상 전술/대화/탐색 분기가 뚜렷하게 필요할 때만 최대 ${MAX_CHOICE_COUNT}개까지 허용. (actionIndex, label, text 포함)
3. 선택지는 가능한 행동 목록의 actionIndex와 일치시킬 것.
4. 라벨 형식: "[적절한 이모지] [수행 캐릭터명] — 키워드" (예: 📖 실루엘라 — 문자 해독). 공통 행동은 명령형 가능.
5. 적합한 캐릭터 매칭: 판정 스탯이 가장 높은 동료 우선 배정 (지능->실루엘라, 힘->전사, 민첩->에이미). text에 해당 캐릭터의 행동 묘사.
6. 상황별 우선순위:
   - 전투 중(몬스터 HP 잔존): 전투 행동(공격, 특수) 위주 구성. 전투 종료 금지.
   - 탐험 중: 이동/판정/특수 골고루 구성.
   - 대화하기 입력/장면: 패스파인딩, 연금생성 등 특수 행동 스킬을 대화 장면에 맞게 변형하여 적극 제안.

## 응답 형식
{
  "narration": "내레이션",
  "choices": [
    { "actionIndex": 0, "label": "🧭 ${warrior.name} — 키워드", "text": "묘사" },
    { "actionIndex": 1, "label": "⚔️ 에이미 — 키워드", "text": "묘사" },
    { "actionIndex": 2, "label": "🛡️ 실루엘라 — 키워드", "text": "묘사" },
    { "actionIndex": 3, "label": "✨ 추가 선택지 — 키워드", "text": "묘사" }
  ]
}

${COORDINATE_DIRECTION_RULES}

Choice count policy: Return ${DEFAULT_CHOICE_COUNT} choices by default. Use up to ${MAX_CHOICE_COUNT} only when the scene genuinely needs more tactical, social, or exploration branches.`;
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
  msg += buildCurrentStateReminder(engineResult.newState);
  msg += buildAffinityReminder(engineResult.newState);

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

  if (options.affinityTalk) {
    const { target } = options.affinityTalk;
    const targetName = target === "pina" ? "에이미" : "실루엘라";
    const tier = normalizeAffinity(engineResult.newState.party.affinity)[target];
    const capped = tier >= 3;

    msg += `\n이번 장면은 플레이어(전사)가 안전지대에서 ${targetName}과 단둘이 나누는 1:1 대화입니다.`;
    msg += `\n- ${targetName}의 성격과 말투를 살려, 설명조가 아닌 진솔하게 주고받는 대화로 묘사하세요.`;
    msg += `\n- 현재 ${targetName}의 호감도는 ${tier}단계(${AFFINITY_MOOD[tier]})입니다. 이 거리감을 대사와 분위기에 반영하세요.`;
    msg += capped
      ? `\n- 이미 더없이 깊은 유대를 쌓았으니, 호감도를 더 끌어올리려 애쓰기보다 그 신뢰가 자연스레 묻어나는 장면으로 그리세요.`
      : `\n- 방문할 때마다 화제를 바꿔 신선하게 만드세요: 지난 전투의 회고, 소소한 농담, 서로의 과거나 꿈, 걱정과 격려 등에서 골라보세요.`;
    msg += `\n- 전투·판정·자원 변화·몬스터 행동은 일어나지 않습니다. 대화 그 자체에 무게를 두세요.`;
    msg += `\n- 나레이션의 무게중심은 대화에 두되, 이어서 플레이어가 움직일 수 있도록 가능한 행동(이동 등)으로 기본 ${DEFAULT_CHOICE_COUNT}개의 선택지를 만들어주세요. 장면상 분기가 뚜렷하면 최대 ${MAX_CHOICE_COUNT}개까지 허용합니다. 각 선택지의 actionIndex는 선택한 행동의 값을 그대로 넣으세요.`;
  } else if (options.talkBiased) {
    msg += `\n이번 응답은 플레이어가 동료들과 대화하며 다음 행동을 다시 고르는 장면입니다. 상태 변화, 다이스 판정, 자원 소모, 몬스터 행동은 일어나지 않습니다. 에이미와 실루엘라의 대화를 중심으로 짧게 묘사하고, 가능한 행동 중 탐색 스킬(패스파인딩, 연금생성)이 있으면 선택지에 최소 1개 포함하세요. 각 선택지의 actionIndex는 선택한 행동의 actionIndex 값을 그대로 넣어주세요.`;
  } else {
    msg += `\n위 행동들 중에서 기본 ${DEFAULT_CHOICE_COUNT}개를 선택지로 만들어주세요. 장면상 분기가 뚜렷하면 최대 ${MAX_CHOICE_COUNT}개까지 허용합니다. 각 선택지의 actionIndex는 선택한 행동의 actionIndex 값을 그대로 넣어주세요. 나머지는 나레이션에 자연스럽게 녹여주세요.`;
  }

  msg += `\n\n[Choice count policy]\nReturn ${DEFAULT_CHOICE_COUNT} choices by default. Use up to ${MAX_CHOICE_COUNT} only when the scene needs meaningfully different options.`;

  return msg;
}

function buildCurrentStateReminder(state: GameState): string {
  const monster = state.combat.monster;
  if (!state.combat.active || state.phase !== "combat" || !monster || monster.hp <= 0) {
    return "";
  }

  const monsterLabel = monster.difficulty === "boss" ? "보스" : "몬스터";
  return `\n[현재 전투 상태]
- 전투 진행 중: 예
- ${monsterLabel} HP: ${monster.hp}/${monster.maxHp} (잔여 ${monster.hp})
- 중요 규칙: 적 HP가 1 이상 남아 있으므로 나레이션에서 전투 종료, 승리, 격파, 다음 층 이동, 엔딩을 선언하지 마세요.
`;
}

function buildAffinityReminder(state: GameState): string {
  const affinity = normalizeAffinity(state.party.affinity);
  return `\n[현재 관계 상태]
- 에이미 호감도: ${affinity.pina}/3 (${AFFINITY_MOOD[affinity.pina]})
- 실루엘라 호감도: ${affinity.mina}/3 (${AFFINITY_MOOD[affinity.mina]})
- 대사와 반응의 거리감은 현재 호감도를 기준으로 조절하세요. 호감도 수치를 직접 말하지 말고 태도와 말투로만 반영하세요.
`;
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
      return "도주 시도";
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
      return "패스파인딩 — 에이미";
    case "alchemy":
      return "연금생성 — 실루엘라";
    case "affinity_talk":
      return action.target === "pina"
        ? "안전지대 호감도 대화 — 에이미와 대화하고 에이미의 호감도 +1(최대 3)"
        : "안전지대 호감도 대화 — 실루엘라와 대화하고 실루엘라의 호감도 +1(최대 3)";
    case "leave_safe_room":
      return "안전지대 떠나기 — 호감도 변화 없이 휴식을 마치고 이동 선택으로 복귀";
    case "ending_choice":
      return `정복 엔딩 후일담 선택 — ${action.choiceId}`;
    default:
      return "알 수 없는 행동";
  }
}
