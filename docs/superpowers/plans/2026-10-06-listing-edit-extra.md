# 매물 수정·판매정보 추가등록 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 판매자가 올린 매물을 고치는 수정 화면과, 보증·서류를 나중에 보태는 추가등록 화면(대상 매물 고르기 + 입력)을 만든다.

**Architecture:** 백엔드는 기존 `PATCH`를 그대로 쓰고 `GET /api/v1/listings/mine`(내 매물 커서 목록)과 보증 일수 허용 목록 검증만 더한다. 프론트는 수정·추가등록을 화면 둘로 따로 만들고, 칸 컴포넌트·업로더는 등록 폼과 공유한다. 저장은 "처음 값과 비교해 바뀐 칸만" PATCH로 보낸다.

**Tech Stack:** Spring Boot 4.1 / Java 21 / JPA 동적 JPQL / Testcontainers, Next.js 16 / React 19 / react-hook-form 7 + zod 4 / Vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-listing-edit-extra-design.md`

## Global Constraints

- 코드 변경은 브랜치 + 푸시 + PR만, main 로컬 머지 금지. PR 3개: ① `feat/listing-mine`(Task 1–2) ② `feat/listing-edit`(Task 3–6) ③ `feat/listing-extra`(Task 7–9). 각 PR 후 `/code-review`를 직접 돌려 반영.
- 머지 전: `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`.
- 입력 검증은 프론트(zod)·백엔드(Bean Validation/서비스) 같은 값. 사용자에게 보이는 문구는 `frontend/src/messages/`.
- 개인정보는 응답·로그에 안 둔다. 요청자 id는 `@AuthenticationPrincipal`에서만.
- 새 API마다 Bruno 요청 파일. 쓰기·읽기 모두 테스트: 정상 1, 권한 없음 1, 잘못된 입력 1.
- 한글 파일은 국소 수정(전체 재저장 금지), 줄바꿈 바꾸지 않기(한 줄 수정에 파일 전체 diff가 나면 되돌린다).
- 보증 개월 ↔ 일수: 0·1·3·6·12·24·36개월 = 0·30·90·180·360·720·1080일.
- 파일 형식(업로드 정책, `UploadKind`): 데이터시트 pdf / 테스트리포트·인증서·대체품 pdf·jpg·png (각 10MB). 스펙 문서의 "테스트리포트·인증서 pdf" 표현은 오기라 이 줄이 맞다 — Task 9에서 스펙도 고친다.
- 의존성 추가 없음.

## Review Focus

- 남의 매물 수정·추가등록 화면 진입: 서버 403을 받아 "내 매물만" 안내를 보이고, 폼 값은 보이지 않는다 (Task 6, 9).
- 옛 상품상태·옛 보증 일수(예: `신품대비 70%`, 365일)가 구간에 안 맞을 때: 가장 가까운 구간으로 채우거나 "선택하세요"로 두고, 바꾸지 않으면 PATCH에 안 실린다 (Task 3, 7).
- 아무것도 안 바꿨는데 저장 누름·업로드 중 저장 누름: [저장] 비활성 (Task 6, 9).
- 파일 칸 삭제(`""`)와 "안 바꿈(생략)"을 섞지 않는다: 기존 키를 그대로 두면 생략, 지우면 `""` (Task 3, 7).
- `/mine`: 로그인 없으면 401, 남의 매물은 절대 안 나옴, 커서가 같은 초의 다른 매물을 건너뛰지 않음 (Task 1).
- 수정에서 납기일을 안 바꿨는데 이미 지난 날짜: 저장이 막히면 안 된다 (Task 4).

---

## PR ① 백엔드

### Task 1: `GET /api/v1/listings/mine`

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingMineItemResponse.java`, `.../dto/ListingMinePageResponse.java`
- Modify: `listing/repository/ListingSearchRepository.java`, `listing/service/ListingService.java`, `listing/controller/ListingController.java`
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingMineApiTest.java`
- Create: `bruno/listings/mine.bru`
- Modify: `docs/security.md`

**Interfaces:**
- Produces: `record ListingMineItemResponse(UUID userId, String regDate, String prodNo, String prodName, String prodBrand, int extraFilled)`; `record ListingMinePageResponse(List<ListingMineItemResponse> items, String nextCursor)`; `ListingSearchRepository.findMinePage(UUID userId, String afterRegDate, int limit): List<Object[]>` (각 행 `[Listing, Product]`, `reg_date desc` — 같은 사용자라 `user_id` 동률 없음); `ListingService.mine(UUID userId, String cursor): ListingMinePageResponse`.
- Contract: `extraFilled` = 보증기간(`warrantyPeriod != null`) + 불량지원 + 대체품 + 테스트리포트 + 인증서 중 채운 개수(0~5). 커서는 `regDate`만(같은 사용자의 `regDate`는 유일). 형식이 깨진 커서는 첫 페이지. 페이지 크기 20. 스펙은 "검색 결과 항목에 `extraFilled`를 더한다"였으나 화면이 쓰는 칸만 담은 작은 DTO로 정했다(검색 DTO를 부풀리지 않으려고, 응답이 작을수록 좋다).

- [ ] **Step 1: 실패하는 테스트.** `ListingMineApiTest`(`ListingApiTest`와 같은 설정: `@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`, `@AfterEach`에서 매물·상품 삭제). 테스트: `mineReturnsOnlyMyListingsNewestFirst`(내 매물 3개 + 남의 1개 → 내 것 3개, `regDate` 내림차순, 남의 것 없음), `mineExtraFilledCountsFiveFields`(보증 90일 + 불량지원 "대체" + 테스트리포트 키만 있는 매물 → `extraFilled` = 3, 아무것도 없는 매물 → 0), `minePagesByCursor`(21개 → 첫 페이지 20 + `nextCursor` 있음, 두 번째 1개 + `nextCursor` null), `mineRequiresLogin`(쿠키 없이 → 401 `UNAUTHENTICATED`), `mineBrokenCursorReturnsFirstPage`(`?cursor=zzz` → 200 첫 페이지). 응답에 `email`·`phone` 같은 키가 없음도 확인(`jsonPath("$.items[0].email").doesNotExist()`).
- [ ] **Step 2: 실패 확인.** Run: `cd backend && ./gradlew test --tests '*ListingMineApiTest'` — Expected: FAIL (404 또는 컴파일 오류).
- [ ] **Step 3: 구현.** `findMinePage`는 고정 JPQL `select l, p from Listing l join Product p on p.prodId = l.prodId where l.userId = :u [and l.regDate < :cr] order by l.regDate desc`, 값은 전부 바인딩. 서비스 `mine`은 `PAGE_SIZE + 1`개를 읽어 다음 페이지 유무를 정하고 `toMineItem`에서 `extraFilled`를 센다(채움 판단 로직은 `Listing`의 엔티티 메서드 `extraFilledCount()`로 — 정적 유틸에 비즈니스 로직 금지). 컨트롤러 `@GetMapping("/mine")`은 `@AuthenticationPrincipal AuthenticatedUser me`로 사용자 id를 쓴다. `/{userId}/{regDate}`와 경로 모양(세그먼트 수)이 달라 충돌하지 않는다. 읽기라 rate limit은 두지 않는다.
- [ ] **Step 4: 통과 확인.** 같은 명령 — Expected: PASS. 그다음 `./gradlew test --tests '*Listing*'`.
- [ ] **Step 5: Bruno·문서.** `bruno/listings/mine.bru`(GET, 로그인 쿠키), security.md "매물"에 `/mine` 접근 규칙(본인만, 비로그인 401)·응답 항목 한 줄.
- [ ] **Step 6: Commit.** `git commit -m "feat(backend): 내 매물 목록 GET /api/v1/listings/mine"` (본문에 왜: 추가등록 화면이 내 매물을 고르려면 필요).

### Task 2: 보증 일수 허용 목록

**Files:**
- Modify: `listing/service/ListingService.java`, `bruno/listings/update.bru`, `docs/security.md`
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`

**Interfaces:**
- Produces: `ListingService.WARRANTY_DAYS: Set<Integer>` = {0, 30, 90, 180, 360, 720, 1080}. 위반 시 `ValidationException(Map.of("warrantyPeriod", "보증기간은 목록에서 고른 값이어야 합니다."))`.
- Contract: `update`에서 `req.warrantyPeriod() != null`이고 목록 밖이면 거절. 단 **저장된 값과 같으면 통과**(납기일 규칙과 같은 이유: 옛 값 365일이 DB에 있어도 다른 칸 수정이 막히지 않게). DTO의 `@Min(0) @Max(36_500)`은 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트.** `ListingApiTest`에 `warrantyPeriodAllowsOnlyListedDays`: `0·30·90·180·360·720·1080`은 `patch` 200, `365`·`1`·`1081`은 400 + `fields.warrantyPeriod`. 추가로 `warrantyPeriodSameAsStoredPasses`: DB에 `warranty_period = 365`를 직접 넣고 `{"warrantyPeriod":365}` → 200.
- [ ] **Step 2: 실패 확인.** `./gradlew test --tests '*ListingApiTest.warrantyPeriod*'` — Expected: FAIL.
- [ ] **Step 3: 구현.** 서비스 `update`의 날짜 검증 옆에서 위 계약대로 검사. 기존 테스트에서 `warrantyPeriod`에 다른 값(예: 365)을 쓰는 곳을 찾아 목록 안 값으로 고친다 (`grep -n warrantyPeriod`).
- [ ] **Step 4: 통과 확인.** `./gradlew check` — Expected: PASS.
- [ ] **Step 5: 문서·Bruno.** security.md 매물 표에 보증기간 허용 일수와 이유, `update.bru`의 보증 예시를 90으로. decisions.md에는 PR ②에서 항목을 한 번에 적는다.
- [ ] **Step 6: Commit** `feat(backend): 보증기간은 허용 일수 목록만 받음` → push → PR ① 열기 → `/code-review` → 반영.

---

## PR ② 수정 화면

### Task 3: 수정 요청 타입·API·값 변환 (순수 함수)

**Files:**
- Modify: `frontend/src/types/listing.ts`, `frontend/src/lib/api/listings.ts`, `frontend/src/lib/validation/listing.ts`(상품상태 매핑이 쓰는 `PROD_STATES` 재사용만)
- Create: `frontend/src/lib/listingEdit.ts`
- Test: `frontend/src/lib/listingEdit.test.ts`

**Interfaces:**
- Produces (types): `interface ListingUpdateRequest { prodState?: string; salesUnitPrice?: number; salesQuantity?: number; minOrderQuantity?: number; orderUnit?: number; deliveryDate?: string; stockQuantity?: number; description?: string; listingDataSheet?: string; photos?: string[]; warrantyPeriod?: number; warrantyCoverage?: string; replaceProd?: string; testReport?: string; certificateOfAuthen?: string }` (백엔드 `ListingUpdateRequest`와 1:1. 파일 칸 `""`=비우기, 생략=안 바꿈).
- Produces (api): `listingsApi.update(userId: string, regDate: string, patch: ListingUpdateRequest): Promise<ApiResult<ListingDetail>>` — `PATCH`, `Content-Type: application/json`. Idempotency-Key 없음(수정은 같은 값 재전송이 안전).
- Produces (`lib/listingEdit.ts`):
  - `prodStateFromStored(stored: string): (typeof PROD_STATES)[number] | ""` — 목록 값이면 그대로, `신품대비 N%` 옛 형식이면 N에 맞는 구간(90~99→`90~99%`, 80~89, 70~79, 60~69, 50~59, 50 미만→`50% 미만`, 100 이상→`신품`), 그 밖(`양호`, `new` 등)은 `""`.
  - `interface ListingEditValues { prodState: string; salesUnitPrice: string; salesQuantity: string; stockQuantity: string; minOrderQuantity: string; orderUnit: string; deliveryDate: string; description: string }` (폼 입력 상태, 문자열).
  - `editInitialValues(d: ListingDetail): ListingEditValues` — 숫자는 문자열로, `null`은 `""`, 상태는 `prodStateFromStored`.
  - `diffToUpdateRequest(initial: ListingEditOutput, current: ListingEditOutput): ListingUpdateRequest` — 값이 다른 칸만 담는다(키 자체를 생략). 비교는 출력 값(숫자·문자열) 기준. `deliveryDate`를 비웠으면 `""`, `description`을 비웠으면 `""`. (`ListingEditOutput`은 Task 4 스키마 출력 타입.)
  - `fileDiff(initial: string[], current: string[]): string[] | undefined` — 사진 배열이 같으면 `undefined`(생략), 다르면 현재 배열(빈 배열이면 `[]`로 전부 지움).

- [ ] **Step 1: 실패하는 테스트.** `prodStateFromStored`: `"신품"`→`"신품"`, `"신품대비 70%"`→`"신품대비 70~79%"`, `"신품대비 99%"`→`90~99%`, `"신품대비 50%"`→`50~59%`, `"신품대비 49%"`→`"신품대비 50% 미만"`, `"신품대비 100%"`→`"신품"`, `"양호"`·`"new"`→`""`. `editInitialValues`: 샘플 `ListingDetail`(재고 null, 납기 null)로 `""` 변환. `diffToUpdateRequest`: 같은 두 값 → `{}`; 단가만 다르면 `{ salesUnitPrice }`; 납기일을 지우면 `{ deliveryDate: "" }`; 설명을 지우면 `{ description: "" }`. `fileDiff`: 같음→`undefined`, 순서 바뀜→현재 배열, 전부 삭제→`[]`.
- [ ] **Step 2: 실패 확인.** `cd frontend && pnpm vitest run src/lib/listingEdit.test.ts` — Expected: FAIL.
- [ ] **Step 3: 구현.** 위 시그니처대로. `diffToUpdateRequest`는 출력 타입의 칸 이름 배열을 순회해 `Object.is` 비교 후 다를 때만 `Object.assign`(등록 폼 `toCreateRequest`의 선택 칸 처리와 같은 방식).
- [ ] **Step 4: 통과 확인.** 같은 명령 + `pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): 매물 수정 요청 타입·API·값 변환`.

### Task 4: 수정 폼 검증 스키마

**Files:**
- Modify: `frontend/src/lib/validation/listing.ts` (`requiredInt`·`optionalInt`·`optionalDate`·`optionalText`·상수를 export)
- Create: `frontend/src/lib/validation/listingEdit.ts`
- Test: `frontend/src/lib/validation/listingEdit.test.ts`
- Modify: `frontend/src/messages/listing.ts`

**Interfaces:**
- Consumes: Task 3 `ListingEditValues`.
- Produces: `listingEditSchema(today: string, initialDeliveryDate: string)`; `type ListingEditInput = z.input<…>`; `type ListingEditOutput = z.output<…>` — 칸은 `ListingEditValues` 8개 + `photos: string[]` + `listingDataSheet: string`(빈 칸 `""`).
- Rules: 등록 폼 규칙과 같다(수치는 security.md). 차이 세 가지 — ① `stockQuantity`·`minOrderQuantity`·`orderUnit`은 **필수**(등록은 선택). ② `prodState`는 `PROD_STATES` 중 하나(옛 값이 매핑되지 않아 `""`면 "선택하세요" 오류). ③ `deliveryDate`는 `""`(비움) 허용이고, 초기값과 **같으면** 오늘 이후 검사를 건너뛴다. 최소주문량 ≤ 판매수량 교차 검사는 그대로(zod 4의 `superRefine`은 칸 검사가 실패해도 돌므로 타입 확인 후 비교).

- [ ] **Step 1: 실패하는 테스트.** 정상 값 통과; `stockQuantity: ""` 오류(필수); 단가 `"1e3"` 거부; `minOrderQuantity > salesQuantity` → `minOrderQuantity` 칸 오류; `prodState: ""` 오류; 납기 `"2020-01-01"`이 초기값과 같으면 통과·다르면(초기 `""`) 오류; 납기 `""` 통과.
- [ ] **Step 2: 실패 확인.** `pnpm vitest run src/lib/validation/listingEdit.test.ts` — Expected: FAIL.
- [ ] **Step 3: 구현.** 등록 스키마의 조각을 재사용. 문구는 `messages/listing.ts` `validation`에 `prodState`(이미 있음), 필수 문구는 `required` 재사용.
- [ ] **Step 4: 통과 확인.** 같은 명령 + 전체 `pnpm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): 매물 수정 폼 검증 스키마`.

### Task 5: 업로더 일반화·기존 값 초기화

**Files:**
- Create: `frontend/src/components/listing/SingleFileUploader.tsx` (현 `DatasheetUploader`를 일반화)
- Delete: `frontend/src/components/listing/DatasheetUploader.tsx`
- Modify: `frontend/src/components/listing/PhotoUploader.tsx`, `frontend/src/components/listing/ListingForm.tsx`(데이터시트 사용처), `frontend/src/lib/validation/upload.ts`, `frontend/src/types/listing.ts`(`ListingUploadKind` 확장), `frontend/src/messages/upload.ts`, `frontend/src/messages/listing.ts`
- Test: `frontend/src/lib/validation/upload.test.ts`

**Interfaces:**
- Produces: `UploadKind`에 `"doc"` 추가(확장자 `.pdf .jpg .jpeg .png`, 10MB) — `acceptOf("doc")`·`checkUpload("doc", file)`. 오류 문구는 `upload.format.doc`·`upload.size.doc`.
- Produces: `ListingUploadKind` = `"listing-photo" | "listing-datasheet" | "listing-test-report" | "listing-certificate" | "listing-replace-prod"` (백엔드 `UploadKind.value()`와 같은 문자열).
- Produces: `SingleFileUploader` props: `{ uploadKind: ListingUploadKind; checkKind: UploadKind; label: string; hint?: string; pickLabel: string; removeLabel: string; value: string; onChange: (key: string) => void; onUploadingChange: (u: boolean) => void; error?: string; initialKey?: string }` — 동작은 현 데이터시트 업로더와 같다(교체 실패 시 이전 파일 복원, 실패한 파일 [다시 시도], 순번으로 늦은 응답 무시, 오류 겹쳐 표시, 라벨 왼쪽 격자). `initialKey`가 있으면 `done` 상태로 시작하고 이름 대신 `listing.form.existingFile`("등록된 파일")을 보인다. 삭제하면 `onChange("")`.
- Produces: `PhotoUploader`에 `initialKeys?: string[]` — 기존 키로 슬롯을 `done`으로 채우고 미리보기는 `fileUrl(key)`(`lib/files.ts`). 슬롯 `file`은 선택값이 된다(기존 사진엔 재업로드 파일이 없으므로 [다시 시도] 대상 아님).

- [ ] **Step 1: 실패하는 테스트.** `upload.test.ts`에 `checkUpload("doc", …)`: `.pdf`·`.JPG`·`.png` 통과, `.xlsx` 거부(문구 = `upload.format.doc`), 10MB 초과 거부, 0바이트 거부.
- [ ] **Step 2: 실패 확인.** `pnpm vitest run src/lib/validation/upload.test.ts` — Expected: FAIL.
- [ ] **Step 3: 구현.** `rules`·메시지에 `doc` 추가. `DatasheetUploader`를 `SingleFileUploader`로 옮겨 일반화하고 등록 폼의 사용처를 `uploadKind="listing-datasheet" checkKind="pdf"`로 바꾼다(동작 변화 없음). 두 업로더의 TODO(수정 화면) 주석은 구현하면서 지운다. 마운트 때 빈 값을 폼에 넣는 effect는 `initialKey/initialKeys`가 있으면 그 값이 폼 값과 같으므로 그대로 둔다.
- [ ] **Step 4: 통과 확인.** `pnpm typecheck && pnpm lint && pnpm test` — Expected: PASS. 등록 폼 동작은 브라우저에서 한 번 확인(데이터시트 올리기·실패·교체).
- [ ] **Step 5: Commit** `refactor(frontend): 단일 파일 업로더 일반화, 사진·파일 업로더 기존 값 초기화`.

### Task 6: 수정 화면

**Files:**
- Create: `frontend/src/app/listings/[userId]/[regDate]/edit/page.tsx`, `frontend/src/components/listing/EditListingView.tsx`, `frontend/src/components/listing/ListingEditForm.tsx`
- Modify: `frontend/src/components/listing/ListingActions.tsx`, `frontend/src/messages/listing.ts`, `docs/design.md`, `docs/decisions.md`

**Interfaces:**
- Consumes: Task 3 `listingsApi.update`·`editInitialValues`·`diffToUpdateRequest`·`fileDiff`; Task 4 `listingEditSchema`; Task 5 업로더.
- Produces: `EditListingView({ userId, regDate })` — `RequireLogin` 안에서 `listingsApi.get` + `authApi.me()`로 조회. 상태: 로딩(스켈레톤), 없음("매물을 찾을 수 없음" + 검색 링크), 오류([다시 시도]), 남의 매물(내 id ≠ `userId` → `listing.errors.FORBIDDEN` 안내, 폼 안 그림), 준비. `ListingEditForm({ detail })` — 위쪽에 상품마스터 칸(카테고리·상품명·제조사·상품번호·제조일·사양)을 읽기 전용 표로, 아래에 편집 칸(상품상태·단가·판매수량·재고수량·최소주문량·주문단위·납기일·설명·사진·데이터시트). `mode: "onTouched"`, 라벨 왼쪽 `inline`. 제출 = `diffToUpdateRequest` + `fileDiff`(사진)·데이터시트(바뀌면 새 키, 지웠으면 `""`)를 합친 PATCH. 성공 → 상세로 이동(`router.push`). 서버 필드 오류는 해당 칸에, 연결 실패는 폼 위 [다시 시도].
- Submit rule: 바뀐 칸이 없으면 [저장] 비활성, 업로드 중 비활성, 제출 중·성공 후 이동 중 비활성(중복 방지).

- [ ] **Step 1: 구현(순수 함수는 Task 3·4에서 테스트됨).** 페이지는 `NewListingPage`와 같은 틀(`RequireLogin`, 최대 폭 720, 흰 카드). 상세 `ListingActions`의 [수정]을 `<Link href=".../edit">`로, 그 옆에 [판매정보 추가]를 `<Link href=".../extra">`로(PR ③에서 연결되므로 이 PR에서는 [수정]만 연결하고 [판매정보 추가]는 PR ③에서 더한다). `messages/listing.ts`에 `edit` 구역 문구(제목·부제·`existingFile`·저장·"바꾼 내용이 없어요" 등)를 모은다.
- [ ] **Step 2: 확인.** `pnpm typecheck && pnpm lint && pnpm test` — Expected: PASS.
- [ ] **Step 3: 브라우저 수동 확인(체크리스트).** 내 매물 [수정] → 값이 채워짐 · 아무것도 안 바꾸면 [저장] 비활성 · 단가만 바꾸고 저장 → 상세에 반영 · 사진 1장 삭제·추가 · 데이터시트 삭제 후 저장 · 납기일 지우고 저장 · 옛 상태 값 매물은 구간으로 채워짐 · 남의 매물 주소로 직접 들어가면 안내 · 390px 너비 · 로그아웃 상태에서 접근 시 로그인으로.
- [ ] **Step 4: 문서.** design.md에 "매물 수정" 규격(위 구조), decisions.md에 "2026-10-0X 매물 수정·추가등록: 화면 분리, 보증 개월 드롭다운, 옛 값 매핑, 바뀐 칸만 PATCH" 항목 + 색인.
- [ ] **Step 5: Commit** `feat(frontend): 매물 수정 화면` → push → PR ② → `/code-review` → 반영.

---

## PR ③ 추가등록

### Task 7: 추가등록 값 변환·내 매물 API

**Files:**
- Modify: `frontend/src/types/listing.ts`, `frontend/src/lib/api/listings.ts`
- Create: `frontend/src/lib/listingExtra.ts`
- Test: `frontend/src/lib/listingExtra.test.ts`
- Modify: `frontend/src/messages/listing.ts`

**Interfaces:**
- Produces (types): `interface ListingMineItem { userId: string; regDate: string; prodNo: string | null; prodName: string; prodBrand: string; extraFilled: number }`, `interface ListingMinePage { items: ListingMineItem[]; nextCursor: string | null }` (백엔드 `ListingMineItemResponse`·`ListingMinePageResponse`와 1:1).
- Produces (api): `listingsApi.mine(cursor?: string): Promise<ApiResult<ListingMinePage>>` — `GET /api/v1/listings/mine[?cursor=]`, `cache: "no-store"`.
- Produces (`lib/listingExtra.ts`):
  - `WARRANTY_MONTHS = [0, 1, 3, 6, 12, 24, 36] as const`, `monthsToDays(m: number): number` (= `m × 30`), `daysToMonths(days: number | null): number` — `null`은 0, 목록의 개월 중 일수 차이가 가장 작은 값(동률이면 작은 쪽).
  - `WARRANTY_COVERAGES = ["", "대체", "환불"] as const`.
  - `interface ExtraValues { warrantyMonths: number; warrantyCoverage: string; replaceProd: string; testReport: string; certificateOfAuthen: string }` (파일 칸은 업로드 키, 없으면 `""`).
  - `extraInitialValues(d: ListingDetail): ExtraValues`.
  - `diffToExtraRequest(initial: ExtraValues, current: ExtraValues, initialDays: number | null): ListingUpdateRequest` — 바뀐 칸만. 보증은 `monthsToDays(current.warrantyMonths)`가 **저장된 일수와 다르고** 개월이 바뀌었을 때만 실린다(옛 365일이 12개월로 보여도 사용자가 안 건드렸으면 생략). 불량지원을 "없음"(`""`)으로 바꾸면 `""`, 파일 칸을 지우면 `""`, 그대로면 생략.
  - `extraFilledLabel(n: number): string` — `보증·서류 n/5`.

- [ ] **Step 1: 실패하는 테스트.** `daysToMonths`: `null`→0, `90`→3, `360`→12, `365`→12, `1080`→36, `45`→1(30일과 차이 15, 90일과 차이 45), `60`→1(30일·90일과 차이 30 동률이면 작은 쪽); `monthsToDays(12)` = 360; `extraInitialValues` 샘플; `diffToExtraRequest`: 안 바꿈 `{}`, 옛 365일 상태에서 개월 그대로면 `warrantyPeriod` 생략, 12→24면 `{ warrantyPeriod: 720 }`, 불량지원 `"대체"`→`""`면 `{ warrantyCoverage: "" }`, 인증서 키 삭제면 `{ certificateOfAuthen: "" }`, 테스트리포트를 새 키로 교체면 `{ testReport: "새키" }`; `extraFilledLabel(3)`.
- [ ] **Step 2: 실패 확인.** `pnpm vitest run src/lib/listingExtra.test.ts` — Expected: FAIL.
- [ ] **Step 3: 구현.** 위 시그니처대로. 문구(라벨·"없음"·"개월")는 `messages/listing.ts`의 `extra` 구역.
- [ ] **Step 4: 통과 확인.** `pnpm test && pnpm typecheck` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(frontend): 추가등록 값 변환·내 매물 조회 API`.

### Task 8: 추가등록 — 매물 고르기 화면

**Files:**
- Create: `frontend/src/app/listings/extra/page.tsx`, `frontend/src/components/listing/ExtraPicker.tsx`
- Modify: `frontend/src/messages/listing.ts`, `frontend/src/components/home/QuickMenu.tsx`(경로 TODO 정리), `docs/design.md`

**Interfaces:**
- Consumes: Task 7 `listingsApi.mine`·`extraFilledLabel`.
- Produces: `ExtraPicker` — `RequireLogin` 안에서 `mine()`을 읽고 [더 보기]로 `nextCursor`를 이어 붙인다. 한 줄 = 상품명(말줄임) · 상품번호(mono) · 제조사 · 등록일(`formatRegDate`) · `extraFilledLabel`, 줄 전체가 `/listings/{userId}/{regDate}/extra` 링크. 빈 상태 "등록한 매물이 없어요" + [매물 등록하기](`/listings/new`). 로딩 스켈레톤 8줄, 오류 "불러오지 못했어요" + [다시 시도], 429는 "잠시 후 다시 시도해 주세요"(검색 결과와 같은 규칙), 더 보기 실패는 받은 목록 유지 + 버튼 옆 한 줄.

- [ ] **Step 1: 구현.** 페이지 틀은 등록 페이지와 같다(`RequireLogin`, 폭 720). `QuickMenu`의 `routes.sellExtra` TODO 주석은 "구현됨"으로 고친다. 검색 결과 `SearchResults`의 더 보기·오류 처리 패턴을 따른다(복제하지 말고 필요한 만큼만).
- [ ] **Step 2: 확인.** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: 브라우저 확인.** 홈의 판매정보 추가등록 아이콘 → 내 매물 목록 · 매물 없는 계정에서 빈 상태 · 21개 이상일 때 [더 보기] · 비로그인이면 로그인으로.
- [ ] **Step 4: Commit** `feat(frontend): 추가등록 — 내 매물 고르기 화면`.

### Task 9: 추가등록 — 입력 화면

**Files:**
- Create: `frontend/src/app/listings/[userId]/[regDate]/extra/page.tsx`, `frontend/src/components/listing/ExtraListingView.tsx`, `frontend/src/components/listing/ExtraForm.tsx`
- Modify: `frontend/src/components/listing/ListingActions.tsx`([판매정보 추가] 링크), `frontend/src/messages/listing.ts`, `docs/design.md`, `docs/decisions.md`, `docs/superpowers/specs/2026-10-06-listing-edit-extra-design.md`

**Interfaces:**
- Consumes: Task 7 `extraInitialValues`·`diffToExtraRequest`·`WARRANTY_MONTHS`·`WARRANTY_COVERAGES`; Task 5 `SingleFileUploader`; Task 3 `listingsApi.update`.
- Produces: `ExtraListingView({ userId, regDate })`(수정 화면과 같은 상태 처리: 로딩·없음·오류·남의 매물) → `ExtraForm({ detail })`. 칸: 보증기간·불량지원 드롭다운(라벨 왼쪽 `inline`, 입력 높이 44), 대체품·테스트리포트·인증서 `SingleFileUploader`(`checkKind="doc"`, 각 `uploadKind`). 이미 채운 값은 미리 채워 보이고 [삭제]로 비운다. 저장 = `diffToExtraRequest`의 PATCH, 성공 → 상세로 이동. 바뀐 게 없거나 업로드 중이면 [저장] 비활성. 서버 필드 오류는 해당 칸에.

- [ ] **Step 1: 구현.** 폼은 값이 몇 개 안 되므로 react-hook-form 없이 `useState` 한 객체로 충분하다(검증할 자유 입력이 없고 전부 선택·업로드 — 단, 규칙을 어기지 않으려 서버 오류 표시는 `applyServerError` 대신 칸별 메시지 맵으로 직접). 서류 업로드 실패·다시 시도는 업로더가 맡는다. 상세의 [판매정보 추가] 링크를 더한다.
- [ ] **Step 2: 확인.** `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 3: 브라우저 확인.** 매물 고르기 → 입력 → 보증 12개월·불량지원 대체·테스트리포트 pdf 업로드 → 저장 → 상세에 보증기한·서류 링크 · 다시 열어 값이 채워짐 · 인증서 삭제 후 저장 · 아무것도 안 바꾸면 비활성 · 남의 매물 주소 · 390px.
- [ ] **Step 4: 문서.** design.md에 두 화면 규격, 스펙 문서의 파일 형식 오기(테스트리포트·인증서는 pdf·jpg·png) 정정(원문은 지우지 않고 아래에 "정정" 표시).
- [ ] **Step 5: Commit** `feat(frontend): 추가등록 입력 화면` → push → PR ③ → `/code-review` → 반영.
