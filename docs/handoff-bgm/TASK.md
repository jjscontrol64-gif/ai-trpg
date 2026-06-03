# TASK — BGM 토글 UX 개선 (전역 유지 / 위치·레이블 2건)

로컬 AI 에이전트가 그대로 적용하기 위한 지시서. 대상 레포: `ai-trpg`.
BGM 토글은 **전역(layout.tsx) 그대로 유지**하면서 아래 2가지만 개선한다.

## 변경 요지
1. **위치**: 화면 중앙 상단에 떠 있던 버튼을 **우상단 코너로 이동**.
   (어떤 패널에도 안 붙어 "디버그 요소"처럼 보이던 문제 해결. 전역 fixed는 유지.)
2. **레이블**: 모호한 `BGM ON / OFF` 텍스트 대신 **🔊/🔇 아이콘으로 상태 표현**,
   라벨은 `BGM` 고정. (상태인지 동작인지 헷갈리던 문제 해결.)
   접근성: `aria-label` 로 동작 안내, `aria-pressed` 로 상태 전달.

## 이 폴더
```
handoff-bgm/
├─ TASK.md
├─ src/components/BgmToggle.tsx   ← 기존 파일 전체 교체
└─ styles/globals.bgm.css         ← globals.css 의 기존 .bgm-* 규칙 교체
```

## 적용 단계
1. **컴포넌트 교체**: `src/components/BgmToggle.tsx` 를 이 폴더의 동일 파일로 덮어쓴다.
   - `layout.tsx` 의 `<div className="bgm-layer"><BgmToggle /></div>` 는 **그대로 둔다**(전역 유지).
2. **CSS 교체**: `src/app/globals.css` 에서 기존 `.bgm-layer` / `.bgm-toggle` /
   `.bgm-toggle.is-on` 3줄(대략 line 491~493)을 찾아, `styles/globals.bgm.css` 내용으로 교체한다.
   - 핵심 차이: `left:50%;transform:translateX(-50%)` → `right:1rem;transform:none`,
     `min-width:6.4rem` 제거, `.bgm-ico/.bgm-label` 규칙 추가.

## 제약
- 오디오 로직(소스/볼륨/loop/자동재생 폴백)은 **변경 금지**. 위치·레이블·접근성만 손댄다.
- 새 의존성 없음. 기본값 OFF 유지.

## 완료 기준
- [ ] `npm run lint` / `npm run build` 통과
- [ ] 버튼이 **우상단 코너**에 표시(시작 화면 포함 전역)
- [ ] 꺼짐=🔇 BGM(중립), 켜짐=🔊 BGM(금색)으로 즉시 구분
- [ ] 헤더의 Save/Export 등 우상단 액션과 겹치지 않음(세로로 분리)
- [ ] 클릭 시 재생/정지 정상, 자동재생 차단 시 OFF로 복귀
