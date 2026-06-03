# page.tsx 수정 가이드 (정확한 diff)

대상: `src/app/page.tsx`
두 군데만 수정한다. 다른 로직은 건드리지 않는다.

---

## ① import 추가

상단 컴포넌트 import 묶음에 한 줄 추가한다.

```diff
 import CommandMenu from "@/components/CommandMenu";
+import ConferOverlay from "@/components/ConferOverlay";
 import PartyDrawer from "@/components/PartyDrawer";
 import PartyHud from "@/components/PartyHud";
 import ScriptStage, { AttackFxEvent } from "@/components/ScriptStage";
```

(알파벳 순서상 `CommandMenu` 다음 위치. 순서가 어긋나도 동작에는 영향 없음.)

---

## ② 오버레이 조건부 렌더 추가

`return (<main className="play"> … )` 안에서 `.stage` 를 닫는 `</div>` **직후**,
`<PartyDrawer …>` **직전**에 삽입한다.

```diff
         />
       </div>

+      {/* ▼ 다음 장면 생성 대기 — 중앙 오버레이 */}
+      {choiceSubmitStatus === "submitting" ? (
+        <ConferOverlay status={statusWindow} />
+      ) : null}
+
       <PartyDrawer
         open={drawerOpen}
         onClose={() => setDrawerOpen(false)}
```

### 위치를 못 찾을 때의 식별 기준
- 바로 위의 `</div>` 는 `<div className="stage"> … </div>` 의 닫는 태그다.
  (그 안에 `<ScriptStage … />` 와 `<CommandMenu … />` 가 들어있다.)
- `statusWindow` 는 이 지점에서 non-null 이 보장된다.
  (함수 상단 `if (!gameState || !statusWindow) return <StartScreen … />` 가드 때문.)
  따라서 `status={statusWindow}` 에 타입 에러가 없다.

---

## 검증

```bash
npm run dev      # 또는 pnpm dev
```

1. 게임 진행 → 행동 선택지 클릭 → 화면 중앙에 대기 모달 표시
2. 활성 좌석이 ~1.9초마다 순환, 멘트 변경
3. 응답 도착 → 모달 사라지고 새 나레이션 비트 추가
4. `npm run build` / `npm run lint` 통과 확인 (타입 에러 없음)
