# 구현 플랜 — 전투 공격 이펙트 엔진 적용 (클래스별 동적 연출)

> 대상: 이 Next.js(App Router) 프로젝트
> 목표: 전투 화면에서 행동 선택 시 **직업/스킬별로 다른 공격 이펙트**(베기·찌르기·마법·강타·암습·속박)를 보스 타겟 위에 재생한다.
> ⚠️ 표현(연출) 레이어만 추가한다. 게임 엔진·API·데미지 계산·상태 로직은 그대로 두고, **기존 결과값을 받아 이펙트만 트리거**한다.

---

## 0. 방식 요약

순수 JS 엔진 1개 + CSS 1개로 동작하는 **프레임워크 무관** 이펙트 시스템이다.

- `attack-fx.js` → `window.AttackFX` 전역. `AttackFX.create({arena, target, fxLayer})` 로 인스턴스 생성 후 `fx.play(name, opts)` 호출.
- `attack-fx.css` → 모든 키프레임 + 엔진 공용(흔들림/플래시/피격/데미지 숫자/속박 상태) 스타일.
- 데미지 계산·치명타 판정·HP 갱신은 **기존 로직 그대로**. 이펙트는 그 결과(`{damage, crit}`)를 받아 시각화만 한다.
- 새 이펙트 추가는 `AttackFX.register('이름', fn)` **한 줄**.

시각 정답지: 동봉한 `attack-fx-demo.html`(엔진 단독 데모) 및 프로젝트의 `variant-a-fx.html`(전투 화면 통합본). 동작 기준은 이 두 파일이다.

---

## 1. 에셋 준비

- `attack-fx.css` → `src/styles/attack-fx.css` (또는 `app/` 내 적절한 위치)로 복사.
- `attack-fx.js` → 두 가지 중 택1:
  - (간단) `public/attack-fx.js` 로 복사 후 `<Script>` 로 로드.
  - (권장) `src/lib/attack-fx.js` 로 옮기고 마지막 줄을 `export const AttackFX = ...` 형태로 바꿔 ES 모듈 import. (아래 2.3 참고)
- 이미지/폰트 의존성 없음. 모든 연출은 CSS/이모지/유니코드로 그린다.

---

## 2. 수정 / 추가 파일

### 2.1 전역 스타일 로드 — `src/app/globals.css` 또는 layout

```css
@import "../styles/attack-fx.css";   /* globals.css 상단에 추가 */
```

`attack-fx.css` 의 색상은 호스트의 CSS 변수(`--accent-gold` 등)를 쓰지 않고 자체 값으로 동작하므로 토큰 충돌 없음.

### 2.2 전투 무대 DOM — 보스 패널 컴포넌트 (예: `src/components/BossStage.tsx`)

엔진이 요구하는 **3개 ref**를 갖춘 마크업을 만든다. 클래스명은 CSS와 1:1로 맞춘다.

```tsx
// 핵심 구조만 발췌
<div className="boss-stage" ref={arenaRef}>        {/* 흔들림/플래시 대상 */}
  <div className="fx-target" ref={targetRef}>      {/* 피격 타겟 */}
    <span className="glyph">💀</span>
  </div>
  <div className="fx-layer" ref={fxRef} />          {/* 이펙트가 그려지는 빈 레이어 */}
</div>
```

> `boss-stage / fx-target / .glyph / fx-layer` 의 **레이아웃 CSS**(크기·중앙정렬·overflow)는 호스트가 정의한다.
> `variant-a-fx.html` 의 `.boss-stage` 블록 CSS를 그대로 옮기면 된다(이미 검증됨).
> `fx-target.fx-hit`, `fx-bound`, `.fx-dmg` 등 **동작 스타일**은 `attack-fx.css` 가 제공한다.

### 2.3 엔진 초기화 + 호출 — 전투 컨테이너 (예: `src/components/Combat.tsx`)

```tsx
import { useEffect, useRef } from "react";
// 모듈화한 경우:  import { AttackFX } from "@/lib/attack-fx";

const arenaRef = useRef(null), targetRef = useRef(null), fxRef = useRef(null);
const fxRef2 = useRef(null);   // AttackFX 인스턴스 보관

useEffect(() => {
  const FX = (window as any).AttackFX;     // <Script> 로드 시
  fxRef2.current = FX.create({
    arena: arenaRef.current,
    target: targetRef.current,
    fxLayer: fxRef.current,
  });
}, []);

// 기존 "공격 결과 처리" 지점에서 호출 (엔진이 데미지/치명타를 이미 계산했다고 가정)
function onAttackResolved(result) {
  // result = { effect:'smash', damage:14, crit:true, color:'#ffe9bd', status?:true }
  fxRef2.current.play(result.effect, {
    damage: result.damage,
    crit: result.crit,
    color: result.color,
    turns: result.turns ?? 2,
    onImpact: () => {
      // 타격 타이밍에 호출됨 → 여기서 보스 HP 상태 갱신(기존 setState)
      setBossHp(hp => Math.max(0, hp - result.damage));
    },
    onApply: () => {
      // 속박 등 상태 부여 시점 → 상태 뱃지 표시(기존 setState)
      setBossEffect("🔗 마력속박 (2턴)");
    },
  });
}
```

### 2.4 행동 → 이펙트 매핑 테이블 (직업/스킬 → effect name)

```ts
// 기존 행동 정의에 effect 필드만 추가하거나, 매핑 테이블로 분리
const FX_MAP = {
  warrior_basic: "slash",
  warrior_skill_smash: "smash",
  rogue_basic: "stab",
  rogue_skill_ambush: "ambush",
  mage_basic: "magic",
  mage_skill_bind: "bind",
};
```

GM 응답/엔진 결과에서 직업·스킬 식별자를 위 키로 변환해 `result.effect` 로 넘긴다.

---

## 3. 등록된 이펙트 (현재)

| effect name | 직업 | 연출 | 특징 |
|---|---|---|---|
| `slash`  | 전사 | 대각선 참격 2겹 | 기본 |
| `stab`   | 도적 | 3연속 관통 + 스파크 | 기본 |
| `magic`  | 마법사 | 마법진 + 룬 파티클 + 폭발 | 기본 |
| `smash`  | 전사(스킬) | 내려찍기 → 충격파 링 + 균열 | **강한 화면 진동** |
| `ambush` | 도적(스킬) | 화면 암전 → 사방 교차 베기 → 보랏빛 치명 폭발 | 어두운 플래시 |
| `bind`   | 마법사(스킬) | 마법진 조임 + 8방향 사슬 + 자물쇠 | **지속 속박 상태**(`fx-bound`) 부여 |

---

## 4. 새 이펙트 추가 방법 (확장)

`attack-fx.js` 하단 패턴을 그대로 따른다. CSS 키프레임을 `attack-fx.css` 에 추가하고, JS에 등록:

```js
// 1) attack-fx.css 에 .fx-firewall { ...keyframes... } 추가
// 2) 등록
AttackFX.register("firewall", (ctx, opts) => {
  const wall = ctx.el("fx-firewall");
  ctx.spawn(wall, 600);   // fxLayer에 추가 후 600ms 뒤 자동 제거
  ctx.run(wall);          // 다음 프레임에 .go 부여 → 애니 시작
  ctx.shake();            // 선택: 화면 흔들림
  ctx.impact(opts, 250);  // 250ms 뒤 타격 처리(hitTarget + damageNumber + onImpact)
});
```

`ctx` 헬퍼: `el / spawn / run / flash(dark?) / shake(hard?) / hitTarget(crit) / damageNumber / statusText / bound(on) / impact(opts, delay) / rand`. (상세는 `attack-fx.js` 상단 주석 참고)

---

## 5. 검증 체크리스트

- [ ] 6개 행동 각각에서 보스 타겟 위에 **서로 다른** 연출이 재생된다.
- [ ] 이펙트의 타격 타이밍(`onImpact`)에 맞춰 보스 HP가 감소한다.
- [ ] 치명타 시 데미지 숫자가 금색/확대로 강조된다.
- [ ] `bind` 발동 시 보스에 지속 글로우(`fx-bound`) + 속박 뱃지가 켜진다.
- [ ] 보스 블록이 sticky여도 흔들림 중 레이아웃이 점프하지 않는다(흔들림은 `boss-stage`에만 적용).
- [ ] 모바일 폭에서도 이펙트가 무대 안에 클리핑되어 깨지지 않는다.

---

## 6. 동봉 파일

- `attack-fx.js` — 엔진(의존성 없음). 상단에 전체 API 주석.
- `attack-fx.css` — 모든 스타일/키프레임.
- `attack-fx-demo.html` — 엔진 단독 데모(브라우저로 바로 열어 동작 확인 가능).

> 프로젝트 통합 동작 예시는 시안 저장소의 `variant-a-fx.html` 참고.
