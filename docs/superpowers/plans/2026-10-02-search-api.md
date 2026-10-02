# 매물 검색 API 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 `GET /api/v1/listings`에 검색어·필터·전체 개수를 붙이고, 프론트 검색 결과의 mock을 이 API 조회로 바꿔 검색 → 상세가 실제 데이터로 이어지게 한다.

**Architecture:** 백엔드는 쿼리 파라미터를 `ListingSearchCondition`(Bean Validation)으로 받고, 리포지토리가 조건이 있을 때만 붙는 JPQL(전부 파라미터 바인딩)로 목록·개수를 조회한다. 프론트는 서버 컴포넌트 페이지가 URL만 해석하고, 새 클라이언트 컴포넌트 `SearchResults`가 `lib/api`로 조회·[더 보기]를 맡는다. `ResultList`는 그리기만.

**Tech Stack:** Spring Boot 4.1 / Java 21 / JPA(JPQL) / Redis rate limit / Testcontainers, Next.js 16 / React / Vitest.

**Spec:** `docs/superpowers/specs/2026-10-02-search-api-design.md` (화면 규칙 원본: `docs/superpowers/specs/2026-10-01-search-results-design.md`)

## Global Constraints

- worktree `C:\market\.claude\worktrees\listing-detail`, 브랜치 `feat/search-api` (`feat/listing-detail` 위). git 명령은 `:/` 경로 지정으로, `cd` 없이.
- 스키마 변경 없음, 의존성 추가 없음, 보안 설정(`SecurityConfig`) 변경 없음.
- 검증 수치: 검색어 100자, 재고 0~100,000, 가격 0~1,000,000,000, 최소 ≤ 최대(오류는 `maxPrice`), `deliveryBy` 실제 날짜. 프론트 `lib/search.ts`의 `MAX_STOCK`·`MAX_PRICE`와 같은 값.
- 페이지 20건, 정렬 `reg_date desc, user_id desc`, 커서 `regDate_userId`(기존 `encodeCursor`/`decodeCursor` 재사용).
- 비로그인 rate limit: IP 분당 60, 키 `listing:search:ip:<remoteAddr>`. 로그인 사용자는 제한 없음.
- 사용자 문구는 `frontend/src/messages/search.ts`. 프론트 검증은 `pnpm typecheck && pnpm lint && pnpm test` 셋 다.
- 커밋: 한국어 Conventional Commits, 본문에 "왜", 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **검색어에 `%`·`_`·`\`**: 글자 그대로 찾아야 한다 (`50%` 검색이 전체를 돌려주면 안 됨) — Task 1 `likeWildcardsAreLiteral`.
- **필터를 건 채 [더 보기]**: 다음 페이지가 같은 조건을 유지하고 중복·누락이 없어야 한다 — Task 1 `filteredCursorPagesHaveNoGapOrDuplicate`, Task 3 `searchApiParams` 커서 테스트.
- **파라미터 없는 기존 호출**: 계속 200 + 전체 최신순 — Task 1 `noParamsKeepsPreviousBehavior`.
- **URL을 손으로 고친 `category`**: API로 보내지 않는다(400 원인이 되지 않음) — Task 3 `searchApiParams` 테스트.
- **공백만 있는 검색어(`q="   "`)**: 조건 없음과 같다 — Task 1 `blankQueryMeansNoCondition`.

---

## File Structure

```
backend/src/main/java/com/company/market/listing/
├── dto/ListingSearchCondition.java        (새: 쿼리 파라미터 + Bean Validation)
├── dto/ListingSearchItemResponse.java     (새: 프론트 ListingSearchItem 1:1)
├── dto/ListingPageResponse.java           (수정: items 타입, total)
├── dto/ListingSummaryResponse.java        (삭제: 쓰는 곳 없어짐)
├── domain/ListingDates.java               (새: toIsoDate·warrantyUntil·tradeStatus 공용)
├── repository/ListingSearchRepository.java (새: 동적 JPQL 목록·개수)
├── service/ListingService.java            (수정: list → search)
└── controller/ListingController.java      (수정: 파라미터·rate limit)
backend/src/test/.../ListingApiTest.java   (수정)
bruno/listings/list.bru, docs/security.md, docs/data-model.md

frontend/src/
├── lib/search.ts (+ test)                 (searchApiParams 추가, filterListings·categoryOptions 삭제)
├── lib/api/listings.ts                    (search 추가)
├── lib/mock/search.ts                     (삭제)
├── components/search/SearchResults.tsx    (새)
├── components/search/ResultList.tsx       (total prop)
├── components/search/FilterBar.tsx, components/home/SearchBox.tsx (카테고리 select 제거)
├── app/search/page.tsx
└── messages/search.ts
docs/decisions.md, docs/design.md
```

---

### Task 1: 백엔드 — 검색 조건·조회·응답

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingSearchCondition.java`
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingSearchItemResponse.java`
- Create: `backend/src/main/java/com/company/market/listing/domain/ListingDates.java`
- Create: `backend/src/main/java/com/company/market/listing/repository/ListingSearchRepository.java`
- Modify: `ListingPageResponse.java`, `ListingService.java` (`list` → `search`, `toResponse`가 `ListingDates` 사용), `ListingController.java` (`list`)
- Delete: `ListingSummaryResponse.java`, `ListingService.toSummary`
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`

**Interfaces:**
- Produces:
  - `record ListingSearchCondition(String q, String field, String status, Integer minStock, Integer minPrice, Integer maxPrice, LocalDate deliveryBy, String cursor)` — `field`/`status` null이면 각각 `"all"`. (검증 어노테이션은 Task 2)
  - `record ListingSearchItemResponse(UUID userId, String regDate, String prodNo, String prodName, String prodBrand, String category, String mufcDate, String prodDescription, boolean hasDataSheet, boolean hasPhoto, String warrantyUntil, String warrantyCoverage, boolean hasReplaceProd, boolean hasTestReport, boolean hasCertificate, String prodState, Integer stockQuantity, Integer salesUnitPrice, String deliveryDate, String tradeStatus)`
  - `record ListingPageResponse(List<ListingSearchItemResponse> items, String nextCursor, long total)`
  - `ListingDates`: `static String toIsoDate(String raw)`, `static String warrantyUntil(String regDate, Integer days)`, `static String tradeStatus(String dtExpire)` (상세 작업의 private 함수를 옮김, 동작 동일)
  - `ListingSearchRepository` (`@Repository`, `EntityManager` 주입): `List<Object[]> findPage(ListingSearchCondition c, String afterRegDate, UUID afterUserId, int limit)` — 각 행 `[Listing, Product]`; `long count(ListingSearchCondition c)`
  - `ListingService.search(ListingSearchCondition c): ListingPageResponse`
  - JSON: `data.items[].*`(위 record 이름), `data.nextCursor`, `data.total`

JPQL 조립 규칙(이 부분은 시그니처가 정하지 않으므로 고정):

```
select l, p from Listing l join Product p on p.prodId = l.prodId where 1=1
  [q 낱말 i 마다]  and lower(<범위>) like :w{i} escape '\'
      범위: all  = concat(p.prodName, ' ', coalesce(p.prodNo, ''), ' ', p.prodBrand)
            name = concat(p.prodName, ' ', coalesce(p.prodNo, ''))
            brand = p.prodBrand
      :w{i} = '%' + 낱말.toLowerCase().replace("\\","\\\\").replace("%","\\%").replace("_","\\_") + '%'
  [status=available] and l.dtExpire is null   [completed] and l.dtExpire is not null
  [minStock] and l.stockQuantity >= :minStock
  [minPrice] and l.salesUnitPrice >= :minPrice   [maxPrice] and l.salesUnitPrice <= :maxPrice
  [deliveryBy] and l.deliveryDate is not null and l.deliveryDate <= :deliveryBy   (YYYY-MM-DD 문자열 비교)
  [커서] and (l.regDate < :cr or (l.regDate = :cr and l.userId < :cu))
order by l.regDate desc, l.userId desc
```

`count`는 같은 WHERE(커서 제외)로 `select count(l)`. 낱말은 `q.trim().split("\\s+")`에서 빈 것 제외.

- [ ] **Step 1: 실패 테스트 작성** — Task 1 상세 테스트의 `saveListing` 헬퍼를 넓힌 `saveSearchable(String prodId, String regDate, String name, String prodNo, String brand, int price, int stock, String deliveryDate)`(+ 필요 시 `dt_expire` jdbc 갱신)로 데이터를 만든다. 데이터 세트(기존 `lib/search.test.ts`의 `filterListings` 사례를 옮김):
  - A `"LM324AD"/"LM324AD"/"STMICROELECTRONICS"`, 320원, 재고 500, 납기 `2026-10-08`
  - B `"PowerEdge R740 2U"/"R740-4210"/"Dell"`, 3,500,000원, 재고 2, 납기 `2026-10-15`
  - C `"Catalyst 9300 48P PoE+"/"C9300-48P-E"/"Cisco"`, 1,900,000원, 재고 30, 납기 없음
  - D `"A100 80GB PCIe"/null/"NVIDIA"`, 18,500,000원, 재고 0, 거래완료

```java
noParamsKeepsPreviousBehavior        // GET /api/v1/listings → 200, items 4건 최신순, total 4
multipleWordsAllMustMatch            // q="48p catalyst" → [C]; q="catalyst R740" → []
caseInsensitive                      // q="lm324" → [A]
fieldScopes                          // field=name q=dell → []; field=brand q=dell → [B]; field=brand q=PowerEdge → []; field=all q="Dell R740" → [B]
likeWildcardsAreLiteral              // q="%" → [] ; q="_" → []
blankQueryMeansNoCondition           // q="   " → total 4
statusFilter                         // status=available → A,B,C; completed → [D]; all → 4
priceStockDelivery                   // minPrice=320&maxPrice=1900000 → A,C; minPrice=1900001 → B,D; minStock=10 → A,C; deliveryBy=2026-10-10 → [A](C 납기 없음 제외)
totalIgnoresPaging                   // 21건 만들고 첫 페이지 items 20, total 21, nextCursor not null
filteredCursorPagesHaveNoGapOrDuplicate // 같은 조건(minPrice=0)으로 2페이지 모아 regDate 25개 유일·누락 없음
```

기존 `listIsCursorPaginated`·`malformedCursorDoesNotCrash`는 그대로 통과해야 한다.

- [ ] **Step 2: 실패 확인** — Run (backend/): `./gradlew test --tests "com.company.market.listing.controller.ListingApiTest"` → 새 테스트 FAIL(`No value at JSON path "$.data.total"` 등).

- [ ] **Step 3: 구현** — 위 Interfaces와 JPQL 규칙대로. `ListingDates`로 옮긴 뒤 상세 테스트(`detailIncludesDerivedFields` 등)가 그대로 통과해야 한다. `hasDataSheet` = `listing.prodDataSheet != null || product.prodDataSheet != null`, `hasPhoto` = 매물 사진 4칸 중 하나 또는 `product.prodPhoto1` 있음.

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests "com.company.market.listing.*"` PASS.

- [ ] **Step 5: 커밋** — `feat(backend): 매물 목록 API 에 검색어·필터·전체 개수` (본문: 프론트 mock 필터와 같은 규칙, LIKE 이스케이프, 응답 한 줄을 검색 결과 형식으로 바꾼 이유 — 쓰는 곳 없음).

---

### Task 2: 백엔드 — 입력 검증·rate limit·문서

**Files:**
- Modify: `ListingSearchCondition.java` (어노테이션), `ListingService.java` (최소 ≤ 최대), `ListingController.java` (rate limit)
- Test: `ListingApiTest.java`
- Modify: `bruno/listings/list.bru`, `docs/security.md`, `docs/data-model.md`

**Interfaces:**
- Consumes: Task 1의 `ListingSearchCondition`, `ListingService.search`.
- Produces: 400 `VALIDATION` + `fields.<파라미터명>`, 비로그인 429 `RATE_LIMITED`.

- [ ] **Step 1: 실패 테스트 작성**

```java
outOfRangeParamsAre400   // minStock=100001 → fields.minStock; minPrice=-1 → fields.minPrice; maxPrice=1000000001 → fields.maxPrice;
                         // q=101자 → fields.q; field=foo → fields.field; status=foo → fields.status; deliveryBy=2026-13-01 → fields.deliveryBy
minPriceOverMaxIs400     // minPrice=10&maxPrice=5 → 400, fields.maxPrice
anonymousSearchIsRateLimited  // 쿠키 없이 60번 200, 61번째 429 RATE_LIMITED (setUp 에서 limiter.reset("listing:search:ip:127.0.0.1"))
loggedInSearchIsNotRateLimited // authCookie 로 61번 모두 200
```

- [ ] **Step 2: 실패 확인** — 같은 명령, 새 테스트 FAIL.
- [ ] **Step 3: 구현**
  - `q`: `@Size(max = 100)`. 스펙은 "앞뒤 공백 제거 후 100자"라 record compact constructor에서 `q = q == null ? null : q.trim()` — 검증은 생성된 값(공백 제거 후)에 걸린다.
  - `field`: `@Pattern(regexp = "all|name|brand")`, `status`: `@Pattern(regexp = "available|completed|all")`, `minStock`: `@Min(0) @Max(100_000)`, `minPrice`/`maxPrice`: `@Min(0) @Max(1_000_000_000)`, `deliveryBy`: `@DateTimeFormat(iso = DATE)`(형식 오류는 바인딩 오류로 400 — 테스트로 확인, 500이면 `GlobalExceptionHandler`에서 바인딩 오류를 `VALIDATION`으로).
  - 서비스: 둘 다 있고 최소 > 최대면 `ValidationException(Map.of("maxPrice", "최대 가격은 최소 가격보다 크거나 같아야 합니다."))`.
  - 컨트롤러: `@AuthenticationPrincipal AuthenticatedUser me`가 null이면 `limiter.hit("listing:search:ip:" + req.getRemoteAddr(), 60, Duration.ofMinutes(1))`.
- [ ] **Step 4: 통과 확인** — `./gradlew check` BUILD SUCCESSFUL.
- [ ] **Step 5: 문서** — `security.md` "입력 검증" 표에 검색어 100자 행. `data-model.md` 매물 절에 "검색: 상품명·상품번호·제조사 LIKE, 거래상태는 `dt_expire` 유무, 인덱스 없음(느린 게 측정되면 pg_trgm 검토)" 한 줄. `list.bru` 파라미터·응답(`total`, 새 item 필드)·429 설명.
- [ ] **Step 6: 커밋** — 코드 `feat(backend): 매물 검색 입력 검증과 비로그인 rate limit`, 문서는 같은 브랜치 `docs: 매물 검색 입력 검증·데이터 모델 기록`.

---

### Task 3: 프론트 — API 파라미터 변환과 조회 함수

**Files:**
- Modify: `frontend/src/lib/search.ts`, `frontend/src/lib/search.test.ts`
- Modify: `frontend/src/lib/api/listings.ts`

**Interfaces:**
- Consumes: `SearchQuery`(기존), `ListingSearchItem`(기존), `api()`.
- Produces:
  - `searchApiParams(query: SearchQuery, cursor?: string): string` — `URLSearchParams` 문자열(앞 `?` 없음)
  - `interface ListingSearchPage { items: ListingSearchItem[]; nextCursor: string | null; total: number }` (`types/listing.ts`)
  - `listingsApi.search(query: SearchQuery, cursor?: string): Promise<ApiResult<ListingSearchPage>>` — `GET /api/v1/listings?<searchApiParams>`, `cache: "no-store"`

- [ ] **Step 1: 실패 테스트** (`search.test.ts`에 `describe("searchApiParams")`)

```ts
it("기본 조건은 status 만") // q(): "status=available"
it("카테고리는 보내지 않는다") // q({ category: "서버" }) 결과에 "category" 없음
it("field 는 all 이면 생략, 아니면 포함") // field=brand 포함
it("필터·커서 포함, 검색어 인코딩") // q({ q: "Dell R740", minPrice: 10, deliveryBy: "2026-10-10" }), "c1"
   // → URLSearchParams 로 다시 읽어 q==="Dell R740", minPrice==="10", deliveryBy==="2026-10-10", cursor==="c1"
```

- [ ] **Step 2: 실패 확인** — `pnpm test src/lib/search.test.ts` FAIL.
- [ ] **Step 3: 구현** — `searchApiParams`, `ListingSearchPage`, `listingsApi.search`. 이 Task에서는 `filterListings`·mock을 아직 지우지 않는다(페이지가 Task 4까지 사용).
- [ ] **Step 4: 통과 확인** — `pnpm typecheck && pnpm lint && pnpm test`.
- [ ] **Step 5: 커밋** — `feat(frontend): 검색 조건을 API 파라미터로 바꾸는 함수와 검색 조회`.

---

### Task 4: 프론트 — 검색 결과를 API로, mock 삭제, 카테고리 숨김

**Files:**
- Create: `frontend/src/components/search/SearchResults.tsx`
- Modify: `frontend/src/app/search/page.tsx`, `components/search/ResultList.tsx`, `components/search/FilterBar.tsx`, `components/home/SearchBox.tsx`, `messages/search.ts`, `lib/search.ts`(+test)
- Delete: `frontend/src/lib/mock/search.ts`, `lib/search.ts`의 `filterListings`·`categoryOptions`(+ 테스트)
- Modify: `docs/decisions.md`, `docs/design.md`

**Interfaces:**
- Consumes: Task 3 `listingsApi.search`, `ListingSearchPage`.
- Produces: `SearchResults({ query }: { query: SearchQuery })`; `ResultList({ items, query, total })` (`total: number` 추가).

- [ ] **Step 1: `SearchResults`** (`"use client"`)
  - 상태: `{ kind: "loading" } | { kind: "error"; code: string } | { kind: "ready"; items; nextCursor; total }`, 첫 조회는 effect의 비동기 콜백에서만 setState(lint `set-state-in-effect`).
  - loading: 행 높이 44 스켈레톤 8줄(`animate-pulse`, `bg-line-2`). error: `code === "RATE_LIMITED"`면 `t.result.rateLimited`, 아니면 `t.result.loadFailed` + [다시 시도].
  - ready: `<ResultList items total query />` + `nextCursor`가 있으면 아래 가운데 [더 보기](outline 34, 요청 중 비활성). 실패 시 버튼 옆 `role="alert"` 한 줄(`t.result.moreFailed`), 받은 결과는 유지.
  - 페이지에서 `key={buildSearchHref(query)}`로 조건마다 다시 마운트.
- [ ] **Step 2: `ResultList`** — `total` prop을 받아 `r.count(total)`. 나머지(선택·빈 상태·표·카드)는 그대로.
- [ ] **Step 3: `page.tsx`** — `filterListings(searchListings, …)` 대신 `<SearchResults key={key} query={query} />`. `lib/mock/search.ts` 삭제, `filterListings`·`categoryOptions`와 그 테스트 삭제.
- [ ] **Step 4: 카테고리 select 제거** — `FilterBar`의 카테고리 `Field`와 `SearchBox`의 `select` 제거, 각 자리에 `{/* 카테고리 필터 보류: 카테고리 마스터 미정 (decisions.md 2026-10-02 검색 API) — 정해지면 복원 */}`. 쓰지 않게 된 import 제거. `FilterBar`의 react-hook-form 값에서 `category`는 그대로 두어 URL의 값이 '적용' 후에도 유지되게 한다.
- [ ] **Step 5: 문구** — `messages/search.ts` `result`에 `loadFailed: "불러오지 못했어요."`, `rateLimited: "잠시 후 다시 시도해 주세요."`, `retry: "다시 시도"`, `more: "더 보기"`, `moreFailed: "더 불러오지 못했어요."`.
- [ ] **Step 6: 문서** — `decisions.md`: "## 2026-10-02 매물 검색 API: 목록 API에 필터, 카테고리 필터 보류" (결정·이유·대안·재검토 조건 = 스펙 "결정"), 10-01 검색 결과 항목 끝에 "백엔드 검색: 2026-10-02 검색 API 항목" 한 줄 덧붙임, 색인 프론트 행에 "검색 결과는 API 조회 + 더 보기, 카테고리 필터 보류". `design.md`: 홈 검색창·필터 바 문단에서 카테고리 select에 "(보류: 카테고리 마스터 미정)" 표시, 검색 결과 상태 규칙(스켈레톤·오류·더 보기) 한 줄.
- [ ] **Step 7: 검증** — `pnpm typecheck && pnpm lint && pnpm test`. 수동: 백엔드 `SERVER_PORT=8081 ./gradlew bootRun`(worktree `.env`의 `APP_URL=http://localhost:3001`), 프론트 `NEXT_PUBLIC_API_URL=http://localhost:8081 pnpm dev --port 3001`. curl로 `/api/v1/listings?q=노트북&status=available` 확인, `/search?q=노트북` 페이지 200, 실제 DB 매물의 상세 링크가 200 데이터를 받는지.
- [ ] **Step 8: 커밋** — `feat(frontend): 검색 결과를 실제 API 로 — 더 보기, 카테고리 필터 보류` + `docs: 매물 검색 결정·화면 규격`.
