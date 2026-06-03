# TASK — 중앙 오버레이 로딩 UI 적용 (C안)

로컬 AI 에이전트(Claude Code / Codex 등)가 이 폴더를 읽고 그대로 적용하기 위한 작업 지시서.
대상 레포: `ai-trpg` (Next.js App Router + React + TypeScript).

## 목표
플레이어가 행동/대화를 제출해 **다음 장면을 생성하는 동안** 화면 중앙에
"동료들이 다음 한 수를 의논합니다" 대기 모달(중앙 오버레이)을 띄운다.
표시 트리거는 `choiceSubmitStatus === "submitting"`.

## 이 폴더 구성
```
handoff-중앙오버레이/
├─ TASK.md                          ← (이 파일) 작업 지시
├─ src/components/ConferOverlay.tsx ← 그대로 복사할 신규 컴포넌트
├─ styles/globals.append.css        ← globals.css 끝에 append 할 CSS
└─ page.tsx.patch.md                ← page.tsx 수정 diff 가이드
```

## 적용 단계 (순서대로)

1. **컴포넌트 복사**
   `src/components/ConferOverlay.tsx` 를
   레포의 `src/components/ConferOverlay.tsx` 로 그대로 복사한다.

2. **CSS append**
   `styles/globals.append.css` 의 내용을 레포 `src/app/globals.css` **맨 끝**에 추가한다.
   - ⚠️ `@keyframes fadeIn` 은 globals.css 에 **이미 존재** → 중복 추가 금지.
     (append 파일에는 fadeIn 이 들어있지 않으니 그대로 붙이면 됨.)
   - `@keyframes dotpulse` 는 레포에 없음 → 함께 추가됨(정상).

3. **page.tsx 수정**
   `page.tsx.patch.md` 의 diff 두 군데를 `src/app/page.tsx` 에 적용한다.
   - import 추가: `import ConferOverlay from "@/components/ConferOverlay";`
   - `.stage` 닫는 `</div>` 직후, `<PartyDrawer …>` 직전에 조건부 렌더 삽입:
     ```tsx
     {choiceSubmitStatus === "submitting" ? (
       <ConferOverlay status={statusWindow} />
     ) : null}
     ```

## 제약 / 주의
- **추가만** 한다. 기존 로직(`isPending`, `ScriptStage`의 `.narr-busy`,
  `CommandMenu`의 `emptyMessage`)은 수정/삭제하지 않는다.
- 새 상태값을 만들지 않는다. 기존 `statusWindow`(StatusWindowData)와
  `choiceSubmitStatus` 만 사용한다.
- 이미지 경로는 레포에 이미 있는 `/images/characters/{warrior,amy,siluella}.png` 를 쓴다.
  (`StatusWindowData` 키는 `warrior`/`amy`/`siluella` 와 일치한다 —
  ConferOverlay 의 SEATS 매핑이 이미 분리 처리함.)
- 새 npm 의존성 없음.

## 완료 기준 (DoD)
- [ ] `npm run lint` 통과 (타입/ESLint 에러 없음)
- [ ] `npm run build` 통과
- [ ] `npm run dev` 에서 행동 선택 시 중앙 오버레이 표시 → 응답 후 사라짐
- [ ] 활성 좌석 순환(~1.9s)·멘트 회전 동작
- [ ] OS "동작 줄이기"(prefers-reduced-motion) 시 깜빡임 정지

## 참고
설계 배경과 엣지 케이스는 레포 밖 문서 `중앙 오버레이 로딩 UI - 적용 plan.md` 참고
(트리거 선정 이유, 스크롤 잠금/빠른 응답 깜빡임 대응 등).
