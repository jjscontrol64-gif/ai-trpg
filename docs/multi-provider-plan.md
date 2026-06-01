# 멀티 AI Provider 확장 플랜

> Gemini 단일 -> **Gemini / Claude / OpenAI(GPT)** 모델 프리셋 선택 지원

## 1. 목표

사용자가 시작 화면에서 AI 모델 프리셋을 선택하고, 선택한 모델의 provider에 맞는 API 키를 직접 입력해 게임을 진행한다.

### 결정 사항 (Director 확정)

- **"Codex" = OpenAI GPT API** (우선 Chat Completions 계열 모델 프리셋)
- **API 키 = 사용자 직접 입력** (현재 Gemini 방식과 동일, 서버 비용 부담 없음)
- **선택 단위 = 실제 모델 프리셋** (`Gemini 2.5 Flash`, `Claude Sonnet`, `GPT-4o` 등)
- **사용자 직접 model id 입력은 제공하지 않음**
- **저장된 게임 이어하기 시 새 provider/model 선택 허용**
- **키 세션은 로컬/단일 인스턴스 전제**로 유지
- **Claude/OpenAI JSON 안정화는 우선 프롬프트 지시 + 기존 fallback 파서 방식으로 통일**

### 비범위 (Non-Goals)

- 서버 환경변수 기반 키 관리
- 운영용 분산 세션 저장소(Redis 등) 도입
- 게임 엔진 / 프롬프트 / 상태창 로직 변경
- 모델별 파라미터 튜닝 UI (temperature 등)
- 사용자 직접 model id 입력 UI

---

## 2. 현재 구조 분석

| 요소 | 위치 | 비고 |
|---|---|---|
| `AIProvider` 인터페이스 | `src/lib/ai/types.ts` | `generateText(systemPrompt, messages, options)` |
| 팩토리 | `src/lib/ai/index.ts` | `createAIProvider()` - Gemini 고정 |
| Gemini 구현 | `src/lib/ai/gemini-provider.ts` | REST 직접 호출 |
| 서버 진입 | `src/app/api/game/route.ts:25` | 모듈 로드 시 싱글톤 1회 생성 |
| JSON 강제 | route.ts -> `responseMimeType: "application/json"` | Gemini 전용 개념 |
| 에러 판별 | route.ts:128, 135 | `"Gemini..."` 문자열 하드코딩 |
| 키 세션 | route.ts:27 `apiKeySessions` | provider/model 구분 없이 키만 저장 |
| 클라이언트 키 전송 | `src/app/page.tsx` (191, 226, 313, 358) | `apiKey` / `apiKeySessionId`만 전송 |

### 확장에 유리한 점

- 인터페이스가 이미 분리되어 코어 로직 변경을 최소화할 수 있다.
- `parseNarrationData`에 **JSON 실패 시 텍스트 fallback**이 있어 모델별 응답 편차를 완충한다.

### 현재 구조상 보완 필요점

- 전역 `const aiProvider = createAIProvider()`를 제거하고 요청마다 선택된 provider/model을 resolve해야 한다.
- `generateNarrationData`, `getEndingNarration` 등 하위 함수에도 provider/model 선택 결과를 전달해야 한다.
- 이어하기는 새 model preset을 선택할 수 있으므로 save snapshot에 provider를 강제 저장하지 않는다.

---

## 3. 설계

### 3.1 Provider / Model Preset 레이어

```
src/lib/ai/
├── types.ts            # 인터페이스 + Provider/Model preset 타입 + 공통 에러
├── model-presets.ts    # 선택 가능한 모델 프리셋 목록
├── index.ts            # createAIProvider(provider) 분기
├── gemini-provider.ts  # 기존 (옵션 시그니처 일반화)
├── claude-provider.ts  # 신규 - Anthropic Messages API
└── openai-provider.ts  # 신규 - OpenAI Chat Completions API
```

**Provider 식별자**

```ts
export type AIProviderId = "gemini" | "claude" | "openai";
```

**모델 프리셋**

```ts
export type AIModelPreset = {
  id: string;
  provider: AIProviderId;
  label: string;
  model: string;
};

export const AI_MODEL_PRESETS: AIModelPreset[] = [
  {
    id: "gemini-2.5-flash",
    provider: "gemini",
    label: "Gemini 2.5 Flash",
    model: "gemini-2.5-flash",
  },
  {
    id: "claude-sonnet",
    provider: "claude",
    label: "Claude Sonnet",
    model: "claude-sonnet-4-20250514",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    label: "GPT-4o",
    model: "gpt-4o",
  },
];
```

클라이언트는 `modelPresetId`만 서버로 전송한다. 서버는 프리셋 테이블에서 provider/model을 resolve한다. 이 방식은 클라이언트가 임의 provider/model 조합을 보내는 문제를 막는다.

### 3.2 Provider 인터페이스 변경

`responseMimeType`은 Gemini 전용이므로 공통 옵션으로 일반화한다. 실제 모델 id도 provider 옵션으로 전달한다.

```ts
options?: {
  apiKey?: string;
  model: string;
  json?: boolean;
}
```

`json: true`의 의미는 provider별로 다음과 같이 해석한다.

| Provider | JSON 응답 유도 방식 |
|---|---|
| Gemini | `generationConfig.responseMimeType: "application/json"` |
| OpenAI | 우선 시스템/유저 프롬프트에 JSON 반환 지시 + 기존 fallback 파서 |
| Claude | 시스템/유저 프롬프트에 JSON 반환 지시 + 기존 fallback 파서 |

OpenAI의 `response_format` 또는 Claude의 tool schema는 추후 안정화 옵션으로 남긴다. 현재 범위에서는 모델 간 동작을 단순하게 맞추기 위해 프롬프트 + fallback 방식을 우선한다.

### 3.3 모델/키 전달 경로

```
StartScreen(모델 프리셋 select + 키 입력)
  -> page.tsx 상태(modelPresetId, apiKey)
  -> POST /api/game body: { ..., modelPresetId, apiKey | apiKeySessionId }
  -> route.ts: modelPresetId를 서버 프리셋에서 resolve
  -> createAIProvider(resolved.provider)
  -> 하위 함수에 provider/model/apiKey 전달
  -> 키 세션에 provider/modelPresetId도 함께 저장
```

요청 body에서 `provider`와 `model`을 직접 신뢰하지 않는다. 서버가 `modelPresetId`만 받아 검증된 프리셋으로 변환한다.

### 3.4 키 세션 변경

`apiKeySessions` 값에 provider와 model preset을 함께 저장한다. `apiKeySessionId`만 온 재요청에서도 어떤 provider/model로 호출할지 식별한다.

```ts
type ApiKeySession = {
  apiKey: string;
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
  expiresAt: number;
};
```

단, 이 세션은 **로컬/단일 Node 인스턴스 전제**다. 서버 재시작, 서버리스 cold start, 멀티 인스턴스 배포에서는 세션이 사라질 수 있다. 현재 프로젝트 범위에서는 허용하되 운영 배포 전에는 Redis, 암호화 쿠키, 매 요청 키 전송 중 하나로 재검토한다.

### 3.5 이어하기 정책

저장된 게임 이어하기 시 기존 provider/model을 강제하지 않는다.

- Start와 Resume 모두 동일하게 `modelPresetId + apiKey`를 입력받는다.
- 이어하기에서 새 provider/model을 선택해도 기존 `messageHistory`는 그대로 전달한다.
- 모델 변경에 따른 문체 차이는 허용한다.
- save snapshot에 provider/model 저장은 필수 요구사항이 아니다.

### 3.6 에러 처리 일반화

provider별 에러 메시지에 의존하지 않도록 공통 에러 타입을 도입한다.

```ts
class MissingApiKeyError extends Error {}
class InvalidApiKeyError extends Error {}       // 401/403
class TemporaryAIProviderError extends Error {} // 429/503
class AIProviderRequestError extends Error {}   // 기타 provider 요청 실패
```

각 provider가 이 타입들을 throw하고, `route.ts`는 `instanceof`로 판별한다.

권장 응답:

| 상황 | HTTP | 메시지 |
|---|---:|---|
| 키 누락 | 400 | `AI provider API key is required.` |
| 잘못된 키/권한 없음 | 400 또는 401 | `AI provider API key is invalid or unauthorized.` |
| 429/503 | 503 | `AI provider is temporarily unavailable. Please try again shortly.` |
| 알 수 없는 modelPresetId | 400 | `Unknown AI model preset.` |

사용자 경험 관점에서는 잘못된 키를 provider-neutral 메시지로 반환한다.

### 3.7 서버 하위 함수 전달 방식

전역 provider 싱글톤을 제거한다.

```ts
type ResolvedAIModel = {
  modelPresetId: string;
  provider: AIProviderId;
  model: string;
  apiKey: string;
  apiKeySessionId: string;
};
```

`handleStartGame`, `handlePlayerAction`, `handleTalk`, `generateNarrationData`, `getEndingNarration`은 `ResolvedAIModel` 또는 그 중 필요한 provider/model/apiKey를 인자로 받는다.

---

## 4. 작업 분해 (WBS)

| # | 영역 | 파일 | 작업 |
|---|---|---|---|
| 1 | 타입 | `ai/types.ts` | `AIProviderId`, `AIModelPreset`, 옵션 `model/json`, 공통 에러 클래스 |
| 2 | 모델 프리셋 | `ai/model-presets.ts` | 허용 모델 목록과 resolver 추가 |
| 3 | Gemini | `ai/gemini-provider.ts` | `model/json` 옵션 수용, 공통 에러 throw로 변경 |
| 4 | Claude | `ai/claude-provider.ts` | Anthropic Messages API 구현 (role 매핑, system 분리, 프롬프트 JSON 지시) |
| 5 | OpenAI | `ai/openai-provider.ts` | Chat Completions 구현 (system 포함, 프롬프트 JSON 지시) |
| 6 | 팩토리 | `ai/index.ts` | `createAIProvider(provider)` 분기 |
| 7 | 서버 | `api/game/route.ts` | `modelPresetId` 수신/검증, 세션 저장, 요청별 provider 선택, 하위 함수 전달, 에러 일반화 |
| 8 | 클라 상태 | `app/page.tsx` | `modelPresetId` 상태 추가, start/resume/action/talk 요청 body 포함 |
| 9 | 클라 UI | `components/StartScreen.tsx` | 모델 프리셋 select + provider별 키 입력 라벨 |
| 10 | 테스트 | 관련 테스트 파일 | 프리셋 검증, provider-neutral 에러, Gemini 회귀 확인 |

---

## 5. 모델별 API 요약 (구현 참고)

### Claude (Anthropic Messages API)

- Endpoint: `POST https://api.anthropic.com/v1/messages`
- Header: `x-api-key`, `anthropic-version: 2023-06-01`
- Body: `model`, `system`(별도 필드), `messages`, `max_tokens`
- 응답: `content[0].text`
- JSON: 우선 프롬프트에 "JSON만 반환" 지시, 기존 fallback 파서가 보강

### OpenAI (Chat Completions)

- Endpoint: `POST https://api.openai.com/v1/chat/completions`
- Header: `Authorization: Bearer <key>`
- Body: `model`, `messages`(system 포함)
- 응답: `choices[0].message.content`
- JSON: 우선 프롬프트에 "JSON만 반환" 지시, 기존 fallback 파서가 보강

### Gemini

- Endpoint: `.../models/{model}:generateContent`
- Header: `x-goog-api-key`
- Body: `systemInstruction`, `contents`, `generationConfig`
- JSON: `generationConfig.responseMimeType: "application/json"`

---

## 6. 리스크 & 대응

| 리스크 | 수준 | 대응 |
|---|---|---|
| 메모리 기반 키 세션의 배포 환경 한계 | 中 | 로컬/단일 인스턴스 전제 명시, 운영 전 Redis/쿠키/매 요청 키 전송 재검토 |
| Claude/OpenAI JSON 포맷 불안정 | 中 | 프롬프트 JSON 지시 + 기존 텍스트 fallback 파서 유지 |
| 모델별 응답 role/구조 차이 | 低 | provider 내부에서 흡수, 인터페이스 동일 유지 |
| 키 세션 provider/model 불일치 | 低 | 세션에 provider/modelPresetId/model 저장으로 차단 |
| 메시지 history 포맷 호환 | 低 | `AIMessage`(user/assistant) 공통 포맷 유지 |
| 잘못된 API 키 UX | 中 | `InvalidApiKeyError`로 provider-neutral 메시지 반환 |
| 잘못된 model id 입력 | 低 | 직접 입력 미제공, 서버 프리셋 resolver로 검증 |

**총평: 리스크는 관리 가능하지만, 키 세션의 운영 환경 제약과 Claude/OpenAI JSON 포맷 안정성은 명시적으로 추적한다.** 코어 게임 로직은 건드리지 않고 provider 레이어와 요청 전달 경로를 확장하는 방식이 적절하다.

---

## 7. DoD (완료 기준)

- [ ] 3개 provider 모두 `AIProvider` 인터페이스 준수
- [ ] 서버가 `modelPresetId`를 검증된 프리셋으로 resolve
- [ ] StartScreen에서 모델 프리셋 선택 + 해당 provider 키 입력 가능
- [ ] 저장된 게임 이어하기에서 새 모델 프리셋 + 새 키 입력 가능
- [ ] 선택한 모델 프리셋으로 start/action/talk/ending 전 흐름 동작
- [ ] 하위 함수(`generateNarrationData`, `getEndingNarration`)가 전역 provider가 아닌 요청별 provider/model을 사용
- [ ] JSON 응답 유도가 provider별 정책대로 적용 (Gemini native, Claude/OpenAI 프롬프트 + fallback)
- [ ] 에러 처리(키 누락, 잘못된 키, 429/503)가 provider-neutral하게 동작
- [ ] `node .\node_modules\typescript\bin\tsc --noEmit` 통과
- [ ] `npm test` 통과
- [ ] `npm run build` 통과
- [ ] 기존 Gemini 동작 회귀 없음
