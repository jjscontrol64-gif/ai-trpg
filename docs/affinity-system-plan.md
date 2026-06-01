# 💗 호감도 시스템 구현 플랜

> 작성일: 2026-06-01 · 상태: **설계 확정, 구현 대기**
> 관련 문서: [`dungeon-trpg-design-doc.md`](./dungeon-trpg-design-doc.md) · `.claude/CLAUDE.md`

---

## 1. 개요

피나·미나와의 **호감도(Affinity)** 시스템을 추가한다. 플레이어는 ⛺ 안전지대에서 동료와 대화하며 호감도를 쌓고, 호감도는 평소 대화의 분위기와 최종 엔딩에 영향을 준다.

**핵심 원칙: 기존 게임 로직을 깨지 않는다.** 호감도는 기존 전투·탐험·판정 흐름과 독립된 부가 레이어로 얹는다.

---

## 2. 확정된 설계 결정

| # | 항목 | 결정 |
|---|---|---|
| 1 | **휴식 포인트** | ⛺ 안전지대(`safe` room)를 "대화 가능한 이벤트"로 격상. 기존 무상태 `대화하기` 버튼은 손대지 않음 |
| 2 | **단계** | 캐릭터별 **3단계** (`0` / `1` / `2`), 초기값 `0`. 피나·미나 **독립** 관리 |
| 3 | **톤** | 단계별 대사를 **사전에 못박지 않음.** 엔진은 수치만 관리하고, 표현 강도는 LLM이 "클래식 왕도 JRPG 풍" 톤 안에서 자연스럽게 결정 |
| 4 | **평소 대화 반영** | 시스템 프롬프트에 현재 호감도 단계를 주입 → 단계가 높을수록 친밀하게 (느슨한 가이드) |
| 5 | **엔딩 반영** | 정복 엔딩에서 호감도 단계에 따라 **엔딩 선택지**를 노출 (내레이션 전면 분기 ❌ — 선택지 추가 방식) |

> **톤 가드레일**: 호감도가 높아져도 세계관 톤은 "동료 유대"를 기본 축으로 유지한다. 연애 시뮬 방향으로의 강한 드리프트는 `tone-decision` 메모리(클래식 왕도 JRPG 풍)와 어긋나므로 지양. LLM 가이드에 이 경계를 명시한다.

---

## 3. 데이터 모델 (`src/lib/types.ts`)

호감도를 어디에 둘지 — 두 캐릭터 독립이므로 `Party`에 별도 필드로 둔다 (`Character`에 두면 전사에도 불필요하게 생김).

```typescript
export type AffinityLevel = 0 | 1 | 2;

export interface Affinity {
  pina: AffinityLevel;
  mina: AffinityLevel;
}

// GameState.party 에 추가
export interface Party {
  // ...기존 필드...
  affinity: Affinity;   // 신규
}
```

새 플레이어 액션 (OCP — `ActionHandlerMap`이 핸들러 누락을 컴파일 단계에서 강제):

```typescript
// PlayerAction 유니온에 추가
| { type: "affinity_talk"; target: "pina" | "mina" }
| { type: "leave_safe_room" }      // 대화 없이 떠나기
```

엔딩 선택지용 (3.엔딩 절 참조):

```typescript
| { type: "ending_choice"; choiceId: string }   // 필요 시
```

---

## 4. 흐름 설계

### 4.1 안전지대 대화 (휴식 포인트)

현재 `handleSafeRoom`은 진입 즉시 HP+5 후 이동 선택지로 넘어간다. 이를 **이벤트 phase로 전환**한다.

```
⛺ 안전지대 진입
  → 전원 HP+5 (기존 유지)
  → phase = "event"
  → 선택지 노출:
       affinity_talk(pina)     "피나와 대화"
       affinity_talk(mina)     "미나와 대화"
       leave_safe_room         "휴식하고 길을 나선다"
```

**결정적 로직 (엔진):**
- `processAffinityTalk(state, target)`: 해당 캐릭터 호감도 `+1` (최대 `2`에서 cap). `phase = "exploration"` 복귀, `getAvailableDirections` 반환.
- `processLeaveSafeRoom(state)`: 상태 변화 없이 `phase = "exploration"` 복귀.
- **방문당 횟수 제한**: 안전지대 1회 방문당 대화 1회 (대화/떠나기 선택 시 이벤트 종료). 재방문 시 `safe` room은 기존처럼 재진입 가능하나, 무한 파밍 방지를 위해 단계 cap(2)이 이미 상한 역할.

**창의적 로직 (LLM):** 대화 장면 묘사, 캐릭터 대사. 시스템 프롬프트의 호감도 단계에 맞춰 분위기 조절.

> 책임 분리(design doc §11.1) 준수: 수치 변경 = 엔진, 대화 묘사 = LLM.

### 4.2 평소 대화 반영 (`src/lib/prompt.ts`)

`buildSystemPrompt`의 `## 현재 게임 상태` 또는 `## 등장 캐릭터` 블록에 호감도 단계를 주입하고, 느슨한 표현 가이드를 추가한다.

```
## 동료 호감도 (평소 대화 분위기 조절용)
- 피나: 1단계 / 미나: 0단계
> 호감도가 높은 동료일수록 플레이어에게 더 친밀하고 마음을 여는 말투로 대화에 참여시키세요.
> 단, 세계관 톤(클래식 왕도 JRPG 풍, 동료 유대)은 유지하세요. 과한 연애 묘사는 지양.
```

- 단계별 고정 대사 스크립트 ❌ (결정 #3).
- `talk`(대화하기) 흐름과 `player_action` 흐름 모두 `buildSystemPrompt`를 거치므로 자동 반영됨.

### 4.3 엔딩 반영 (`src/app/api/game/route.ts`)

현재 정복 엔딩(`getEndingNarration` victory)은 고정 프롬프트로 내레이션만 출력하고 `choices: []`로 게임을 종료한다.

**방식: 엔딩 선택지 추가** (내레이션 전면 분기 아님)
- 정복 엔딩 내레이션에 호감도 단계를 컨텍스트로 주입.
- 호감도 단계에 따라 **잠금 해제되는 엔딩 선택지**를 제시 (예: 특정 동료와의 후일담 장면).
  - 예: 피나 2단계 → "피나와의 약속" 선택지 노출 / 미나 2단계 → "미나와의 약속" 선택지 노출.
  - 둘 다 낮으면 공통 마무리 선택지만.
- 선택 시 짧은 후일담 에필로그를 LLM이 생성 (`ending_choice` 액션 → 1회 추가 라운드).

> **구조적 주의**: 현재 `victory`/`game_over`는 `choices: []`로 즉시 종료된다. 엔딩 선택지를 넣으려면 victory 경로가 선택지를 렌더링하고, 선택 후 후일담을 출력하는 **2단계 엔딩 흐름**이 필요하다. 이 부분이 이번 작업에서 구조 변경이 가장 큰 지점.
> 대안(더 단순): 선택지 없이 호감도 단계를 엔딩 내레이션 프롬프트에만 주입 → LLM이 후일담을 한 단락 녹임. 구조 변경 0. **구현 착수 전 둘 중 택일 권장.**

---

## 5. 파일별 변경 범위

| 파일 | 변경 내용 |
|---|---|
| `src/lib/types.ts` | `Affinity` 타입, `Party.affinity`, 신규 `PlayerAction` 3종 |
| `src/lib/initial-state.ts` | `affinity: { pina: 0, mina: 0 }` 초기화 |
| `src/lib/engine/index.ts` | `handleSafeRoom` 이벤트화, `processAffinityTalk`·`processLeaveSafeRoom`(·`processEndingChoice`) 핸들러 + `ActionHandlerMap` 등록 |
| `src/lib/prompt.ts` | `buildSystemPrompt`에 호감도 단계 주입 + 가이드, `describeAction`에 신규 액션 라벨 |
| `src/app/api/game/route.ts` | (엔딩 선택지 채택 시) victory 흐름 2단계화 + `getEndingNarration`에 호감도 주입 |
| `src/app/page.tsx` | 엔딩 선택지 렌더링 (엔딩 선택지 채택 시) |
| `src/lib/status.ts` | (선택) 상태창에 호감도 표시 |
| `dungeon-trpg-design-doc.md` | 호감도 시스템 절 신규 추가 (§10 엔딩 갱신 포함) |

> 규모는 미해결 이슈 #6(난이도 모드)과 동급. types→engine→prompt→route→UI 다중 수정.

---

## 6. 비목표 / 보존 사항

- ❌ 기존 전투·판정·이동·아이템 로직 변경 없음.
- ❌ `대화하기`(`handleTalk`) 버튼의 무상태 설계 변경 없음 (호감도는 안전지대에서만 조정).
- ✅ 결정적 로직(수치)은 엔진, 창의적 묘사는 LLM (design doc §11.1).
- ✅ 세계관 톤 "클래식 왕도 JRPG 풍 / 동료 유대" 유지 (`tone-decision`).

---

## 7. 인접 이슈 (작업 중 마주칠 것)

- **보스명 불일치 (open-issues #5)**: 엔딩 작업 시 `monsters/core.ts`의 `"엔드드래곤"` vs 엔딩 내레이션 `"레드드래곤"` 불일치를 만나게 됨. 엔딩 손대는 김에 같이 정리할지 Director 판단 필요.

---

## 8. 미결 노브 (구현 착수 전 확정)

1. **엔딩 방식 택일**: 4.3의 "엔딩 선택지(구조 변경 큼)" vs "내레이션 주입만(구조 변경 0)". → 플랜 기본값은 *엔딩 선택지*이나 단순화 대안 명시.
2. **호감도 조정 방향**: 대화 선택 = 항상 `+1`인가, 아니면 선택지 성격에 따라 상승/중립 갈래를 둘 것인가. → 기본값: 캐릭터 대화 선택 시 단순 `+1`.
3. **상태창 노출 여부**: 호감도를 UI 상태창에 보여줄지(하트 ♥♥♡ 등) 숨길지.

---

## 9. 완료 정의 (DoD)

- [ ] `npm run build` / 타입체크 / 린트 통과
- [ ] 기존 테스트(`combat.test`, `dice.test`, `inspiration.test`) 무손상 통과
- [ ] `ActionHandlerMap` `satisfies` 컴파일 통과 (신규 액션 핸들러 누락 없음)
- [ ] 안전지대 진입 → 대화/떠나기 선택 → 호감도 정확히 반영 (수동 플레이 검증)
- [ ] 호감도 단계가 평소 대화 분위기에 반영됨 (수동 검증)
- [ ] 정복 엔딩에 호감도 영향 확인 (수동 검증)
- [ ] `dungeon-trpg-design-doc.md`에 호감도 절 반영 (문서↔코드 일치)
- [ ] 기존 전투/탐험/판정 회귀 없음 (수동 스모크)
