# 사내 테스트용 익명 문의 게시판 — 설계 (2026-11-18)

## 목적·범위

- 사내 내부 테스트 중 테스터가 로그인·가입 없이 문의 글과 답글을 남기는 게시판 1개 (사용자 지시 2026-11-18).
- 하는 것: 글 목록·상세·작성, 답글 작성.
- 안 하는 것: 수정·삭제(지울 땐 `/dev/tables`), 답글의 답글, 작성자 표시, 알림, 검색, 첨부.
- 전제: 사내망에서만 쓴다. 운영 공개 전에 닫는다(아래 "운영 전 제거").

## 결정 (사용자)

| 항목 | 결정 |
|---|---|
| 익명 범위 | 로그인 없이 누구나. 서버는 작성자를 저장하지 않는다 (uid·IP·UA 없음) |
| 기능 범위 | 목록 + 상세 + 글쓰기 + 답글 |
| 접근 제한 | 항상 켜기 + 길이 제한만. rate limit 없음 (2026-10-19 보류 방침 그대로) |
| 테이블 | 새 테이블 2개 `trd_inquiry`, `trd_inquiry_reply` (정의서 밖 — 이름·컬럼은 사용자 승인) |

## 데이터

정의서 밖 보조 테이블이라 `BaseEntity` 규칙(UUID `@Id`)을 따른다. 외래키 없음 (2026-10-27 방침). 시간은 `Instant`(UTC) 저장.

`trd_inquiry`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | PK |
| title | varchar(100) | not null |
| content | varchar(2000) | not null |
| created_at | timestamptz | not null |
| updated_at | timestamptz | not null |

`trd_inquiry_reply`

| 컬럼 | 타입 | 제약 |
|---|---|---|
| id | uuid | PK |
| inquiry_id | uuid | not null. 외래키 없음 — 서버가 글 존재를 확인 |
| content | varchar(1000) | not null |
| created_at | timestamptz | not null |
| updated_at | timestamptz | not null |

인덱스: `ix_trd_inquiry_created (created_at desc, id desc)` 목록 커서용, `ix_trd_inquiry_reply_inquiry (inquiry_id, created_at)`.

마이그레이션은 `db/inquiry-tables` 브랜치로 코드와 분리. 되돌리기(`drop table`)를 파일 상단 주석에 적고 `data-model.md`를 같은 커밋에서 갱신. 새 테이블 추가라 직전 배포와 호환.

## API (`com.company.market.inquiry` — controller·service·repository·domain·dto)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/v1/inquiries` | 최신순 커서 목록 `{ items, nextCursor }`. 항목: id, title, createdAt, replyCount. 내용은 안 내림 |
| GET | `/api/v1/inquiries/{id}` | 상세 + 답글 목록(오래된 순). 없으면 404 |
| POST | `/api/v1/inquiries` | `{ title, content }` → 만든 글. 201 |
| POST | `/api/v1/inquiries/{id}/replies` | `{ content }` → 만든 답글. 없는 글이면 404 |

- 목록 커서: `createdAt_id` 복합값 (같은 시각 글 소실 방지, 매물 목록 커서와 같은 이유). 목록은 `replyCount` 를 한 쿼리로 모아 N+1 을 피한다.
- 요청 DTO(record) Bean Validation, 검증 실패는 400 `VALIDATION` + `fields`:
  - `title` 1~100, `content` 1~2000, 답글 `content` 1~1000. 공백만은 불가. 앞뒤 공백은 잘라 저장. 줄바꿈은 허용.
- `SecurityConfig`: `GET`/`POST /api/v1/inquiries/**` `permitAll`. 인증 없는 쓰기 API 는 이 프로젝트에서 처음이다.
- 사용자 식별자를 받지도 저장하지도 않는다. 글 내용은 로그에 안 남긴다.
- `ErrorCode` 는 기존 `NOT_FOUND`·`VALIDATION` 재사용 — 새 코드 없음.

## 화면 (frontend)

- `/inquiries`: 목록(빈·로딩·오류 상태 + 재시도) + 글쓰기 폼. 글 등록 뒤 목록 맨 위에 보인다. 더 보기는 커서.
- `/inquiries/[id]`: 글 본문 + 답글 목록 + 답글 폼. 없는 글은 "찾을 수 없습니다" 안내.
- 헤더에 "문의" 링크 (포털 메뉴가 아니라 일반 링크 → 체크리스트 3번 해당 없음).
- 폼: react-hook-form + zod(`lib/validation/inquiry.ts`, 백엔드와 같은 수치), `mode: "onTouched"`, 필드 아래 오류 문구, 제출 버튼 비활성·스피너, 서버 `fields` 오류를 필드에 표시, 5xx 는 폼 위 안내(입력값 유지).
- 문구는 `messages/inquiry.ts`. API 는 `lib/api/inquiries.ts` 한 곳, 타입은 `types/inquiry.ts`(DTO 와 1:1).
- 본문·제목은 텍스트 노드로만 렌더링한다(`dangerouslySetInnerHTML` 없음). 줄바꿈은 `whitespace-pre-wrap`.
- 화면 표(`lib/tileScreens.ts`)에 `inquiries`·`inquiryDetail` 추가, 그룹 `common`. 상세로 가는 이동은 `useTileOpen()`.
- 새 화면 체크리스트(frontend.md) 6항목 확인 결과는 결과 보고에 적는다.

## 보안·정책 기록

- `docs/security.md`: "인증 없는 쓰기 API" 예외를 적는다 — 문의 게시판, 길이 제한만, rate limit 없음, 사내망 전제, 운영 전 제거.
- `docs/decisions.md`: 2026-11-18 항목 추가 (결정·이유·재검토 조건·감수).
- 감수: 스팸·도배를 막을 수단이 없다. 사내망 밖에 노출하면 DB 에 무한히 쌓인다. 개인정보를 글에 적는 것도 막지 않는다(저장·표시 그대로).
- 운영 전 제거: 컨트롤러·`SecurityConfig` 줄에 `// TODO(사내 테스트용 익명 쓰기): 운영 공개 전 제거` 를 단다. 제거 방법은 decisions.md 에 적는다(허용 줄 삭제 + 두 테이블 drop 마이그레이션 + 화면 삭제).

## 테스트

- 백엔드 (Testcontainers, `TestInfraConfiguration`): 글 작성·목록·상세 정상, 답글 정상, 빈 제목·너무 긴 내용 400 + `fields`, 없는 글 상세·답글 404, 로그인 없이 호출돼도 성공(401 아님), 목록 커서가 같은 시각 글을 빠뜨리지 않음.
- 프론트 Vitest: zod 스키마 경계값(100/101, 2000/2001, 1000/1001, 공백만), `tileScreens.test.ts` 의 화면 표.
- E2E 1개(`e2e/inquiry.spec.ts`): 글 작성 → 목록에 보임 → 상세에서 답글 작성 → 보임. PR 직전에 그 spec 만 1번.
- `bruno/inquiries/` 에 요청 4개.

## 작업 순서·브랜치

1. 이 문서: `docs/` 직접 커밋 예외.
2. `db/inquiry-tables`: 마이그레이션 + `data-model.md`. PR → `dev`.
3. `feat/inquiry-board`: 백엔드·프론트·bruno·E2E·security.md·decisions.md. 2번 머지 뒤 `dev` 에서 따서 PR.
4. PR 마다 `/code-review` 1회. `/security-review` 는 인증 변경 없음(허용 경로 추가만)이지만 인증 없는 쓰기 API 라 3번에서 1회 돌린다.

## 열린 질문

- 없음. 위 "기본값"(내용 그대로 저장, 답글 1단계, 커서 목록)은 사용자가 이의 없이 승인했다.
