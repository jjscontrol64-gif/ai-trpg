# 플레이 화면 리디자인 구현 플랜 — "시안 A · 스크립트 + 커맨드 메뉴"

> 대상 저장소: 이 Next.js(App Router) 프로젝트
> 목표: 플레이 화면을 **어드벤처 게임형 레이아웃**으로 교체한다.
> **상단 = 파티 상태 HUD 바(1줄)**, 그 아래 **왼쪽 = 대사 스크립트형 나레이션 / 오른쪽 = 커맨드 메뉴형 행동 선택**(가로 정렬).
>
> ⚠️ **이번 작업은 "표현(레이아웃/마크업/CSS)만" 변경한다.** 게임 엔진·API·상태 로직·핸들러 시그니처는 건드리지 않는다. (`src/lib/**`, `src/app/api/**` 변경 금지)

---

## 0. 현재 구조 요약 (변경 전)

`src/app/page.tsx` (`HomePage`)가 게임 상태와 모든 핸들러를 보유하고, 아래 그리드를 렌더한다.

```
<main>
  <header.panel-shell>  난이도/페이즈/위치 pill + Save/뒤로가기
  <div grid xl:[1.35fr_380px]>
    <section> 나레이션 피드(panel-shell) + 행동 선택(panel-shell, TRPGChoice) </section>
    <aside>   StatusWindow(세로 카드 3개 + 몬스터 + 소지품) + 핵심 규칙 </aside>
  </div>
</main>
```

핵심 상태/핸들러 (모두 **그대로 유지**):
- `gameState: GameState | null`, `statusWindow: StatusWindowData | null`
- `beats: StoryBeat[]`, `currentChoices: ChoiceOption[]`
- `handleChoice(choice, appendUserBeat?, updateHistory?)`, `handleTalk()`, `handleSave()`, `handleBack()`
- `inspirationArmed` / `setInspirationArmed`, `canTalk`, `isPending`, `choiceSubmitStatus`, `previousSnapshot`
- `logRef`(피드 자동 스크롤)

데이터 형태 (이미 존재, `src/lib/types.ts`):
- `StatusWindowData = { warrior, pina, mina, monster, party }`
- `CharacterStatusDisplay = { name, hp: "10/10", str, dex, int, skill: "강타(3/3) 활로개척(3/3)", equip: [머리, 몸통, 무기] }`  ← str/dex/int는 `"4"` 또는 `"4+2"` 문자열
- `MonsterStatusDisplay = { name, hp, maxHp, level: "Ⅰ"|"Ⅱ"|"Ⅲ"|"💀", statusEffect?: "속박(2턴 남음)" }`
- `PartyStatusDisplay = { inv, floor: "2️⃣", loc, star: "★★☆" }`
- `gameState.party.inspiration: number` (0–3)
- `ChoiceOption = { label, text, action }`
- `DiceRollResult` → 기존 `DiceResult` 컴포넌트로 렌더

> 캐릭터 슬롯 ↔ 표시 매핑 (현 `StatusWindow`와 동일):
> `warrior → ⚔️ 전사 / --accent-gold`, `pina → 🗡️ 도적 / --accent-ember`, `mina → 🔮 마법사 / --accent-blue`

---

## 1. 목표 레이아웃 (변경 후)

```
<main>
  ┌─ TopBar(slim) ── 제목 · 난이도/페이즈 pill · Save · 뒤로가기 ─┐
  ├─ PartyHud (full-width, 1줄) ───────────────────────────────┐
  │   [파티 메타: 층·위치·★영감]  [⚔️아르곤칩] [🗡️피나칩] [🔮미나칩] │
  ├─ Stage (가로 2단) ─────────────────────────────────────────┤
  │  ┌ ScriptStage (flex:1, ~60%) ─┐  ┌ CommandMenu (~340px) ─┐ │
  │  │ (전투 시) 보스 배너 sticky    │  │ 행동 선택 (커맨드 메뉴) │ │
  │  │ 다이스 박스(인라인)           │  │  ▸ 1  ⚔️ …            │ │
  │  │ 나레이션(각본/지문체)         │  │    2  🧭 …            │ │
  │  │ ▶ 플레이어 행동 라인          │  │    3  🔍 …            │ │
  │  │ …내부 스크롤…                 │  │  ─ 대화하기 · 영감 ★ ─ │ │
  │  └──────────────────────────────┘  └───────────────────────┘ │
  └──────────────────────────────────────────────────────────────┘
</main>
```

- **PartyHud**: 한 줄짜리 바. 좌측에 파티 메타(층/위치/영감 별), 우측에 캐릭터 칩 3개(아바타+이름+역할+HP 바+스탯 한 줄+특수액션 요약).
- **ScriptStage**: 나레이션을 "각본/지문" 톤으로. 화자 라벨 컬럼(좌) + 대사/지문(우). 다이스는 인라인 박스. 전투 중이면 상단에 **보스 배너 sticky**.
- **CommandMenu**: 고전 RPG 커맨드 창. 세로 메뉴 + `▸` 선택자(hover/focus 시) + `1/2/3` 키 배지. 하단 푸터에 `대화하기` + `영감` 토글(+ ★ 잔량).
- **인벤토리 / 장비 상세 / 핵심 규칙**: 화면을 깔끔히 유지하기 위해 **슬라이드오버 드로어**(`PartyDrawer`)로 이동. HUD 또는 커맨드 푸터의 `🎒 가방/상세` 버튼으로 토글. (기존 인벤토리 사용 버튼·장비·규칙 마크업을 그대로 재사용)

---

## 2. 파일 변경 체크리스트

신규/수정 파일 (모두 `"use client"`):

- [ ] `src/components/PartyHud.tsx` — **신규**. 상단 HUD 바.
- [ ] `src/components/ScriptStage.tsx` — **신규**. 각본형 나레이션 피드(보스 배너 포함). `beats`, `logRef`, `isPending`, `monster` 받음.
- [ ] `src/components/CommandMenu.tsx` — **신규**. 커맨드형 행동 선택 + 대화/영감 푸터.
- [ ] `src/components/PartyDrawer.tsx` — **신규(권장)**. 인벤토리 사용 + 캐릭터 장비/특수액션 상세 + 핵심 규칙. (기존 `StatusWindow`의 디테일과 인벤토리 버튼 로직을 흡수)
- [ ] `src/app/page.tsx` — **수정**. 그리드/마크업을 위 레이아웃으로 교체. **핸들러·상태 로직은 그대로**, JSX만 교체.
- [ ] `src/app/globals.css` — **수정**. 아래 §4 CSS 클래스 추가.
- [ ] `src/components/StatusWindow.tsx` — 더 이상 메인에서 직접 쓰지 않음. 내용은 `PartyHud`(요약) + `PartyDrawer`(상세)로 분산. 파일은 삭제하거나 `PartyDrawer` 내부 참고용으로 보존.
- [ ] `src/components/TRPGChoice.tsx` — `CommandMenu`로 대체. 기존 파일은 삭제 가능(아래 `CommandMenu`가 동일한 `onSelect(choice)` 계약 사용).
- [ ] `src/components/DiceResult.tsx` — **변경 없음**(그대로 인라인 사용). 시각만 살짝 콤팩트하게 하려면 §4의 `.dice-block` 톤을 참고.

시각적 정답지: 동봉된 `adventure-layouts.html`의 **A 시안 아트보드**가 픽셀 기준이다. (HUD 칩, 스크립트 라인, 커맨드 메뉴의 간격/색/타이포를 그대로 따른다.)

---

## 3. 컴포넌트 상세 (JSX 가이드)

> 아래는 구조/네이밍/클래스 가이드. 색·여백은 §4 CSS가 처리하므로 className 위주로 작성한다.

### 3.1 `PartyHud.tsx`

```tsx
"use client";
import { StatusWindowData } from "@/lib/types";

const SLOTS = [
  { key: "warrior", icon: "⚔️", role: "전사",   color: "var(--accent-gold)"  },
  { key: "pina",    icon: "🗡️", role: "도적",   color: "var(--accent-ember)" },
  { key: "mina",    icon: "🔮", role: "마법사", color: "var(--accent-blue)"  },
] as const;

function hpPct(hp: string) {
  const [c, m] = hp.split("/").map(Number);
  return m > 0 ? Math.max(0, Math.min(100, (c / m) * 100)) : 0;
}

export default function PartyHud({
  status, inspiration, onOpenDrawer,
}: {
  status: StatusWindowData;
  inspiration: number;          // gameState.party.inspiration
  onOpenDrawer: () => void;
}) {
  return (
    <div className="panel-shell hud">
      <div className="hud-meta">
        <span className="hud-name">파티 상태</span>
        <div className="hud-tags">
          <span className="hud-tag">{status.party.floor} 층</span>
          <span className="hud-tag">📍 {status.party.loc}</span>
        </div>
        <span className="hud-stars">★ {status.party.star}</span>
        <button type="button" className="hud-bag" onClick={onOpenDrawer}>🎒 상세</button>
      </div>

      <div className="hud-chips">
        {SLOTS.map((s) => {
          const c = status[s.key];
          const pct = hpPct(c.hp);
          const cls = pct > 60 ? "hp-high" : pct > 30 ? "hp-mid" : "hp-low";
          return (
            <div className="chip" key={s.key}>
              <span className="av">{s.icon}</span>
              <div className="chip-body">
                <div className="chip-top">
                  <span className="chip-nm">{c.name}</span>
                  <span className="chip-role" style={{ color: s.color }}>{s.role}</span>
                </div>
                <div className="chip-hp">
                  <span className="chip-hp-lbl">HP</span>
                  <span className="hp-bar"><span className={`hp-bar-fill ${cls}`} style={{ width: `${pct}%` }} /></span>
                  <span className="chip-hp-v">{c.hp}</span>
                </div>
                <div className="chip-meta">
                  <span className="chip-stats">💪{c.str} · 🏃{c.dex} · 💡{c.int}</span>
                  <span className="chip-skill" title={c.skill}>{c.skill}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```
> 참고: `hp-bar` / `hp-bar-fill` / `hp-high|mid|low` 는 globals.css에 **이미 존재**. ⚠️ HUD 칩의 fill은 `display:block`이어야 보인다(§4에서 보강).

### 3.2 `ScriptStage.tsx`

```tsx
"use client";
import { RefObject } from "react";
import { StoryBeat, MonsterStatusDisplay } from "@/lib/types";
import DiceResult from "./DiceResult";

export default function ScriptStage({
  beats, monster, isPending, logRef,
}: {
  beats: StoryBeat[];
  monster: MonsterStatusDisplay | null;
  isPending: boolean;
  logRef: RefObject<HTMLDivElement | null>;
}) {
  const mPct = monster ? (parseInt(monster.hp,10) / parseInt(monster.maxHp,10)) * 100 : 0;
  return (
    <div className="panel-shell col-narr">
      <div className="narr-head">
        <div><p className="panel-kicker">Scene · Script</p><h2 className="panel-title">대화 / 나레이션</h2></div>
        {isPending ? <span className="narr-busy">처리 중…</span> : null}
      </div>

      <div ref={logRef} className="narr-scroll">
        {monster ? (
          <div className="boss sticky-host">
            <div className="boss-r">
              <span className="boss-nm">{monster.level} {monster.name}</span>
              <span className="boss-hpv">HP {monster.hp} / {monster.maxHp}</span>
            </div>
            <span className="hp-bar boss-bar"><span className="hp-bar-fill hp-low" style={{ width: `${mPct}%` }} /></span>
            {monster.statusEffect ? <span className="boss-eff">🔗 {monster.statusEffect}</span> : null}
          </div>
        ) : null}

        {beats.map((beat) => {
          if (beat.role === "user") {
            return (
              <div key={beat.id} className="scriptline player">
                <span className="who">▶ 행동</span>
                <span className="said">{beat.text}</span>
              </div>
            );
          }
          return (
            <article key={beat.id} className="beat">
              {beat.diceResult ? <DiceResult result={beat.diceResult} summary={beat.eventSummary} /> : null}
              <div className={`scriptline gm ${beat.diceResult ? "mt" : ""}`}>
                <span className="who">나레이션</span>
                <span className="said">{beat.narration}</span>
              </div>
              {!beat.diceResult && beat.eventSummary ? (
                <div className="beat-summary">{beat.eventSummary}</div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
```
> **각본 톤의 한계**: AI 나레이션은 화자별로 구조화돼 있지 않은 단일 문자열(`narration`)이다. 따라서 "각본 느낌"은 **좌측 화자 라벨 컬럼 + 지문 이탤릭 타이포**로 표현하고, 본문은 통째로 `나레이션` 지문으로 렌더한다.
> (선택적 향상) 본문 내 `"..."` 따옴표 구간을 정규식으로 잘라 `대사` 라인으로 분리하고 싶다면 별도 헬퍼로 후처리할 수 있으나, **이번 범위에서는 권장하지 않음**(엔진/프롬프트 출력 포맷을 먼저 합의해야 안전).

### 3.3 `CommandMenu.tsx`

```tsx
"use client";
import { useEffect } from "react";
import { ChoiceOption } from "@/lib/types";

export default function CommandMenu({
  choices, onSelect, onTalk, canTalk,
  inspirationArmed, onToggleInspiration, inspiration,
  disabled, emptyMessage,
}: {
  choices: ChoiceOption[];
  onSelect: (c: ChoiceOption) => void;
  onTalk: () => void;
  canTalk: boolean;
  inspirationArmed: boolean;
  onToggleInspiration: () => void;
  inspiration: number;
  disabled: boolean;
  emptyMessage?: string;
}) {
  // 키보드 1/2/3 으로 선택 (커맨드 창 느낌)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const i = ["1","2","3"].indexOf(e.key);
      if (i >= 0 && choices[i] && !disabled) onSelect(choices[i]);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [choices, disabled, onSelect]);

  return (
    <div className="panel-shell cmd">
      <p className="panel-kicker">Command</p>
      <h2 className="panel-title">행동 선택</h2>

      <div className="cmd-list">
        {choices.length === 0 ? (
          <div className="cmd-empty">{emptyMessage ?? "선택 가능한 행동이 없습니다."}</div>
        ) : choices.map((c, i) => (
          <button key={i} type="button" className="ch" disabled={disabled} onClick={() => onSelect(c)}>
            <span className="sel">▸</span>
            <span className="key">{i + 1}</span>
            <span className="lbl">{c.label}</span>
          </button>
        ))}
      </div>

      <div className="cmd-foot">
        <button type="button" className="mini-btn" onClick={onTalk} disabled={!canTalk || disabled}>대화하기</button>
        <button
          type="button"
          className={`mini-btn ${inspirationArmed ? "gold" : ""}`}
          aria-pressed={inspirationArmed}
          onClick={onToggleInspiration}
          disabled={disabled}
        >영감 ★ {inspiration}/3</button>
      </div>
    </div>
  );
}
```
> `onSelect`는 기존 `handleChoice`와 동일 계약(`(choice) => void`). `영감` 토글/`대화하기`도 기존 `inspirationArmed`/`handleTalk`/`canTalk`를 그대로 연결.

### 3.4 `PartyDrawer.tsx` (권장)

슬라이드오버(우측에서 등장, backdrop 클릭/Esc로 닫힘). 내용은 **기존 기능 그대로 이전**:
- 캐릭터 3인의 **장비 슬롯**(머리/몸통/무기) + **특수액션**(`skill` 문자열) 상세 — 기존 `StatusWindow`의 `CharacterCard` 하단부 마크업 재사용.
- **인벤토리**: 기존 인벤토리 `<button>`(소비 아이템 `사용`) 로직과 핸들러를 그대로. 사용 액션은 `handleChoice`로 연결되는 기존 흐름 유지.
- **핵심 규칙** 3줄(기존 Rule Notes 마크업 복붙).

```tsx
export default function PartyDrawer({ open, onClose, status, /* + inventory handlers */ }: …) {
  return (
    <>
      <div className={`drawer-backdrop ${open ? "open" : ""}`} onClick={onClose} />
      <aside className={`drawer ${open ? "open" : ""}`} role="dialog" aria-modal="true">
        {/* 장비/특수액션 · 인벤토리 · 핵심 규칙 */}
      </aside>
    </>
  );
}
```

### 3.5 `page.tsx` 교체 (JSX 골자)

게임 진행 화면(`return (<main> …)`) 부분만 아래로 교체. **상단 핸들러/상태/`useEffect`/`StartScreen` 분기는 전부 유지.**

```tsx
return (
  <main className="play">
    <header className="topbar panel-shell">
      <h1 className="game-title">{playerName}의 던전 탐험</h1>
      <div className="topbar-actions">
        <span className="pill">{getModeLabel(gameState.mode)}</span>
        <span className="pill">{getPhaseLabel(gameState.phase)}</span>
        <button className="pill" onClick={handleSave} disabled={isPending}>
          {saveStatus === "saved" ? "Saved" : saveStatus === "error" ? "Save failed" : "Save"}
        </button>
        <button className="pill" onClick={handleBack}
          disabled={!previousSnapshot || choiceSubmitStatus === "submitting"}>뒤로가기</button>
      </div>
    </header>

    {error ? <div className="play-error">{error}</div> : null}

    <PartyHud status={statusWindow} inspiration={gameState.party.inspiration}
      onOpenDrawer={() => setDrawerOpen(true)} />

    <div className="stage">
      <ScriptStage beats={beats} monster={statusWindow.monster} isPending={isPending} logRef={logRef} />
      <CommandMenu
        choices={currentChoices}
        onSelect={handleChoice}
        onTalk={handleTalk}
        canTalk={canTalk}
        inspirationArmed={inspirationArmed}
        onToggleInspiration={() => setInspirationArmed((v) => !v)}
        inspiration={gameState.party.inspiration}
        disabled={choiceSubmitStatus === "submitting"}
        emptyMessage={
          gameState.phase === "victory" ? "정복 엔딩이 출력되었습니다."
          : gameState.phase === "game_over" ? "패배 엔딩이 출력되었습니다."
          : choiceSubmitStatus === "submitting" ? "다음 선택지를 생성하고 있습니다."
          : undefined
        }
      />
    </div>

    <PartyDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} status={statusWindow} /* +inventory props */ />
  </main>
);
```
> 추가 상태 1개만 신설: `const [drawerOpen, setDrawerOpen] = useState(false);`

---

## 4. globals.css 추가분

`src/app/globals.css` 하단에 그대로 추가. (토큰 `--accent-*`, `--text-*`, `.panel-shell`, `.panel-kicker`, `.panel-title`, `.hp-bar*` 는 이미 존재)

```css
/* ===== Play screen — Variant A (adventure) ===== */
.play{position:relative;min-height:100vh;padding:1.25rem 1rem;display:flex;flex-direction:column;gap:.9rem;max-width:1320px;margin:0 auto;}

/* top bar */
.topbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;padding:.85rem 1.2rem;}
.game-title{margin:0;font-family:Georgia,"Times New Roman",serif;color:var(--accent-gold);font-size:clamp(1.4rem,1.1rem + 1vw,2rem);font-weight:600;}
.topbar-actions{display:flex;flex-wrap:wrap;gap:.5rem;}
.pill{border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.15);border-radius:999px;padding:.45rem .9rem;font-size:.72rem;letter-spacing:.12em;color:var(--text-secondary);cursor:pointer;transition:transform .18s ease,border-color .18s ease;}
.pill:hover:not(:disabled){transform:translateY(-1px);border-color:rgba(215,172,97,0.35);}
.pill:disabled{opacity:.4;cursor:not-allowed;}
.play-error{border:1px solid rgba(210,101,87,0.35);background:rgba(210,101,87,0.08);border-radius:1rem;padding:.7rem 1rem;font-size:.85rem;color:var(--text-secondary);}

/* HUD bar */
.hud{display:flex;align-items:stretch;gap:14px;padding:12px 16px;}
.hud-meta{flex:none;display:flex;flex-direction:column;justify-content:center;gap:.3rem;padding-right:14px;border-right:1px solid rgba(255,255,255,0.08);min-width:130px;}
.hud-name{font-family:Georgia,serif;color:var(--accent-gold);font-size:1rem;font-weight:600;line-height:1.1;}
.hud-tags{display:flex;gap:.4rem;flex-wrap:wrap;}
.hud-tag{font-size:.62rem;color:var(--text-secondary);background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:999px;padding:.14rem .45rem;}
.hud-stars{font-size:.7rem;color:var(--accent-gold);letter-spacing:.1em;}
.hud-bag{align-self:flex-start;margin-top:.15rem;font-size:.66rem;color:var(--text-secondary);background:rgba(0,0,0,0.18);border:1px solid rgba(255,255,255,0.1);border-radius:.6rem;padding:.25rem .55rem;cursor:pointer;}
.hud-chips{flex:1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;min-width:0;}
.chip{display:flex;align-items:center;gap:.65rem;border:1px solid rgba(255,255,255,0.07);background:rgba(0,0,0,0.14);border-radius:1rem;padding:.6rem .7rem;min-width:0;}
.chip .av{flex:none;width:2.2rem;height:2.2rem;border-radius:.7rem;display:flex;align-items:center;justify-content:center;font-size:1.1rem;background:rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.08);}
.chip-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:.25rem;}
.chip-top{display:flex;align-items:baseline;justify-content:space-between;gap:.4rem;}
.chip-nm{font-size:.86rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chip-role{font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;flex:none;}
.chip-hp{display:flex;align-items:center;gap:.4rem;}
.chip-hp-lbl{font-size:.54rem;font-weight:700;letter-spacing:.1em;color:var(--accent-red);}
.chip-hp .hp-bar{flex:1;height:.4rem;}
.chip-hp .hp-bar-fill{display:block;height:100%;}     /* ⚠️ inline 요소 height 미적용 방지 */
.chip-hp-v{font-size:.58rem;color:var(--text-secondary);font-variant-numeric:tabular-nums;white-space:nowrap;}
.chip-meta{display:flex;align-items:center;justify-content:space-between;gap:.5rem;}
.chip-stats{font-size:.6rem;color:var(--text-muted);font-variant-numeric:tabular-nums;white-space:nowrap;}
.chip-skill{font-size:.56rem;color:var(--accent-gold);opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:8rem;}

/* stage: narration ↔ command */
.stage{flex:1;min-height:0;display:flex;gap:14px;}
.col-narr{flex:1;min-width:0;display:flex;flex-direction:column;padding:0;}
.narr-head{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1.3rem 0;}
.narr-busy{border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.15);border-radius:999px;padding:.35rem .8rem;font-size:.7rem;color:var(--text-secondary);}
.narr-scroll{flex:1;min-height:0;overflow-y:auto;padding:1.1rem 1.3rem 1.3rem;}
@media(min-width:1024px){.narr-scroll{max-height:calc(100vh - 17rem);}}
.narr-scroll .sticky-host{position:sticky;top:0;z-index:3;}
.beat + .beat, .beat + .scriptline, .scriptline + .beat, .scriptline + .scriptline{margin-top:1rem;}

/* screenplay lines */
.scriptline{display:grid;grid-template-columns:84px 1fr;gap:.9rem;}
.scriptline .who{text-align:right;font-size:.66rem;letter-spacing:.1em;text-transform:uppercase;font-weight:700;padding-top:.15rem;color:var(--text-muted);}
.scriptline .said{font-size:.95rem;line-height:1.8;color:var(--text-primary);white-space:pre-wrap;}
.scriptline.gm .said{color:var(--text-secondary);font-style:italic;}
.scriptline.player .who{color:var(--accent-blue);}
.scriptline.mt{margin-top:1rem;}
.beat-summary{margin:.7rem 0 0 calc(84px + .9rem);border-top:1px solid rgba(255,255,255,0.06);padding-top:.7rem;font-size:.82rem;line-height:1.7;color:var(--text-secondary);}

/* boss banner */
.boss{border:1px solid rgba(196,75,75,0.4);border-radius:1rem;background:linear-gradient(180deg,rgba(120,20,20,0.28),rgba(35,8,8,0.85));padding:.7rem .85rem;margin-bottom:1rem;}
.boss-r{display:flex;align-items:center;justify-content:space-between;gap:.6rem;}
.boss-nm{font-weight:700;color:var(--accent-red);font-size:.82rem;}
.boss-hpv{font-size:.72rem;color:var(--text-secondary);font-variant-numeric:tabular-nums;}
.boss .boss-bar{margin-top:.45rem;height:.4rem;}
.boss .hp-bar-fill{display:block;height:100%;}
.boss-eff{margin-top:.45rem;display:inline-block;font-size:.64rem;color:var(--accent-gold);background:rgba(0,0,0,0.28);border-radius:999px;padding:.2rem .55rem;}

/* command menu */
.cmd{flex:none;width:340px;display:flex;flex-direction:column;}
.cmd-list{margin-top:1rem;display:flex;flex-direction:column;gap:.3rem;}
.cmd .ch{display:flex;align-items:center;gap:.7rem;padding:.7rem .8rem;border-radius:.8rem;border:1px solid transparent;background:transparent;cursor:pointer;text-align:left;font-family:inherit;color:inherit;transition:background .18s,border-color .18s;}
.cmd .ch:hover:not(:disabled),.cmd .ch:focus-visible{background:rgba(215,172,97,0.1);border-color:rgba(215,172,97,0.3);outline:none;}
.cmd .ch:disabled{opacity:.5;cursor:not-allowed;}
.cmd .ch .sel{width:1rem;color:var(--accent-gold);font-weight:700;opacity:0;}
.cmd .ch:hover:not(:disabled) .sel,.cmd .ch:focus-visible .sel{opacity:1;}
.cmd .ch .key{flex:none;font-family:"Cascadia Code","Consolas",monospace;font-size:.66rem;color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);border-radius:.35rem;padding:.05rem .3rem;}
.cmd .ch .lbl{flex:1;font-size:.88rem;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.cmd-empty{font-size:.85rem;line-height:1.7;color:var(--text-secondary);border:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.1);border-radius:.9rem;padding:.9rem 1rem;}
.cmd-foot{margin-top:auto;display:flex;gap:.5rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,0.07);}
.mini-btn{flex:1;text-align:center;font-size:.74rem;font-weight:600;color:var(--text-secondary);border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.18);border-radius:.7rem;padding:.55rem;cursor:pointer;font-family:inherit;transition:transform .18s;}
.mini-btn:hover:not(:disabled){transform:translateY(-1px);}
.mini-btn:disabled{opacity:.4;cursor:not-allowed;}
.mini-btn.gold{color:#1a1207;background:linear-gradient(135deg,var(--accent-gold),#f6d28d);border-color:transparent;}

/* drawer */
.drawer-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);opacity:0;pointer-events:none;transition:opacity .25s;z-index:40;}
.drawer-backdrop.open{opacity:1;pointer-events:auto;}
.drawer{position:fixed;top:0;right:0;height:100vh;width:min(420px,92vw);transform:translateX(100%);transition:transform .28s ease;z-index:41;overflow-y:auto;padding:1.4rem;background:var(--bg-card);border-left:1px solid var(--border-color);backdrop-filter:blur(20px);}
.drawer.open{transform:translateX(0);}

/* ===== responsive ===== */
@media(max-width:1023px){
  .stage{flex-direction:column;}
  .cmd{width:auto;}
  .narr-scroll{max-height:56vh;}
}
@media(max-width:560px){
  .hud{flex-direction:column;}
  .hud-meta{flex-direction:row;align-items:center;flex-wrap:wrap;border-right:none;border-bottom:1px solid rgba(255,255,255,0.08);padding:0 0 .6rem;}
  .hud-chips{grid-template-columns:1fr;}      /* 칩 세로 스택 */
  .scriptline{grid-template-columns:64px 1fr;gap:.6rem;}
  .beat-summary{margin-left:0;}
}
```

---

## 5. 반응형 동작

- **≥1024px**: 위 2단(스크립트 / 커맨드). 커맨드 메뉴 340px 고정, 스크립트가 나머지.
- **<1024px**: 단을 세로로 → 스크립트(내부 스크롤, ~56vh) **위**, 커맨드 메뉴 **아래**. 커맨드는 폭 전체.
- **<560px(모바일)**: HUD가 세로로 풀림(메타 한 줄 + 칩 1열 스택), 스크립트 화자 컬럼 폭 축소. 드로어는 화면의 92vw.
- 키보드 `1/2/3`은 데스크탑 보조 입력(모바일은 탭).

---

## 6. 마이그레이션 절차 (권장 순서)

1. globals.css에 §4 블록 추가.
2. `PartyHud`, `ScriptStage`, `CommandMenu` 신규 작성.
3. `page.tsx`의 진행 화면 `return` JSX만 §3.5로 교체 + `drawerOpen` state 추가. (핸들러/`useEffect`/`StartScreen` 분기는 그대로)
4. 빌드/실행 후 기존 동작 회귀 확인 (§7).
5. `PartyDrawer` 작성 후 인벤토리·장비·규칙을 이전. 확인되면 메인에서 `StatusWindow`/`TRPGChoice` 참조 제거.
6. 미사용 컴포넌트(`StatusWindow.tsx`, `TRPGChoice.tsx`) 정리(삭제 또는 보존).

## 7. 수용 기준 (Acceptance Criteria)

- [ ] 상단에 **파티 HUD 바**가 1줄로 표시되고, 3 캐릭터 칩의 **HP 게이지가 보이며**(채워진 막대), 스탯(💪/🏃/💡)·특수액션 요약이 한 줄에 들어간다.
- [ ] HUD 아래로 **나레이션(좌) ↔ 행동 선택(우)** 가 가로로 나란히 배치된다(데스크탑).
- [ ] 나레이션은 화자 라벨 컬럼 + 지문/대사 타이포의 **각본 톤**으로 렌더되고, 다이스 판정은 인라인 다이스 박스로 표시된다.
- [ ] 행동 선택은 **커맨드 메뉴**(`▸` + `1/2/3` 키 배지)이며, `1/2/3` 키로도 선택된다.
- [ ] 전투 중이면 나레이션 상단에 **보스 배너(sticky, 빨간 HP 바)**가 뜬다.
- [ ] `대화하기`/`영감 토글`/`Save`/`뒤로가기`가 기존과 **동일하게 동작**(핸들러 그대로).
- [ ] `🎒 상세` 드로어에서 **인벤토리 사용 · 장비 · 핵심 규칙**에 접근 가능하고 기존 인벤토리 사용 흐름이 작동한다.
- [ ] `logRef` 자동 스크롤이 새 비트 추가 시 동작한다.
- [ ] `<1024px`에서 단이 세로로 쌓이고, `<560px`에서 HUD 칩이 1열로 스택된다.
- [ ] `src/lib/**`, `src/app/api/**` 는 **변경 없음**, 타입 에러/콘솔 에러 없음.

## 8. 하지 말 것

- 엔진/판정/전투/이동 로직, API 라우트, 저장 스키마 변경 금지.
- 핸들러 시그니처(`handleChoice` 등) 변경 금지 — 표현 컴포넌트는 기존 콜백을 그대로 받는다.
- 나레이션 문자열을 화자별로 강제 파싱하는 작업은 이번 범위 밖(프롬프트 출력 포맷 합의 후 별도 진행).

---

### 부록 · 시각 레퍼런스
동봉 `adventure-layouts.html`의 **A 아트보드**가 색/간격/타이포의 기준. HUD 칩, 스크립트 라인(84px 라벨 컬럼), 커맨드 메뉴(`▸`/키 배지/푸터)의 비주얼을 그대로 맞춘다.
