# AI TRPG 개발 메모리

이 프로젝트는 현재 **Next.js 16 App Router + React 19 + TypeScript strict** 기반입니다. 과거 Express/server.js/Vanilla JS 구조가 아니므로, 작업 시 `src/app`, `src/components`, `src/lib` 구조를 기준으로 판단합니다.

## 기술 스택

```txt
Framework  : Next.js 16 App Router
Frontend   : React 19 + TypeScript strict
Backend    : Next.js Route Handler (/app/api/game)
AI         : Gemini API, gemini-2.5-flash
Storage    : localStorage
Deploy     : Vercel
```

## 핵심 구조

```txt
src/
├── app/
│   ├── api/game/route.ts  # 게임 API Route Handler
│   ├── page.tsx           # 메인 게임 화면
│   └── globals.css
├── components/            # DiceResult, StatusWindow, StartScreen, TRPGChoice
├── content/               # 몬스터/아이템/방 데이터
└── lib/
    ├── ai/                # Gemini provider
    ├── engine/            # 결정적 게임 엔진
    ├── prompt.ts          # LLM 프롬프트 생성
    ├── status.ts          # 상태창 데이터 생성
    └── types.ts           # 도메인 타입
```

## 책임 분리

- 엔진: 다이스, 판정, 전투, 이동, HP, 인벤토리, 영감, 특수액션 횟수 등 결정적 로직.
- LLM: 내레이션, 대화, 선택지 label/text 생성.
- 서버: LLM이 반환한 `actionIndex`를 실제 `PlayerAction`에 매핑.
- 클라이언트: 화면 상태, 저장/불러오기, 선택 제출.

## API 흐름

```txt
브라우저 선택
  -> POST /api/game
  -> 엔진이 gameState 갱신 또는 선택지 풀 계산
  -> Gemini가 narration/choices 생성
  -> 서버가 actionIndex를 실제 PlayerAction에 매핑
  -> 브라우저가 내레이션, 선택지, 상태창 갱신
```

## 작업 주의사항

- Express `server.js`, `public/index.html`, `script.js` 구조를 가정하지 않습니다.
- API 키는 브라우저 저장소에 저장하지 않고 세션 중 서버 요청에만 사용합니다.
- 게임 상태를 바꾸는 규칙은 LLM이 아니라 엔진에서 처리합니다.
- 사용자 변경사항을 되돌리지 않습니다.
- 가능한 검증: `npm test`, `node .\node_modules\typescript\bin\tsc --noEmit`, `npm run build`.
