# AI TRPG

Next.js 기반 텍스트 던전 탐험 TRPG입니다. 플레이어는 전사를 조작하고, 피나(도적)와 미나(마법사)가 동료로 참여합니다. 서버는 결정적 게임 엔진으로 상태를 갱신하고, Gemini는 GM 내레이션과 선택지 문장을 생성합니다.

## 기술 스택

```txt
Framework  : Next.js 16 App Router
Frontend   : React 19 + TypeScript strict
Backend    : Next.js Route Handler (/app/api/game)
AI         : Gemini API, gemini-2.5-flash
Storage    : localStorage
Deploy     : Vercel
```

## 실행

```bash
npm install
npm run dev
```

기본 개발 서버는 `http://localhost:3000`입니다.

## 주요 구조

```txt
ai-trpg/
├── src/
│   ├── app/
│   │   ├── api/game/route.ts  # 게임 API
│   │   ├── page.tsx           # 메인 화면
│   │   └── globals.css
│   ├── components/            # UI 컴포넌트
│   ├── content/               # 몬스터/아이템/방 데이터
│   └── lib/
│       ├── ai/                # Gemini provider
│       ├── engine/            # 결정적 게임 엔진
│       ├── prompt.ts          # LLM 프롬프트 생성
│       ├── status.ts          # 상태창 데이터 생성
│       └── types.ts           # 도메인 타입
├── dungeon-trpg-design-doc.md
├── package.json
└── tsconfig.json
```

## API 흐름

```txt
브라우저 선택
  -> POST /api/game
  -> 엔진이 gameState 갱신 또는 선택지 풀 계산
  -> Gemini가 narration/choices 생성
  -> 서버가 actionIndex를 실제 PlayerAction에 매핑
  -> 브라우저가 내레이션, 선택지, 상태창 갱신
```

## 개발 원칙

- HP, 위치, 영감, 인벤토리, 특수액션 횟수 같은 게임 규칙은 엔진에서 결정합니다.
- LLM은 내레이션과 선택지 문장 생성만 담당합니다.
- 선택지는 반드시 서버가 제공한 `actionIndex`를 실제 `PlayerAction`에 매핑합니다.
- API 키는 브라우저 저장소에 저장하지 않고 세션 중 서버 요청에만 사용합니다.
- 타입 검사와 회귀 테스트를 우선합니다.

## 검증

```bash
npm test
node .\node_modules\typescript\bin\tsc --noEmit
npm run build
```
