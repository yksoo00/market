# 익명 문의 게시판 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사내 테스트 중 로그인 없이 문의 글과 답글을 남기고 보는 게시판 1개.

**Architecture:** 새 도메인 패키지 `inquiry`(controller → service → repository)와 새 테이블 2개(`trd_inquiry`, `trd_inquiry_reply`). 쓰기·읽기 API 전부 `permitAll`. 프론트는 `/inquiries`(목록+글쓰기), `/inquiries/[id]`(상세+답글) 두 화면.

**Tech Stack:** Spring Boot 4.1(JPA, Bean Validation, Flyway), Next.js 16(react-hook-form + zod), Vitest, Playwright, Testcontainers. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-11-18-inquiry-board-design.md`

## Global Constraints

- 길이: 제목 1~100, 글 내용 1~2000, 답글 1~1000. 공백만 불가. 앞뒤 공백은 잘라 저장. 줄바꿈 허용. 길이는 UTF-16 글자 수(`String.length()` = JS `.length`)로 프론트·백엔드가 같다.
- 작성자 정보(uid·IP·UA)를 받지도 저장하지도 않는다. 글 내용은 로그에 남기지 않는다.
- 테이블: `trd_inquiry(id uuid pk, title varchar(100), content varchar(2000), created_at, updated_at)`, `trd_inquiry_reply(id uuid pk, inquiry_id uuid, content varchar(1000), created_at, updated_at)`. 시각은 `timestamptz`. 외래키 없음. 인덱스 `ix_trd_inquiry_created (created_at desc, id desc)`, `ix_trd_inquiry_reply_inquiry (inquiry_id, created_at)`.
- API 응답 `{ ok, data }`, 검증 실패 400 `VALIDATION` + `fields`(키 = 요청 DTO 필드명). 새 `ErrorCode` 없음(`NOT_FOUND`·`VALIDATION`·`BAD_REQUEST` 재사용).
- 목록은 커서(`createdAt_id`) 방식, 페이지 번호 없음. 한 페이지 20개.
- 사용자에게 보이는 문구는 `frontend/src/messages/inquiry.ts` 에만. 본문은 텍스트 노드로만 렌더링(`dangerouslySetInnerHTML` 금지).
- 주석·커밋 메시지·문서는 한국어, 식별자는 영어. 한글 파일은 필요한 줄만 국소 수정.
- 브랜치: Task 1 은 `db/inquiry-tables`(dev 에서), Task 2~6 은 `feat/inquiry-board`(Task 1 머지 뒤 dev 에서). PR 대상은 항상 `dev`, 머지는 사용자가 한다. 커밋 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 제목·내용이 공백(전각 공백 포함)만이면 400 `VALIDATION` + 그 필드 문구 — Task 2.
2. 본문에 `<script>`·HTML 이 들어 있어도 그대로 저장·응답되고 화면은 글자로 보여 준다 — Task 2(API 값 그대로), Task 5(E2E).
3. 같은 `created_at` 글이 20개를 넘어도 커서 목록이 하나도 빠지거나 겹치지 않는다 — Task 2.
4. 본문이 깨진 JSON·필드 누락이면 500 이 아니라 400 — Task 2.
5. 없는 글(랜덤 UUID)의 상세·답글은 404, 잘못된 커서 문자열은 400 — Task 2.

---

## Task 1: 테이블 마이그레이션 (`db/inquiry-tables`)

**Files:**
- Create: `backend/src/main/resources/db/migration/V202611181000__create_inquiry_tables.sql`
- Create: `backend/src/test/java/com/company/market/InquiryMigrationTest.java`
- Modify: `docs/data-model.md`

**Interfaces:**
- Produces: 테이블 `trd_inquiry`, `trd_inquiry_reply` (Global Constraints 의 컬럼·인덱스 그대로).

- [ ] **Step 1: `git checkout dev && git pull && git checkout -b db/inquiry-tables`**
- [ ] **Step 2: Write the failing test** — `InquiryMigrationTest`(`SchemaConstraintsTest` 와 같은 `@SpringBootTest` + `TestInfraConfiguration` 방식). 테스트 이름과 단언:
  - `문의 테이블 두 개가 있고 컬럼 길이가 정해진 값이다`: `information_schema.columns` 에서 `trd_inquiry.title` 의 `character_maximum_length = 100`, `content = 2000`, `trd_inquiry_reply.content = 1000`, 두 테이블의 `created_at` 데이터 타입이 `timestamp with time zone`.
  - `목록·답글 인덱스가 있다`: `pg_indexes` 에 `ix_trd_inquiry_created`, `ix_trd_inquiry_reply_inquiry`.
- [ ] **Step 3: Run** `./gradlew test --tests "*InquiryMigrationTest"` → FAIL (테이블 없음).
- [ ] **Step 4: 마이그레이션 작성.** 파일 상단 주석에 목적 + 되돌리기(`drop table trd_inquiry_reply; drop table trd_inquiry;`) + "정의서 밖 보조 테이블, 외래키 없음(2026-10-27 방침), 사용자 승인 2026-11-18" 적는다. 일반 `create table`/`create index`(새 테이블이라 `concurrently` 불필요). 컬럼 코멘트는 정의서 논리명이 없으므로 달지 않는다.
- [ ] **Step 5: Run** 같은 명령 → PASS. 이어서 `DevTableAliasTest` 가 영향받지 않는지 `./gradlew test --tests "*DevTableAliasTest"` 도 확인(두 테이블은 `TABLES` 화이트리스트 밖이라 통과해야 함).
- [ ] **Step 6: `docs/data-model.md`** 끝(거래 절 뒤)에 `## 문의 게시판: trd_inquiry, trd_inquiry_reply` 절 추가 — 컬럼 표, 익명(작성자 없음), 외래키 없음, 운영 전 제거 대상(spec 링크).
- [ ] **Step 7: Commit** `db: 문의 게시판 테이블 추가` → push → PR(`dev` 대상). 본문에 무엇을·왜·확인 방법.

---

## Task 2: 백엔드 API (`feat/inquiry-board`)

**Files:**
- Create: `backend/src/main/java/com/company/market/inquiry/domain/{Inquiry,InquiryReply}.java`
- Create: `backend/src/main/java/com/company/market/inquiry/repository/{InquiryRepository,InquiryReplyRepository}.java`
- Create: `backend/src/main/java/com/company/market/inquiry/dto/{InquiryCreateRequest,InquiryReplyRequest,InquiryListItem,InquiryPageResponse,InquiryDetailResponse,InquiryReplyResponse}.java`
- Create: `backend/src/main/java/com/company/market/inquiry/service/InquiryService.java`
- Create: `backend/src/main/java/com/company/market/inquiry/controller/InquiryController.java`
- Modify: `backend/src/main/java/com/company/market/common/auth/SecurityConfig.java` (`/api/v1/dev/**` 줄 아래)
- Test: `backend/src/test/java/com/company/market/inquiry/controller/InquiryApiTest.java`

**Interfaces:**
- Produces (프론트 Task 4 가 의존):
  - `GET /api/v1/inquiries?cursor=` → `data: { items: [{ id, title, createdAt, replyCount }], nextCursor: string|null }`
  - `GET /api/v1/inquiries/{id}` → `data: { id, title, content, createdAt, replies: [{ id, content, createdAt }] }` (답글 오래된 순)
  - `POST /api/v1/inquiries` body `{ title, content }` → 201, `data` = 위 상세(빈 `replies`)
  - `POST /api/v1/inquiries/{id}/replies` body `{ content }` → 201, `data` = `{ id, content, createdAt }`
  - 시각은 ISO-8601 UTC 문자열(`Instant`).
- 엔티티: `Inquiry extends BaseEntity` (`@Table(name = "trd_inquiry")`, 필드 `title`, `content`, `static Inquiry create(String title, String content)`), `InquiryReply extends BaseEntity` (`inquiryId`, `content`, `static InquiryReply create(UUID inquiryId, String content)`). `@Getter` 만, `@Setter`·`@Data` 금지, 기본 생성자 `protected`.
- `InquiryService`: `InquiryPageResponse list(String cursor)`, `InquiryDetailResponse get(UUID id)`, `InquiryDetailResponse create(InquiryCreateRequest req)`, `InquiryReplyResponse reply(UUID inquiryId, InquiryReplyRequest req)`. `static final int PAGE_SIZE = 20`. 조회는 `@Transactional(readOnly = true)`.

- [ ] **Step 1: `git checkout dev && git pull && git checkout -b feat/inquiry-board`** (Task 1 PR 이 머지된 뒤. 안 됐으면 머지를 기다린다.)
- [ ] **Step 2: Write the failing tests** — `InquiryApiTest`(`CartApiTest` 와 같은 `@Import(TestInfraConfiguration.class) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`, 쿠키·토큰은 **쓰지 않는다**). `@BeforeEach` 에서 `jdbc.update("delete from trd_inquiry_reply")`, `delete from trd_inquiry`. 테스트(`@DisplayName` 한국어):
  - `로그인 없이 글을 쓰면 201 이고 상세로 읽힌다`: POST `{title:"제목", content:"내용"}` → 201, `$.data.title`, `$.data.replies` 길이 0; 그 id 로 GET → 200.
  - `앞뒤 공백은 잘려 저장된다`: `"  제목  "` → `$.data.title == "제목"`.
  - `제목이 공백만이면 400 이고 title 필드 문구가 온다`: `"  　"`(전각 공백 포함) → 400, `$.code == "VALIDATION"`, `$.fields.title` 존재. 내용 공백만도 같게 `$.fields.content`.
  - `길이 경계`: 제목 100자 201 / 101자 400, 내용 2000자 201 / 2001자 400, 답글 1000자 201 / 1001자 400.
  - `깨진 JSON 이나 필드 누락은 400`: 본문 `{`(깨진 JSON) → 400, `{}` → 400 + `fields.title`·`fields.content`.
  - `HTML 이 그대로 저장되고 그대로 나온다`: content `<script>alert(1)</script>` → 응답·재조회 값이 같다.
  - `답글을 쓰면 상세 답글 목록에 오래된 순으로 보이고 목록 replyCount 가 오른다`: 답글 2개 → 상세 `replies[0].content` = 먼저 쓴 것; 목록 해당 항목 `replyCount == 2`.
  - `없는 글은 404`: 랜덤 UUID 로 GET 상세, POST 답글 → 404, `$.code == "NOT_FOUND"`.
  - `목록은 최신순이고 같은 시각 글도 빠지지 않는다`: `jdbc` 로 같은 `created_at` 의 글 25개를 직접 insert → 첫 페이지 20개 + `nextCursor` 존재, 그 커서로 두 번째 페이지 5개 + `nextCursor == null`, 두 페이지 id 합집합 25개(겹침 0).
  - `잘못된 커서는 400`: `?cursor=abc` → 400 `BAD_REQUEST`.
- [ ] **Step 3: Run** `./gradlew test --tests "*InquiryApiTest"` → 컴파일 실패/FAIL.
- [ ] **Step 4: DTO·엔티티·리포지토리.** 요청 DTO 는 record, 제약: `title` `@NotBlank @Size(max = 100)`, `content` `@NotBlank @Size(max = 2000)`, 답글 `content` `@NotBlank @Size(max = 1000)`(`@NotBlank` 가 전각 공백도 공백으로 본다. 메시지는 spec 길이 문구 한국어로). 리포지토리: `InquiryRepository.findFirstPage(Pageable)` / `findPageAfter(Instant at, UUID id, Pageable)`(`where i.createdAt < :at or (i.createdAt = :at and i.id < :id) order by i.createdAt desc, i.id desc` JPQL), `InquiryReplyRepository.findByInquiryIdOrderByCreatedAtAscIdAsc(UUID)` 와 `List<Object[]> countByInquiryIds(Collection<UUID>)`(`group by inquiryId`, 목록 N+1 방지).
- [ ] **Step 5: `InquiryService` 구현.** 한 줄 접근 방식만 정한다 — 커서 = `createdAt.toString() + "_" + id`(DB 에서 읽은 행 기준이라 마이크로초 일치), `PAGE_SIZE + 1` 개를 읽어 초과분으로 `nextCursor` 결정, 커서 파싱 실패는 `ApiException(ErrorCode.BAD_REQUEST)`, 없는 글은 `ApiException(ErrorCode.NOT_FOUND, "문의를 찾을 수 없습니다.")`, 저장 전 `strip()`. 로그에 제목·내용을 남기지 않는다.
- [ ] **Step 6: `InquiryController`**(`@RequestMapping("/api/v1/inquiries")`) 4개 엔드포인트, `@Valid @RequestBody`, 생성은 `ResponseEntity.status(201).body(ApiResponse.of(...))`. 클래스 주석에 `// TODO(사내 테스트용 익명 쓰기): 인증·rate limit 없음 — 운영 공개 전 제거 (spec 2026-11-18-inquiry-board-design.md)`.
- [ ] **Step 7: `SecurityConfig`** 에 `.requestMatchers("/api/v1/inquiries/**").permitAll()` 한 줄 + 같은 TODO 주석(이유: 사내 테스트용 익명 게시판).
- [ ] **Step 8: Run** `./gradlew test --tests "*InquiryApiTest"` → 전부 PASS.
- [ ] **Step 9: Commit** `feat(backend): 익명 문의 게시판 API`.

---

## Task 3: bruno 요청·보안·결정 문서

**Files:**
- Create: `bruno/inquiries/{list,get,create,reply}.bru` (`bruno/listings/create.bru` 형식, 인증 없음, 환경 변수 `{{baseUrl}}` 등은 `bruno/environments/local.bru` 기준)
- Modify: `docs/security.md`, `docs/decisions.md`

- [ ] **Step 1: bruno 4개 작성.** 응답이 `ApiResponse` 형식인지 `list`·`create` 에 `assert`(`res.body.ok eq true`) 하나씩.
- [ ] **Step 2: `docs/security.md`** — 입력 검증 절에 문의 게시판 수치(제목 100, 내용 2000, 답글 1000)를 추가하고, "인증 없는 쓰기 API" 예외 항목을 만든다: 대상(`/api/v1/inquiries/**`), 길이 제한만·rate limit 없음, 사내망 전제, 작성자 미저장, 운영 전 제거 절차.
- [ ] **Step 3: `docs/decisions.md`** 맨 아래에 `## 2026-11-18 사내 테스트용 익명 문의 게시판` 덧붙임 — 결정(로그인 없이 누구나·목록+상세+글쓰기+답글·길이 제한만), 이유(사내 테스트 중 피드백 수집), 감수(스팸 방어 없음·글에 개인정보를 적어도 못 막음), 재검토 조건(사내망 밖 노출 또는 운영 공개), 제거 방법(허용 줄 삭제 + 두 테이블 drop 마이그레이션 + 화면 삭제). 맨 위 색인에도 한 줄.
- [ ] **Step 4: Commit** `docs: 익명 문의 게시판 보안·결정 기록` + `chore: 문의 게시판 bruno 요청`(커밋 둘로 나눠도 된다).

---

## Task 4: 프론트 기반 — 타입·API·검증·문구

**Files:**
- Create: `frontend/src/types/inquiry.ts`, `frontend/src/lib/api/inquiries.ts`, `frontend/src/lib/validation/inquiry.ts`, `frontend/src/messages/inquiry.ts`
- Test: `frontend/src/lib/validation/inquiry.test.ts`

**Interfaces:**
- Consumes: Task 2 의 API 응답 모양.
- Produces:
  - `types/inquiry.ts`: `InquiryListItem { id; title; createdAt; replyCount }`, `InquiryPage { items: InquiryListItem[]; nextCursor: string | null }`, `InquiryReply { id; content; createdAt }`, `InquiryDetail { id; title; content; createdAt; replies: InquiryReply[] }`.
  - `lib/api/inquiries.ts`: `fetchInquiries(cursor?: string): Promise<ApiResult<InquiryPage>>`, `fetchInquiry(id: string): Promise<ApiResult<InquiryDetail>>`, `createInquiry(body: { title: string; content: string }): Promise<ApiResult<InquiryDetail>>`, `createInquiryReply(id: string, body: { content: string }): Promise<ApiResult<InquiryReply>>` — 전부 `lib/api/client` 의 `api`/`post` 경유(`lib/api/dev.ts` 형식).
  - `lib/validation/inquiry.ts`: 상수 `INQUIRY_TITLE_MAX = 100`, `INQUIRY_CONTENT_MAX = 2000`, `INQUIRY_REPLY_MAX = 1000`, zod 스키마 `inquirySchema`(`title`, `content`), `inquiryReplySchema`(`content`) — 길이는 **자르지 않은 원문 `.length`** 로 검사(백엔드 `@Size` 와 같게), 비었는지는 `trim()` 후 검사. 파일 맨 위 주석에 `docs/security.md "입력 검증"` 과 같은 값이라고 적는다.
  - `messages/inquiry.ts`: 화면 제목·빈 상태·로딩·오류·재시도·폼 라벨·플레이스홀더·검증 오류 문구("제목은 1자 이상 100자 이하로 입력하세요" 형식 — 무엇이 왜 틀렸고 어떻게 고치나)·헤더 링크 라벨 "문의".

- [ ] **Step 1: Write the failing test** `inquiry.test.ts`: 제목 100자 통과·101자 실패, 내용 2000/2001, 답글 1000/1001, 공백만(`"   "`, `"　"`)은 실패, 앞뒤 공백 포함 `"a" + " ".repeat(100)`(원문 101자)은 실패(백엔드와 같은 결과), 이모지 50개(`"😀".repeat(50)` = 길이 100)는 통과·51개 실패.
- [ ] **Step 2: Run** `pnpm exec vitest run src/lib/validation/inquiry.test.ts` → FAIL.
- [ ] **Step 3: 구현** (위 Interfaces 의 파일 4개). `pnpm typecheck && pnpm lint`.
- [ ] **Step 4: Run** vitest → PASS.
- [ ] **Step 5: Commit** `feat(frontend): 문의 게시판 타입·API·검증·문구`.

---

## Task 5: 프론트 화면·화면 표·헤더·E2E

**Files:**
- Create: `frontend/src/app/inquiries/page.tsx`, `frontend/src/app/inquiries/[id]/page.tsx`
- Create: `frontend/src/components/inquiry/{InquiryBoard,InquiryDetailView,InquiryForm,InquiryReplyForm}.tsx`
- Modify: `frontend/src/lib/tileScreens.ts`, `frontend/src/lib/tileScreens.test.ts`, `frontend/src/components/common/Header.tsx`(+ 헤더 `nav` 문구·`navHrefs`)
- Test: `frontend/e2e/inquiry.spec.ts`

**Interfaces:**
- Consumes: Task 4 의 api·validation·messages. `useTileOpen()`(`components/common/TileWorkspaceContext.tsx`): `(path: string, reset: boolean) => void`.
- Produces: 라우트 `/inquiries`, `/inquiries/[id]`.

- [ ] **Step 1: Next 16 변경 확인** — `frontend/AGENTS.md` 대로 `node_modules/next/dist/docs/` 에서 동적 라우트 `params` 사용 규칙(Promise 여부)을 읽는다. 상세 페이지는 얇게(`params` 에서 id 만 꺼내 `InquiryDetailView` 에 넘김).
- [ ] **Step 2: Write the failing test** — `tileScreens.test.ts` 에 `screenOf("/inquiries")` = `{ id: "inquiries", group: "common" }`, `screenOf("/inquiries/abc")` = `{ id: "inquiryDetail", group: "common" }` 단언 추가. Run `pnpm exec vitest run src/lib/tileScreens.test.ts` → FAIL.
- [ ] **Step 3: `tileScreens.ts`** `SCREENS` 에 두 줄(상세 정규식 `^\/inquiries\/[^/]+$`) 추가 → PASS.
- [ ] **Step 4: 컴포넌트 구현.**
  - `InquiryBoard`(`"use client"`): 로딩·빈 상태("아직 문의가 없습니다")·오류("연결할 수 없습니다" + 재시도) 상태 UI, 목록 항목(제목·시각·답글 수), `[더 보기]`(커서), 항목 클릭은 `useTileOpen()(`/inquiries/${id}`, false)`, 위에 `InquiryForm`. 글 등록 성공 시 목록 맨 위에 추가.
  - `InquiryForm`/`InquiryReplyForm`: react-hook-form + `zodResolver(inquirySchema | inquiryReplySchema)`, `mode: "onTouched"`, 필드 아래 빨간 오류 문구, 제출 버튼은 비었거나 오류면 비활성·제출 중 스피너·중복 제출 방지, 서버 `fields` 오류를 `setError` 로 해당 필드에, 필드를 못 찾으면 폼 위, `UNREACHABLE`/5xx 는 폼 위 안내 + 입력값 유지.
  - `InquiryDetailView`: 글 본문(`whitespace-pre-wrap`, 텍스트 노드) + 답글 목록 + `InquiryReplyForm`. 404(`NOT_FOUND`)면 "찾을 수 없습니다" 안내와 목록으로 돌아가기.
  - 스타일은 Tailwind + `globals.css` 토큰, 모바일(390px) 먼저. 스타일·간격 기준은 `docs/design.md`.
- [ ] **Step 5: 헤더** — `Header.tsx` 의 `nav` 문구 배열과 `navHrefs` 에 "문의" / `/inquiries` 추가. `nav` 를 쓰는 다른 곳이 있는지 `grep` 으로 확인해 영향(모바일 탭바 등)이 없으면 그대로, 있으면 결과 보고에 적는다.
- [ ] **Step 6: E2E** `e2e/inquiry.spec.ts` — 로그인 없이: `/inquiries` 에서 유니크 제목(`문의-${Date.now()}`)과 내용 `<script>window.__x=1</script>` 입력 → [등록] → 목록에 제목이 보임 → 제목 클릭 → 상세에 내용이 **글자 그대로** 보이고 `window.__x` 가 undefined → 답글 입력 → 답글이 보임. 문구는 `@/messages/inquiry` 에서 import(하드코딩 금지).
- [ ] **Step 7: 검증** `pnpm typecheck && pnpm lint && pnpm test`, 백엔드·compose 를 띄우고 `pnpm e2e e2e/inquiry.spec.ts` 1번(시간 초과는 재실행 1번 통과면 끝). 넓은 화면에서 직접 확인: 헤더로 열기 `[홈 | 문의]`, 주기능에서 열기 `[홈 | 주기능 | 문의]`, 새로고침 복원, 모바일 390px. 결과 보고에 새 화면 체크리스트(frontend.md) 6항목 결과를 적는다.
- [ ] **Step 8: Commit** `feat(frontend): 익명 문의 게시판 화면`.

---

## Task 6: 검증·PR

- [ ] **Step 1: `./gradlew check`**(Docker Desktop 실행 필수) + `pnpm typecheck && pnpm lint && pnpm test` 전부 통과를 눈으로 확인.
- [ ] **Step 2: `git grep`** 으로 실제 IP·포트·호스트·사용자 이메일이 파일에 안 들어갔는지 확인.
- [ ] **Step 3: push → PR(`dev` 대상)**. 본문: 무엇을·왜·확인 방법, "운영 공개 전 제거" 경고, 새 설정·의존성 없음. 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Step 4: `/code-review` 1회 → 타당한 지적 반영 → 검사 재실행.** 인증 없는 쓰기 API 라 `/security-review` 도 1회(diff 에 마이그레이션 포함 안 되지만 `SecurityConfig` 변경). 지적은 고침/보류+이유로 직접 정하고 사용자에게 고르라고 넘기지 않는다.
- [ ] **Step 5: 결과 보고** — 구현 선택 이유, 다른 영역 영향(`SecurityConfig` 허용 경로·헤더 nav·화면 표), 확인한 화면 배치, 열린 위험(스팸 방어 없음).
