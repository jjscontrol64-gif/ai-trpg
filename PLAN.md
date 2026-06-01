# PLAN — 상시 인벤토리 패널 아이템 사용 (A안)

## 0. 배경 / 문제

현재 "아이템 사용" 선택지가 사실상 뜨지 않는다. 근본 원인은 두 가지(버그가 아닌 구조).

| 원인 | 근거 | 결과 |
|---|---|---|
| 비전투에 `use_item` 부재 | `getCombatActions`(`combat.ts:361-366`)에서만 풀에 추가 | 탐험·이벤트 중 회복 불가 |
| 전투 중엔 3선택지 병목 | LLM은 항상 3개만 생성(`prompt.ts:69`) | 아이템이 공격·도주와 경쟁해 누락 |

→ 해결책: 아이템 사용을 **LLM 서사 선택지에서 완전 분리**하고, 우측 사이드바에 **상시 인벤토리 패널**로 노출(A안).

## 1. 설계 결정 (A안)

**핵심: 아이템은 GM 선택지와 독립된 별도 UI에서 언제든 1클릭 사용.**

- 우측 `<aside>`의 `StatusWindow` 아래에 **상시 인벤토리 패널**을 렌더(토글 없음).
- LLM 3선택지는 **서사적 행동(이동/판정/전투)** 에만 집중 → 병목 해소.
- 아이템 클릭 → 기존 `type:"player_action"`, `action:{type:"use_item", itemId, targetIndex}` 로 POST.
- 서버는 **무변경** — `handlePlayerAction → processAction → processUseItem` 경로가 전투/비전투 모두 완비(`engine/index.ts:308-370`).
- 아이템 사용 결과 내레이션은 기존 흐름대로 LLM이 생성 → 몰입 유지.

근거: 서버 변경 0, LLM 비용 0(여닫기 동작 자체가 없음), 아이템 N개 전부 표시(병목 없음), 전투·탐험 모두 상시 접근. CLAUDE.md의 *Simple / Root Cause Driven* 에 부합.

### A안 vs B안 (가방 토글) 비교
- B안은 「가방 열기」 토글로 선택지 영역을 전환 → 토글 state·여닫기 동선 필요.
- A안은 상시 노출이라 **토글 state 불필요**, 항상 1클릭. 구현이 더 단순하고 접근성이 높다.

## 2. 작업 범위

### 2.1 신규 — 공용 헬퍼 `src/lib/item-usage.ts`
- `isBagUsable(item: ConsumableItem): boolean` — `combat.ts:361-363`의 필터(`effectId || hpRestore || allHpRestore || actionRestore`)를 추출.
  - **연막탄(`autoFlee` 전용)은 자동 제외** — 전투에서 「도주(연막탄)」로 이미 노출되며, `use_item`으로 쓰면 효과 없이 소모되는 잠재 버그(open-issues #2) 회피.
- `describeBagItem(item): string` — 라벨용 효과 요약(예: "HP +5", "전체 HP +3", "특수액션 +1").
- 순수 함수만 둔다(registry 비의존) → 클라이언트 번들 안전. `ConsumableItem` 타입에만 의존.

### 2.2 변경 — `src/lib/engine/combat.ts`
- `getCombatActions`의 인라인 필터(`361-363`)를 `isBagUsable`로 교체. **동작 동일**(중복 제거).

### 2.3 신규 — `src/components/InventoryPanel.tsx`
- props: `inventory: ConsumableItem[]`, `onUse: (choice: ChoiceOption) => void`, `disabled?: boolean`.
- `panel-shell` 스타일로 사이드바에 자연스럽게 배치.
- 동일 `name` 아이템은 스택 표시("회복물약 ×2") — `status.ts:76-82` 방식. 클릭 시 해당 name의 **첫 인스턴스 id**를 사용.
- 사용 가능 아이템(`isBagUsable`)만 클릭 버튼으로 렌더. 그 외(연막탄 등)는 비노출.
- 빈 목록: "사용할 수 있는 아이템이 없습니다" 안내(패널은 유지).

### 2.4 변경 — `src/app/page.tsx`
- 우측 `<aside>`(614-638) 내 `StatusWindow` 아래에 `<InventoryPanel>` **상시 렌더**.
  - `inventory={gameState.party.inventory}`
  - `disabled`: `choiceSubmitStatus === "submitting"` || phase ∈ {victory, game_over}.
  - **전투 중에도 활성**(회복 핵심 동선).
- 아이템 클릭 핸들러: 선택 아이템을 `ChoiceOption{ label, text, action:{type:"use_item", itemId, targetIndex} }`로 구성 → **기존 `handleChoice` 재사용** → 제출/스냅샷/뒤로가기/내레이션 흐름 전부 그대로.
- 토글 state 불필요. `handleBack` 등 기존 핸들러 수정 없음.

### 2.5 대상 선택(targetIndex) 정책 — MVP
- 단일 대상 아이템(`hpRestore`/`actionRestore`): **자동 타게팅** = 생존 멤버 중 결손이 가장 큰 대상(HP 회복은 최소 HP비율, 액션 회복은 잔여 부족). 클라이언트가 인덱스 계산해 `targetIndex` 전달.
- 전체 대상(`allHpRestore`): `targetIndex` 무관(엔진이 전원 처리).
- 명시적 대상 선택 UI는 **후속 확장**으로 분리. MVP 범위에서 제외.

## 3. 영향 범위 / 회귀

| 영역 | 변경 | 회귀 위험 |
|---|---|---|
| 서버 라우트/엔진 핵심 | 무변경(필터 추출만) | 낮음 — `getCombatActions` 동작 동일 |
| `processUseItem` 비전투 분기 | 무변경 | 이미 `getAvailableDirections` 반환 → 사용 후 GM 선택지 정상 |
| open-issues #2 (무음 실패) | `isBagUsable` 필터로 사전 차단 | 해당 아이템 미노출 |
| 클라이언트 상태 | 신규 state 없음(상시 패널) | 낮음 — 기존 `handleChoice` 재사용 |

## 4. DoD (완료 기준)

- [ ] `isBagUsable`/`describeBagItem` 추가, `combat.ts` 필터 교체(동작 동일 확인)
- [ ] `InventoryPanel` 컴포넌트: 스택 표시 / 빈 목록 처리 / 사용 가능 아이템만 노출
- [ ] 사이드바에 인벤토리 패널 상시 노출, 전투·탐험 모두 동작, 엔딩·제출 중 비활성
- [ ] 아이템 사용 → `use_item` POST → HP/액션 반영 + 내레이션 생성 확인
- [ ] 단일 대상 자동 타게팅(최소 결손 멤버) 동작
- [ ] 연막탄이 인벤토리 패널에 **나타나지 않음** 확인
- [ ] 빈 인벤토리에서 안내 문구 표시
- [ ] 아이템 사용 직후 `뒤로가기`로 사용 이전 상태 복원 가능
- [ ] `npm test` 통과
- [ ] `node .\node_modules\typescript\bin\tsc --noEmit` 통과
- [ ] `npm run build` 통과

## 5. 검증 시나리오 (수동)

1. 전투 중 패널에서 회복물약 클릭 → HP 회복 + 내레이션
2. 탐험 중 회복 → 이후 GM 탐험 선택지 정상 유지
3. 빈 인벤토리 → 안내 문구
4. 연막탄만 보유 → 패널에 미노출(도주 선택지로만 사용)
5. 아이템 사용 직후 `뒤로가기` → 사용 전 상태 복원

## 6. 비범위 (후속)

- 명시적 회복 대상 선택 UI
- 장비 아이템 패널 통합(현재 장비는 `autoEquip` 자동 처리)
- 인벤토리 정렬/필터/수량 한도
