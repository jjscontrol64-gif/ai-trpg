# 구현 플랜 — 아이템 사용 → 캐릭터 상태 변화 이펙트 (회복/버프)

> 대상: 이 Next.js(App Router) 프로젝트
> 목표: 인벤토리 아이템 사용 시 **대상 캐릭터 칩(PartyHud)** 위에 회복/버프 연출(빛 입자 + HP 바 충전 + 오라)을 재생한다. 대상은 기존 자동선택(`getBagItemTargetIndex`) 그대로.
> ⚠️ 표현(연출) 레이어만 추가한다. 아이템 사용 로직(`use-item.ts` / `item-usage.ts`)·상태 계산은 그대로 두고, **이미 분리된 로컬 사용 결과를 받아 이펙트만 트리거**한다.

---

## 0. 방식 요약

`attack-fx` 와 동일한 패턴의 **프레임워크 무관** 순수 JS 엔진 1개 + CSS 1개.

- `heal-fx.js` → `window.HealFX` 전역. 칩마다 `HealFX.create({ chip })` 로 인스턴스 생성 후 `fx.play(type, opts)` 호출.
- `heal-fx.css` → 입자/오라/들썩/바 충전 광택 키프레임. 색은 `type` 별 자체 팔레트(host 토큰과 충돌 없음).
- 회복량·대상 결정은 **기존 `use-item.ts` 그대로**. 이펙트는 사용 전/후 상태를 **diff** 해서 "누가 얼마 회복됐는지"만 받아 시각화.

시각/동작 정답지: 동봉 `heal-fx-demo.html` (브라우저로 바로 열어 확인). 이 파일이 기준이다.

`type` 팔레트:

| type | 용도 | 색 |
|---|---|---|
| `heal`    | 단일 HP 회복 (`hpRestore`) | 초록 |
| `allheal` | 전체 HP 회복 (`allHpRestore`) | 청록 |
| `action`  | 특수액션 회복 (`actionRestore`) | 파랑 |

`fx.play(type, opts)` 의 `opts`: `{ label?: string, bars?: HTMLElement[], count?: number }`
- `label` — 떠오르는 텍스트(`"+5"`, `"특수액션 +1"`)
- `bars` — 충전 광택을 줄 `.hp-bar-fill` 요소 배열(HP 회복만)
- `count` — 입자 수(기본 8 = 은은)

---

## 1. 에셋 준비

- `heal-fx.css` → `src/app/heal-fx.css` 로 복사. `globals.css` 상단에 `@import "./heal-fx.css";` 추가 (기존 `attack-fx.css` 와 같은 방식).
- `heal-fx.js` → `public/heal-fx.js` 로 복사 후, **PartyHud 안에서 `<Script src="/heal-fx.js" strategy="afterInteractive" onLoad={...} />`** 로 로드 (ScriptStage 의 attack-fx 로드 패턴 그대로).
- 이미지/폰트 의존성 없음.

---

## 2. 인덱스 매핑 (중요)

`use_item` 의 `targetIndex` 는 **`state.party.members[]` 인덱스**다. `status.ts:buildStatusWindow` 가 `members[0]→warrior`, `[1]→pina`, `[2]→mina` 로 매핑하고, `PartyHud` 의 `SLOTS` 도 동일 순서(warrior/pina/mina)이므로:

> **`targetIndex` === PartyHud 칩 인덱스(SLOTS 순서)**. 별도 변환 불필요.

(견고하게 하려면 `members[i].role` → slot 매핑 테이블을 두어도 됨.)

---

## 3. 수정 / 추가 파일

### 3.1 `src/app/page.tsx` — 사용 결과 diff → HealFxEvent 생성

이미 `handleUseItemLocally` 에서 로컬로 `useItem(...)` 을 돌려 `result.newState` 를 얻는다. 여기서 **사용 전(`gameState`) vs 후(`result.newState`)** 를 diff 해 이펙트 이벤트를 만든다. (아이템 내부 구현에 의존하지 않음 → 가장 안전)

```ts
// 타입 (PartyHud.tsx 에서 export 하거나 types.ts 에 추가)
export type HealFxKind = "heal" | "allheal" | "action";
export interface HealFxEvent {
  id: string;
  targets: { index: number; kind: HealFxKind; amount: number }[];
}

function createHealFxEvent(
  prev: GameState,
  next: GameState,
  isAllHeal: boolean
): HealFxEvent | null {
  const targets: HealFxEvent["targets"] = [];

  prev.party.members.forEach((m, i) => {
    const n = next.party.members[i];
    if (!n) return;

    const hpGain = n.hp - m.hp;
    if (hpGain > 0) {
      targets.push({ index: i, kind: isAllHeal ? "allheal" : "heal", amount: hpGain });
      return;
    }
    const actGain = n.actions.reduce(
      (sum, a, ai) => sum + Math.max(0, a.remaining - (m.actions[ai]?.remaining ?? a.remaining)),
      0
    );
    if (actGain > 0) {
      targets.push({ index: i, kind: "action", amount: actGain });
    }
  });

  return targets.length ? { id: createId(), targets } : null;
}
```

`handleUseItemLocally` 내부, `changed` 가 `true` 인 분기(상태 갱신 직후)에 추가:

```ts
const usedItem = gameState.party.inventory.find((it) => it.id === choice.action.itemId);
const isAllHeal = Boolean(usedItem?.allHpRestore || usedItem?.effectId === "restore_all_hp");

setGameState(result.newState);
setStatusWindow(buildStatusWindow(result.newState));
setAttackFxEvent(null);
setHealFxEvent(createHealFxEvent(gameState, result.newState, isAllHeal));   // ← 추가
// ...기존 beats 추가
```

- `const [healFxEvent, setHealFxEvent] = useState<HealFxEvent | null>(null);` 추가.
- 다른 핸들러(start/back/home/일반 choice)에서 `setAttackFxEvent(null)` 옆에 `setHealFxEvent(null)` 도 같이 호출(잔상 방지).
- `<PartyHud status={statusWindow} healFxEvent={healFxEvent} onOpenDrawer={...} />` 로 prop 전달.

> 대상(`action.targetIndex`)은 InventoryPanel/PartyDrawer 의 `buildUseItemChoice` 가 `getBagItemTargetIndex` 로 자동 계산한 값으로 들어온다(기존 그대로). diff 방식이라 단일/전체/액션 모두 별도 분기 없이 처리된다.

### 3.2 `src/components/PartyHud.tsx` — 엔진 로드 + 칩 ref + 재생

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { StatusWindowData } from "@/lib/types";
import type { HealFxEvent } from "@/app/page"; // 또는 types.ts

const PLAY_TYPE = { heal: "heal", allheal: "allheal", action: "action" } as const;

export default function PartyHud({
  status,
  healFxEvent,
  onOpenDrawer,
}: {
  status: StatusWindowData;
  healFxEvent: HealFxEvent | null;
  onOpenDrawer: () => void;
}) {
  const [fxReady, setFxReady] = useState(false);
  const chipRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fxRefs = useRef<({ play: (t: string, o?: Record<string, unknown>) => void } | null)[]>([]);
  const lastEventId = useRef<string | null>(null);

  // 칩별 HealFX 인스턴스 생성
  useEffect(() => {
    const FX = (window as typeof window & {
      HealFX?: { create: (a: { chip: HTMLElement }) => { play: (t: string, o?: Record<string, unknown>) => void } };
    }).HealFX;
    if (!fxReady || !FX) return;

    fxRefs.current = chipRefs.current.map((chip) => (chip ? FX.create({ chip }) : null));
  }, [fxReady]);

  // 이벤트 수신 → 재생 (id 가드로 1회만)
  useEffect(() => {
    if (!healFxEvent || lastEventId.current === healFxEvent.id) return;
    lastEventId.current = healFxEvent.id;

    healFxEvent.targets.forEach(({ index, kind, amount }) => {
      const fx = fxRefs.current[index];
      const chip = chipRefs.current[index];
      if (!fx) return;
      const fill = chip?.querySelector<HTMLElement>(".hp-bar-fill") ?? null;
      fx.play(PLAY_TYPE[kind], {
        label: kind === "action" ? `특수액션 +${amount}` : `+${amount}`,
        bars: kind === "action" || !fill ? [] : [fill],
      });
    });
  }, [healFxEvent]);

  return (
    <div className="panel-shell hud">
      <Script src="/heal-fx.js" strategy="afterInteractive" onLoad={() => setFxReady(true)} />
      {/* ...기존 hud-meta... */}
      <div className="hud-chips">
        {SLOTS.map((s, i) => {
          /* ...기존 c/pct/cls... */
          return (
            <div className="chip" key={s.key} ref={(el) => { chipRefs.current[i] = el; }}>
              {/* ...기존 칩 내부 그대로... */}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

> `heal-fx.css` 의 입자가 칩 밖(위)으로 살짝 넘쳐도 보이도록, 엔진이 칩에 `.heal-fx-host{position:relative}` 와 `.heal-fx-layer{overflow:visible}` 를 자동 부여한다. 칩 컨테이너에 `overflow:hidden` 이 걸려 있으면 입자가 잘리니 주의.

### 3.3 `src/app/globals.css`

```css
@import "./attack-fx.css";
@import "./heal-fx.css";   /* ← 추가 */
```

---

## 4. 엔진 API 요약 (`heal-fx.js` 상단 주석 참고)

```js
const fx = HealFX.create({ chip });                 // 대상 칩 1개당 1회
fx.play("heal",   { label: "+5", bars: [hpFillEl] });
fx.play("allheal",{ label: "+4", bars: [hpFillEl] });  // 전원: 칩마다 반복 호출
fx.play("action", { label: "특수액션 +1" });            // 바 없음
```

- 재생 시 칩에 자동으로: 빛 입자(✦/✧/❖/＋ + 광점) 분출 · 안쪽 오라 글로우 · 살짝 들썩 · `+숫자` 부상 · `bars` 충전 광택. 전부 ~0.6초.
- `prefers-reduced-motion: reduce` 시 입자/부상/광택은 표시하지 않음(상태는 정상 갱신).

---

## 5. 검증 체크리스트

- [ ] 단일 회복 아이템 사용 → 자동선택 대상(최저 HP)에 회복 FX(빛 입자 + HP 바 충전) 재생.
- [ ] 전체 회복 아이템 → 회복된 전원 칩에 동시 FX.
- [ ] 특수액션 회복 → 파란 입자 + `특수액션 +N` + 스킬 텍스트 갱신.
- [ ] 사용 불가 아이템(대상 없음)은 비활성.
- [ ] 같은 이벤트가 리렌더로 중복 재생되지 않음(id 가드).
- [ ] 칩 컨테이너 `overflow` 로 입자가 잘리지 않음.

---

## 6. 동봉 파일

- `heal-fx.js` — 엔진(의존성 없음). 상단에 전체 API 주석.
- `heal-fx.css` — 모든 스타일/키프레임.
- `heal-fx-demo.html` — 엔진 통합 데모(브라우저로 바로 열어 동작 확인). **동작 기준 파일.**
