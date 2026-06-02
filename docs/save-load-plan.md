# Save/Load 2, 3 단계 기획

## 목적

현재 1단계는 브라우저 localStorage 기반 단일 저장 슬롯이다. 2단계와 3단계의 목표는 저장 모델을 확장 가능한 형태로 발전시키는 것이다.

- 2단계: 사용자별/캐릭터별 다중 저장 슬롯
- 3단계: 멀티플레이를 전제로 한 서버 저장

핵심 원칙은 UI가 저장 구현체에 직접 묶이지 않도록 `StorageProvider` 인터페이스를 유지하고, 저장 대상은 UI 상태가 아니라 게임 진행 상태로 제한하는 것이다.

## 현재 1단계 기준

현재 저장 단위는 다음 상태를 포함한다.

- `schemaVersion`
- `saveId`
- `playerName`
- `gameState`
- `beats`
- `currentChoices`
- `savedAt`

API key는 저장하지 않는다. 이어하기 시 사용자가 다시 입력하고, 세션 메모리 상태에만 보관한다.

## 2단계: 사용자별/다중 저장 슬롯

### 목표

단일 `default` 슬롯에서 벗어나 사용자가 여러 저장 데이터를 관리할 수 있게 한다.

지원 범위:

- 저장 슬롯 목록 조회
- 슬롯별 이어하기
- 슬롯 삭제
- 슬롯 덮어쓰기
- 사용자 또는 브라우저 클라이언트별 저장 분리

### 사용자 식별 방식

로그인 기능이 없는 현재 구조에서는 실제 사용자 인증이 없다. 따라서 2단계에서는 브라우저 단위 익명 식별자를 사용한다.

```ts
type AnonymousClient = {
  ownerId: string;
  createdAt: string;
};
```

`ownerId`는 localStorage에 별도 저장한다.

예시 key:

```txt
ai-trpg:client-id
ai-trpg:user:{ownerId}:save:{saveId}
ai-trpg:user:{ownerId}:save-index
```

주의:

- 이 방식은 보안 경계가 아니다.
- 같은 브라우저 안에서만 사용자 구분이 가능하다.
- 브라우저 데이터 삭제, 다른 기기, 다른 브라우저에서는 이어지지 않는다.

### 타입 확장

```ts
interface SaveSnapshot {
  schemaVersion: 1;
  saveId: string;
  ownerId?: string;
  title: string;
  playerName: string;
  gameState: GameState;
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
  savedAt: string;
}

interface SaveSummary {
  saveId: string;
  ownerId?: string;
  title: string;
  playerName: string;
  floor: string;
  phase: GameState["phase"];
  savedAt: string;
}
```

`SaveSummary`는 시작 화면에서 목록을 빠르게 보여주기 위한 경량 데이터다. 전체 `GameState`를 목록 렌더링마다 파싱하지 않도록 분리한다.

### StorageProvider 확장

```ts
interface StorageProvider {
  load(saveId?: string): Promise<SaveSnapshot | null>;
  save(snapshot: SaveSnapshot): Promise<void>;
  list(ownerId?: string): Promise<SaveSummary[]>;
  remove(saveId: string): Promise<void>;
}
```

### UI 변경

StartScreen:

- 저장 슬롯 목록 표시
- 각 슬롯에 `이어하기`, `삭제`
- 새 게임 시작 영역은 유지
- API key 입력은 공통으로 사용

인게임:

- `저장하기`
- `다른 이름으로 저장`
- 마지막 저장 시간 표시

### 우선순위

1. `SaveSummary`와 `list/remove` 추가
2. localStorage index 관리
3. StartScreen 슬롯 목록 UI
4. 저장 슬롯 제목 자동 생성
5. 수동 이름 변경은 후순위

### 리스크

- localStorage 용량 제한이 있다.
- `beats`와 `messageHistory`가 커지면 저장 실패 가능성이 있다.
- 저장 데이터가 깨졌을 때 복구 UX가 필요하다.

대응:

- `beats`는 최근 50개 유지
- `gameState.messageHistory`도 엔진 정책상 최근 N개 유지
- `load()`에서 schema/version 검증 실패 시 해당 슬롯을 무시하거나 삭제 안내

## 3단계: 멀티플레이 서버 저장

### 목표

멀티플레이에서는 저장 소유권이 개인이 아니라 방 또는 세션에 있다. 서버 저장은 `user -> save`가 아니라 `room/session -> shared game state` 모델로 설계해야 한다.

### 핵심 저장 단위

```ts
interface ServerSaveSnapshot {
  schemaVersion: 1;
  saveId: string;
  roomId: string;
  campaignId?: string;
  gameState: GameState;
  players: PlayerState[];
  beats: StoryBeat[];
  currentChoices: ChoiceOption[];
  savedAt: string;
  savedByUserId: string;
  revision: number;
}

interface PlayerState {
  userId: string;
  displayName: string;
  role: "host" | "player" | "observer";
  characterId?: string;
  connected: boolean;
}
```

### 서버 API 초안

```txt
GET    /api/saves
GET    /api/saves/:saveId
POST   /api/saves
PUT    /api/saves/:saveId
DELETE /api/saves/:saveId
```

멀티플레이 room 기준 API:

```txt
GET  /api/rooms/:roomId/save
PUT  /api/rooms/:roomId/save
POST /api/rooms/:roomId/load
```

`load`는 단순히 개인 화면만 바꾸는 동작이 아니라 room의 현재 상태를 교체하는 명령이므로 별도 endpoint로 분리하는 편이 명확하다.

### DB 모델 초안

```txt
users
- id
- email
- display_name
- created_at

rooms
- id
- campaign_id
- host_user_id
- status
- created_at
- updated_at

room_members
- room_id
- user_id
- role
- character_id
- joined_at

saves
- id
- room_id
- owner_user_id
- title
- snapshot_json
- schema_version
- revision
- created_at
- updated_at
```

초기에는 `snapshot_json`으로 시작해도 된다. 다만 검색/통계/운영 분석이 필요해지면 일부 필드는 정규화한다.

정규화 후보:

- `roomId`
- `ownerUserId`
- `playerName`
- `floor`
- `phase`
- `savedAt`
- `revision`

### 동시성 제어

멀티플레이 저장에는 충돌 제어가 필요하다.

```ts
save(snapshot, expectedRevision)
```

서버는 현재 `revision`과 `expectedRevision`이 같을 때만 저장한다. 다르면 `409 Conflict`를 반환한다.

이유:

- 두 사용자가 동시에 저장할 수 있다.
- AI 응답 생성 중 저장하면 오래된 상태가 나중에 덮어쓸 수 있다.
- 방장이 불러오기 중일 때 다른 플레이어 액션이 들어올 수 있다.

### 권한 모델

권장 기본값:

- host: 저장, 불러오기, 삭제 가능
- player: 저장 가능 여부는 방 설정으로 결정
- observer: 읽기만 가능

서버는 모든 save/load/delete에서 다음을 검증한다.

- 사용자가 room member인지
- 역할이 명령 권한을 갖는지
- 요청 snapshot의 `roomId`가 URL의 `roomId`와 일치하는지
- `revision`이 유효한지

### 실시간 동기화

3단계 서버 저장은 실시간 플레이와 맞물린다.

불러오기 동작:

1. host가 save 선택
2. 서버가 권한과 revision 확인
3. room의 active state 교체
4. 모든 참가자에게 `room_state_replaced` 이벤트 전송
5. 각 클라이언트가 같은 snapshot으로 화면 갱신

전송 방식 후보:

- 초기: polling 또는 manual refresh
- 중기: Server-Sent Events
- 장기: WebSocket

실시간 액션과 AI 응답 생성까지 포함하면 WebSocket 또는 durable room process가 유리하다. 단, 현재 단계에서 바로 도입할 필요는 없다.

### ServerStorageProvider

클라이언트는 기존 `StorageProvider` 인터페이스를 유지하고 구현체만 교체한다.

```ts
class ServerStorageProvider implements StorageProvider {
  async load(saveId?: string): Promise<SaveSnapshot | null> {
    // fetch /api/saves/:saveId
  }

  async save(snapshot: SaveSnapshot): Promise<void> {
    // PUT /api/saves/:saveId
  }

  async list(): Promise<SaveSummary[]> {
    // GET /api/saves
  }

  async remove(saveId: string): Promise<void> {
    // DELETE /api/saves/:saveId
  }
}
```

factory는 환경 또는 설정에 따라 구현체를 선택한다.

```ts
function createStorageProvider(): StorageProvider {
  if (process.env.NEXT_PUBLIC_SAVE_BACKEND === "server") {
    return new ServerStorageProvider();
  }

  return new LocalStorageProvider();
}
```

### 보안 주의사항

- API key는 서버 저장 snapshot에 넣지 않는다.
- snapshot은 사용자 입력과 AI 출력이 포함되므로 신뢰하지 않는다.
- 서버 저장 시 JSON schema 또는 런타임 validator가 필요하다.
- room 권한 검증은 클라이언트가 아니라 서버에서 한다.
- 저장 데이터는 크기 제한을 둔다.

### 운영 리스크

- snapshot JSON이 커지면 DB row와 네트워크 비용이 증가한다.
- 멀티플레이에서 load는 모든 참가자의 진행 상태를 바꾸는 파괴적 동작이다.
- 저장/불러오기 중 AI 응답이 늦게 도착하면 상태 역전이 생길 수 있다.

대응:

- `revision` 기반 충돌 방지
- AI 요청에도 `requestRevision` 포함
- 응답 적용 시 현재 revision과 다르면 폐기
- load 명령은 host 권한으로 제한
- 저장 크기 제한과 오래된 beat trimming 유지

## 단계별 실행 계획

### 2단계 구현 순서

1. `SaveSummary` 타입 추가
2. `StorageProvider`에 `list/remove` 추가
3. `LocalStorageProvider`에 save index 구현
4. anonymous `ownerId` 생성/저장
5. StartScreen에서 슬롯 목록 표시
6. 슬롯별 continue/delete 구현
7. 저장 실패/깨진 데이터 UX 처리

### 3단계 구현 순서

1. 인증 방식 결정
2. room/session 도메인 모델 정의
3. DB schema 설계
4. `/api/saves` 또는 `/api/rooms/:roomId/save` 구현
5. `ServerStorageProvider` 추가
6. revision 기반 optimistic concurrency 적용
7. room load 시 참가자 동기화 방식 결정
8. 실시간 전송 계층 도입

## 최종 판단

2단계는 현재 구조에서 자연스럽게 확장 가능하다. 먼저 localStorage index와 `SaveSummary`를 추가하면 된다.

3단계는 단순 저장 기능이 아니라 멀티플레이 room state 관리 문제다. 따라서 저장소 구현만 바꾸면 끝나는 문제가 아니며, 인증, 권한, revision, 동기화 이벤트까지 함께 설계해야 한다.

현재 가장 현실적인 방향은 2단계까지 localStorage 기반으로 완성하고, 3단계 진입 전에 room/session 도메인 모델을 먼저 확정하는 것이다.
