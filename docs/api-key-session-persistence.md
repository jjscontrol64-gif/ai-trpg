# API Key Session Persistence

## 요약

API 키 재입력 불편을 줄이기 위해, 사용자가 `Remember this API key on this device for 30 days`를 선택하면 서버 측 암호화 저장소에 API 키 세션을 보관한다.

## 현재 구현

- 브라우저에는 API 키 원문을 저장하지 않는다.
- 브라우저 쿠키에는 `httpOnly` 세션 ID만 저장한다.
- 서버는 `private/api-key-sessions.json`에 API 키를 AES-256-GCM으로 암호화해 저장한다.
- 기본 세션은 30분, 기억하기 세션은 30일 TTL을 사용한다.
- `Forget Key` 버튼은 현재 세션을 저장소와 쿠키에서 삭제한다.

## 보안 메모

- 운영 환경에서는 `AI_TRPG_API_KEY_ENCRYPTION_SECRET`을 반드시 설정해야 한다.
- `private/`는 `.gitignore`에 포함되어 있어 저장된 세션 파일은 커밋되지 않는다.
- 로그, 세이브 파일, 브라우저 저장소에는 API 키 원문을 남기지 않는다.

## 확장 방향

현재 저장소는 파일 기반 어댑터다. 멀티 인스턴스나 서버리스 운영이 필요해지면 같은 인터페이스로 Redis, KV, DB 기반 저장소 어댑터를 추가한다.
