# 🎲 AI TRPG 프로젝트 기획서

## 📌 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 프로젝트명 | AI TRPG (가제) |
| 장르 | 텍스트 기반 AI 롤플레잉 게임 |
| 플랫폼 | 웹 브라우저 (PC 우선) |
| 핵심 기술 | Claude API (Anthropic) |
| 개발 도구 | VS Code + Claude Code |
| 배포 목표 | Vercel |

---

## 🗂️ 기술 스택

```
Backend    : Node.js + Express 5 (server.js — Claude API 프록시)
Frontend   : HTML / CSS / Vanilla JavaScript (프레임워크 없이 시작)
AI         : Claude API (@anthropic-ai/sdk), 모델: claude-sonnet-4-5
저장       : localStorage (DB 없이 브라우저 저장, 초기 버전)
배포       : Vercel
버전 관리  : Git + GitHub
```

> **향후 고려**: 저장 기능이 복잡해지면 Supabase(무료) 도입 검토

---

## 🎮 게임 설계

### 세계관
- 클래식 왕도 JRPG 풍의 중세 판타지
- 어둠의 세력에 맞서는 영웅의 여정
- 한국어 서비스, 플레이어가 콘솔 RPG의 주인공이 된 듯한 몰입감을 주는 문체

### 핵심 게임플레이
1. 플레이어가 텍스트로 행동 입력 ("북쪽 문을 연다", "상인과 대화한다")
2. Claude가 게임 마스터(GM) 역할로 결과 내레이션 생성
3. 선택에 따라 스토리 분기 및 상태 변화 발생

### 게임 상태 (State) 구조

```javascript
const gameState = {
  player: {
    name: "",           // 플레이어 이름
    hp: 100,
    maxHp: 100,
    inventory: [],      // 아이템 목록
    gold: 0,
  },
  world: {
    location: "",       // 현재 위치
    chapter: 1,         // 챕터
    flags: {},          // 이벤트 플래그 (예: { "met_wizard": true })
  },
  turn: 0,
  history: []           // 대화 히스토리 (Claude API messages 배열)
};
```

---

## 🤖 Claude API 설계

### 시스템 프롬프트 구조

```
당신은 클래식 왕도 JRPG 풍 중세 판타지 세계의 게임 마스터입니다.
플레이어가 콘솔 RPG의 주인공이 된 듯한 몰입감을 주는 문체로 내레이션하세요.

[현재 게임 상태]
{gameState를 JSON으로 삽입}

[규칙]
- 플레이어의 모든 행동에 반드시 결과를 부여하세요.
- HP가 0이 되면 게임 오버 내레이션 후 게임을 종료하세요.
- 아이템 획득, 소비, HP 변화가 있을 경우 반드시 newState에 반영하세요.
- 응답은 반드시 아래 JSON 형식만 반환하세요. 다른 텍스트는 포함하지 마세요.

[응답 형식]
{
  "narration": "내레이션 텍스트 (플레이어에게 보여줄 내용)",
  "newState": { 변경된 gameState 전체 }
}
```

### API 호출 흐름

```
플레이어 입력 (브라우저)
    ↓
POST /api/game  →  server.js (Express)
    ↓
gameState + history를 시스템 프롬프트에 포함
    ↓
Claude API 호출 (@anthropic-ai/sdk)
    ↓
JSON 파싱 → narration + newState 반환
    ↓
브라우저: 화면 출력 + gameState 업데이트 + history 추가
    ↓
반복
```

> API 키는 server.js에서만 사용. 프론트엔드에 노출되지 않음.

---

## 📁 폴더 구조

> **현재 구조** (Node.js + Express 백엔드, cha_chat 코드베이스 기반)

```
ai-trpg/
├── .claude/
│   └── CLAUDE.md          ← 이 파일 (Claude Code 컨텍스트)
├── public/                ← Express가 정적 파일로 서빙
│   ├── index.html         ← 게임 메인 화면
│   ├── style.css          ← 스타일
│   └── script.js          ← 프론트엔드 전체 로직 (현재 단일 파일)
├── server.js              ← Express 서버 + Claude API 프록시
├── package.json
├── .env                   ← API 키 (Git에 올리지 말 것)
└── .gitignore
```

> **목표 구조** (Phase 2 이후, script.js 모듈 분리 시)

```
public/
├── index.html
├── style.css
└── js/
    ├── main.js            ← 진입점, 게임 초기화
    ├── api.js             ← 서버 API 호출 모듈
    ├── state.js           ← gameState 관리
    ├── ui.js              ← 화면 렌더링 함수
    └── prompts.js         ← 시스템 프롬프트 템플릿
```

---

## 🖥️ 화면 구성

```
┌─────────────────────────────────────────┐
│  [타이틀 / 게임 제목]                    │
├──────────────────────┬──────────────────┤
│                      │  [ 플레이어 정보 ]│
│   내레이션 출력 영역  │  이름 :          │
│   (스크롤 가능)       │  HP   : ■■■□□   │
│                      │  위치 :          │
│                      │  [ 인벤토리 ]    │
│                      │  - 단검          │
│                      │  - 치료 물약 x1  │
├──────────────────────┴──────────────────┤
│  > 플레이어 입력창          [전송 버튼]  │
└─────────────────────────────────────────┘
```

---

## ✅ 개발 단계 (마일스톤)

### Phase 1 — 뼈대 구현
- [x] 프로젝트 폴더 초기화 (server.js, public/, package.json)
- [x] Express 서버 + Claude API 연결 구조 완성
- [x] cha_chat UI/로직 → TRPG용으로 교체
- [x] gameState 초기 구조 정의
- [x] GM 역할 시스템 프롬프트 작성 및 테스트

### Phase 2 — 게임 상태 연동
- [ ] JSON 응답 파싱 및 newState 적용 로직
- [ ] HP 바 UI 컴포넌트
- [ ] 인벤토리 패널 UI
- [ ] 현재 위치 표시
- [ ] 대화 히스토리 관리 (맥락 유지)

### Phase 3 — 완성도 향상
- [ ] 게임 시작 화면 (캐릭터 이름 입력)
- [ ] 게임 오버 / 클리어 화면
- [ ] localStorage 저장/불러오기
- [ ] 내레이션 타이핑 애니메이션 효과

### Phase 4 — 배포
- [ ] .env API 키 Vercel 환경변수로 이전
- [ ] Vercel 배포 (Node.js 서버리스 함수로 server.js 변환 필요)
- [ ] 도메인 설정 (선택)

---

## ⚠️ 주의사항

- **API 키는 server.js에서만 사용.** 프론트(script.js)에 절대 노출 금지
- **프레임워크 없이 Vanilla JS로 시작.** React 도입은 추후 논의 후 결정
- **복잡한 추상화 지양.** 클래스보다 함수, 패턴보다 단순한 구조 우선
- **주석은 한국어로** 작성할 것
- JSON 파싱 실패 대비 **try/catch 필수** 적용
- Claude API 응답이 JSON이 아닐 경우 재시도 또는 오류 안내 처리 필요
- **Vercel 배포 시** Express 서버를 서버리스 함수(api/ 디렉토리)로 변환해야 함
