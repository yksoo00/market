# 내 판매글(검색형 + 행 안 수정)·메뉴 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 메뉴를 넷(마이페이지·내 판매글·내 구매목록·로그아웃)으로, `/my/listings`를 검색 결과 화면 모양의 내 글 화면 + 행 안 수정으로, `/my`를 허브로 바꾼다.

**Architecture:** 백엔드는 검색 API에 `mine=true`(본인 글 필터)와 PATCH에 상품 필드(공유 상품마스터 보호 규칙)를 더한다. 프론트는 검색 화면 부품에 `scope: "search" | "mine"`을 넘겨 재사용하고, 행 수정은 [수정] 시 상세(`listingsApi.get`)를 받아 초기값으로 쓰는 `RowEditor`가 맡는다. `/mine` 확장 필드와 `MyListings`는 되돌린다.

**Tech Stack:** Spring Boot 4.1 + MockMvc/Testcontainers, Next.js 16 + React 19, Tailwind 4, zod 4, Vitest, Playwright(#41).

**Spec:** `docs/superpowers/specs/2026-10-06-my-listings-design.md`

## Global Constraints

- 브랜치 `feat/mypage`(PR #40) 위에서 커밋, 푸시. 로컬 머지 금지. E2E 수정만 `chore/playwright-e2e`(PR #41).
- 스테이징 전 줄바꿈 LF(`sed -i 's/\r$//'` → `git -c core.autocrlf=false add <경로>`), `docs/setup.md` 제외. 커밋 trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 새 의존성 없음. 문구는 `frontend/src/messages/`. 개인정보 응답·화면 금지. 검증 수치는 `docs/security.md`(등록과 동일).
- 검증 명령: `cd backend; ./gradlew check`, `cd frontend; pnpm typecheck && pnpm lint && pnpm test`.
- 서버 오류 코드 이름 = 프론트 `messages/*.ts` errors 키 (`PRODUCT_SHARED`).

## Review Focus

1. 상품명은 같고 제조사만 바뀜 / 대소문자·앞뒤 공백만 다른 이름 → `findOrCreate`가 trim 한 값으로 찾는다(등록과 같게). Task 2 테스트.
2. 상품 칸과 매물 칸을 한 요청에 보냈는데 상품 쪽이 422 → 매물 칸도 안 바뀐다(트랜잭션). Task 2 테스트.
3. 수정 중 다른 행 [수정]·검색·필터 변경·[더 보기] → 한 번에 한 행, 수정 중엔 목록 조작을 숨긴다. Task 5.
4. 사진·파일 업로드 중 [저장] → 비활성(키 누락 방지). Task 5.
5. `mine=true` 를 비로그인으로 / 남의 글이 섞이지 않는지 / 커서 다음 페이지도 본인 글만. Task 1 테스트.

---

### Task 1: 검색 `mine=true` + `/mine` 되돌림

**Files:** `ListingSearchCondition.java`, `ListingSearchRepository.java`(`appendConditions`·`count`), `ListingController.java`(`list`), `ListingSearchApiTest.java`; 되돌림: `ListingMineItemResponse.java`, `ListingService.mine`·`firstPhoto`, `ListingMineApiTest.java`(확장 필드 테스트 3개 삭제), `bruno/listings/mine.bru`, `frontend/src/types/listing.ts`(`ListingMineItem` 4필드 삭제); `bruno/listings/search.bru`(또는 새 `search-mine.bru`).

**Interfaces:** Produces `GET /api/v1/listings?mine=true` → 본인 글만, 비로그인 401 `UNAUTHENTICATED`. 조건 record 에 `Boolean mine` 추가하되 **userId 는 컨트롤러가 인증 정보에서** 넣는다: `ListingService.search(ListingSearchCondition c, UUID ownerId /* null = 전체 */)`, repository `findPage(c, ownerId, …)`·`count(c, ownerId)`.

- [ ] Step 1 (RED): `ListingSearchApiTest` 에 `@DisplayName("mine=true 면 내 글만 — 남의 글 제외, 검색어·상태 조건과 함께")`, `("mine=true 를 비로그인으로 부르면 401")`, `("mine=true 커서 다음 페이지도 내 글만")`. Run `./gradlew test --tests "*ListingSearchApiTest"` → 새 3개 FAIL.
- [ ] Step 2 (GREEN): 위 Interfaces 대로 구현(`l.userId = :owner`). 비로그인 + `mine` 은 컨트롤러에서 `ApiException(ErrorCode.UNAUTHENTICATED)`. Run → PASS.
- [ ] Step 3: `/mine` 되돌림(응답 6필드), 관련 테스트 삭제, 타입·bruno 되돌림. Run `./gradlew test --tests "*Listing*"` → PASS.
- [ ] Step 4: Commit `feat(backend): 검색 mine=true(내 글만), /mine 응답 되돌림`.

### Task 2: PATCH 상품 필드 + 공유 상품 보호

**Files:** `ListingUpdateRequest.java`(상품 필드 6개: `categoryCode @Size(max=10)`, `prodName @Size(max=50)`, `prodBrand @Size(max=50)`, `prodNo @Size(max=20)`, `prodMufcDate`(등록과 같은 패턴), `prodSpecInfo @Size(max=100)`; 이름·제조사·카테고리는 보냈다면 공백 불가), `ListingService.update`, `ProductService`(`relinkOrEdit` 류), `Product.java`(`applyEdit`), `ListingRepository`(`countByProdId`), `ErrorCode`(`PRODUCT_SHARED(HttpStatus.UNPROCESSABLE_ENTITY, …)`), `Listing`(prodId 변경 메서드), `ListingApiTest.java`, `frontend/src/messages/listing.ts`(errors.PRODUCT_SHARED), `frontend/src/types/listing.ts`(`ListingUpdateRequest` 상품 필드), `bruno/listings/update.bru`.

**Interfaces:** 규칙은 스펙 "상품 칸 규칙" 1·2·3 그대로. 응답 `ListingResponse`(바뀐 상품 값 포함). 422 응답은 `fields` 에 바꾸려던 상품 칸마다 문구.

- [ ] Step 1 (RED) `ListingApiTest`:
  - `("상품명을 바꾸면 그 이름의 기존 상품으로 옮기고 응답은 그 상품 값")` — 다른 사용자가 만든 "R750/Dell" 상품이 있을 때 내 매물 PATCH `prodName=R750` → `prodId` 가 그 상품, 응답 prodNo 가 그 상품 것, 옛 상품 행은 그대로.
  - `("없는 이름이면 보낸 값으로 새 상품을 만들고 이 매물만 옮긴다")` — 같은 상품을 쓰던 남의 매물의 prodId 불변.
  - `("이름·제조사 그대로 번호만 — 이 매물만 쓰면 상품마스터를 고친다")`.
  - `("이름·제조사 그대로 번호만 — 다른 매물도 쓰면 422 PRODUCT_SHARED, fields.prodNo")`.
  - `("상품 칸이 422 면 같은 요청의 매물 칸(상품상태)도 안 바뀐다")`.
  - `("상품명 공백·51자, 제조일 내일 → 400 VALIDATION")`.
  Run → FAIL.
- [ ] Step 2 (GREEN): 구현. 상품 처리는 매물 칸 적용보다 **먼저**(422 면 아무것도 안 바뀜), 이름·제조사 비교는 trim 후. 새 상품의 카테고리는 보낸 값 없으면 옛 상품 카테고리. Run → PASS. `./gradlew check` → PASS.
- [ ] Step 3: 프론트 타입·문구, bruno, `docs/security.md`(PATCH 상품 필드·422). Commit `feat(backend): 매물 수정에서 상품 칸 — 이 매물만 다른 상품으로, 공유 상품 보호`.

### Task 3: 메뉴 넷 · `/my` 허브 · `/my/purchases`

**Files:** `messages/my.ts`(menu.myListings, menu.myPurchases, hub, purchases 문구; `listings` 섹션 정리), `UserMenu.tsx`, `app/my/page.tsx`, `components/my/MyHub.tsx`(바로가기 카드 2), `app/my/purchases/page.tsx`; 삭제 `components/my/MyListings.tsx`.

- [ ] Step 1: 메뉴 항목 `[마이페이지(/my)] [내 판매글(/my/listings)] [내 구매목록(/my/purchases)]` · 구분선 · `[로그아웃]`. 링크 항목 모두 `onClick={() => setOpen(false)}`(타일 엔진 캡처와 Radix 충돌 — 기존 주석).
- [ ] Step 2: `/my` = `MyProfile` + `MyHub`(두 카드 링크). `/my/purchases` = 같은 틀의 빈 화면(문구 + 홈 링크), `RequireLogin`.
- [ ] Step 3: `pnpm typecheck && pnpm lint && pnpm test` → PASS. Commit `feat(frontend): 사용자 메뉴 넷, 마이페이지 허브, 내 구매목록 빈 화면`.

### Task 4: `/my/listings` 검색형 화면

**Files:** `lib/search.ts`(+test), `components/search/SearchForm.tsx`·`FilterBar.tsx`·`SearchResults.tsx`·`ResultList.tsx`, `app/my/listings/page.tsx`, `messages/search.ts` 또는 `my.ts`(빈 상태·[수정] 열 이름), `lib/tileScreens.ts`(+test: `/my/listings`·`/my` 행 — 그룹은 `common` 아님, `sell`).

**Interfaces:** `type SearchScope = "search" | "mine"`. `parseSearchParams(raw, scope = "search")`(mine 이면 status 기본 `all`), `buildSearchHref(query, scope = "search")`(경로 `/my/listings`, 기본값 생략 기준도 scope 별), `searchApiParams(query, cursor?, scope = "search")`(mine 이면 `mine=true`). 부품은 `scope` prop(기본 `"search"`).

- [ ] Step 1 (RED) `search.test.ts`: mine 파싱 기본 status `all`; mine href 경로 `/my/listings`·`status=all` 생략·`status=available` 포함; mine API 파라미터에 `mine=true`; 기존 검색 동작 불변. Run `pnpm test search` → FAIL.
- [ ] Step 2 (GREEN): 구현 → PASS.
- [ ] Step 3: 부품 `scope`: mine 이면 체크박스·[견적 요청]·[구매]·선택 개수 숨김, 빈 상태 문구·[판매상품 등록] 링크, 표 마지막에 [수정] 열(오른쪽 sticky, `stopPropagation`), 카드(< 576)의 [수정]은 `/listings/{userId}/{regDate}/edit` 링크. 이 Task 에선 표의 [수정]이 `onEdit(item)` 콜백만 부른다(Task 5 가 연결).
- [ ] Step 4: `app/my/listings/page.tsx`(검색 페이지와 같은 틀 + `RequireLogin`, `scope="mine"`). 검증 → PASS. Commit `feat(frontend): 내 판매글 — 검색 결과 화면 모양으로 내 글만`.

### Task 5: 행 안 수정 (`RowEditor`)

**Files:** Create `lib/rowEdit.ts`(+`rowEdit.test.ts`), `components/my/RowEditor.tsx`, `components/my/RowEditPanels.tsx`; Modify `ResultList.tsx`(편집 중 행 하나만·맨 위, 나머지·[더 보기] 숨김, 스크롤 복원), `messages/my.ts`.

**Interfaces:**
- `RowEditValues` = 상품(categoryCode·prodName·prodBrand·prodNo·prodMufcDate·prodSpecInfo) + prodState + warrantyMonths·warrantyCoverage + description + photos + listingDataSheet + replaceProd·testReport·certificateOfAuthen (모두 입력 문자열/키).
- `rowEditInitialValues(d: ListingDetail): RowEditValues` (상태는 `prodStateFromStored`, 보증은 `daysToMonths` 재사용).
- `diffToRowPatch(initial, current): ListingUpdateRequest` — 바뀐 것만, 빈 문자열은 비우기, 보증 개월→일(`monthsToDays`), 설명 trim 비교(기존 규칙과 같음).
- `rowEditSchema(today)` — 등록·수정과 같은 수치(재사용 가능한 `requiredText`·`optionalText`·`optionalDate` 를 `lib/validation/listing.ts` 에서 export).

- [ ] Step 1 (RED) `rowEdit.test.ts`: 안 바꾸면 `{}`; 상품명만 → `{prodName}`; 상품번호 지움 → `{prodNo: ""}`; 보증 12개월 → `{warrantyPeriod: 360}`; 사진 순서만 바뀜 → photos; 설명 공백만 → `{}`; 스키마: 상품명 공백 오류, 제조일 내일 오류. Run `pnpm test rowEdit` → FAIL.
- [ ] Step 2 (GREEN) 구현 → PASS.
- [ ] Step 3: `RowEditor`: [수정] → `listingsApi.get` 로 상세(로딩·실패 시 행 위 문구 + 다시 시도) → 행 칸이 입력칸(상품명·번호·제조사·제조일·상품상태 select·불량지원 select·보증 개월 select), 파일·긴 글 열은 버튼 → 아래 `RowEditPanels` 중 하나(설명 textarea, `PhotoUploader`, `SingleFileUploader` ×4 재사용). [저장]=`listingsApi.update(diff)`, 성공하면 그 행을 응답 값으로 갱신하고 목록 복귀; 서버 `fields` 는 칸·패널에(`PRODUCT_SHARED` 포함), 그 외는 행 위. 업로드 중·무효·바뀐 것 없음이면 [저장] 비활성. [취소]는 바로 복귀.
- [ ] Step 4: `pnpm typecheck && pnpm lint && pnpm test` → PASS. 개발 서버로 `/my/listings` 200. Commit `feat(frontend): 내 판매글 행 안 수정 — 칸은 그 자리, 파일·설명은 행 아래 폼, 한 번에 저장`.

### Task 6: 문서

**Files:** `docs/decisions.md`(10-06 헤더 메뉴·마이페이지 항목을 이 결정으로 고쳐 쓰지 않고 아래에 새 항목 + 색인 갱신, 미정 2줄), `docs/design.md`(메뉴·허브·내 판매글·행 수정·내 구매목록), 기존 스펙 `2026-10-06-mypage-design.md` 맨 위에 "일부 대체 → my-listings" 한 줄.

- [ ] Step 1: 작성 → Commit `docs: 내 판매글 검색형·행 안 수정 결정과 화면 규격`.

### Task 7 (PR #41): E2E 마지막 단계

**Files:** `chore/playwright-e2e` 에 `feat/mypage` 병합 후 `frontend/e2e/flow.spec.ts`.

- [ ] Step 1: 마지막 단계 → 메뉴 [내 판매글] → 방금 글 보임 → [수정] → 상품상태 변경 → [저장] → 행에 반영. `pnpm exec playwright test --list` 로 로드 확인(실행은 사용자 dev 서버 재시작 후 — 가입 한도).
- [ ] Step 2: Commit `test(frontend): E2E 마지막 단계를 내 판매글 행 수정으로`, 푸시.

## 마무리

PR #40 본문 갱신(무엇·왜·브라우저 체크리스트), 전체 브랜치 리뷰(별도 리뷰어, 가장 강한 모델), `/security-review`(PATCH 권한·공유 상품 보호가 권한 규칙이므로), 반영 후 보고.
