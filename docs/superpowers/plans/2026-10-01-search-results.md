# 검색 결과 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/search` 페이지 — 검색 구분 select가 있는 검색창, 결과 화면에만 있는 필터 바, 체크 선택 + 일괄 구매·견적(준비 중)이 있는 결과 표/카드를 mock 데이터로 만든다.

**Architecture:** URL 파라미터가 상태의 원본. 서버 컴포넌트 페이지가 `parseSearchParams` → `filterListings(mock)`로 결과를 만들고, 상호작용(필터 폼, 선택)만 client 컴포넌트. 순수 함수(`lib/search.ts`)와 zod 스키마만 Vitest로 단위 테스트, 화면은 수동 확인.

**Tech Stack:** Next.js 16 App Router (`searchParams`는 Promise), React 19, Tailwind 4 (`@md:` 컨테이너 쿼리), react-hook-form 7 + zod 4 + `@hookform/resolvers`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-search-results-design.md`

## Global Constraints

- 브랜치 `feat/search-results` (main에서 생성). 새 의존성 추가 금지.
- 사용자에게 보이는 문구는 전부 `src/messages/search.ts`. 컴포넌트에 하드코딩 금지.
- 수치: 재고 0 ~ 100,000 정수, 가격 0 ~ 1,000,000,000 정수 (`docs/security.md` "입력 검증").
- 색·간격은 `globals.css` 토큰만 (`primary`, `primary-soft`, `green`, `ink`, `ink-2`, `ink-3`, `line`, `line-2`, `bg`, `surface`, `down`). 그림자 없음. 인라인 style 금지.
- 반응형은 `@md:` (컨테이너 쿼리 — 타일 분할 안에서도 맞게). 모바일 먼저(390px).
- 가격 표시는 `formatPrice()`만. 숫자·모델명은 `.num` 클래스(mono + tabular-nums).
- 아이콘은 `components/common/Icon.tsx` 선 아이콘. 이모지 금지.
- 각 태스크 검증: `pnpm typecheck && pnpm lint && pnpm test` 셋 다 (lessons.md 2026-09-29).
- 커밋: `feat(frontend): …` / `docs: …`, 본문은 한국어로 "왜", 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. 검색어가 공백뿐(`?q=%20%20`) → 빈 검색어로 보고 전체 표시. → Task 1 테스트
2. 같은 파라미터가 여러 번(`?status=completed&status=all`, Next가 배열로 줌) → 첫 값만 사용, 터지지 않음. → Task 1 테스트
3. 필터를 바꿔 결과가 달라졌는데 이전 선택이 남아 보이지 않는 매물이 '3개 선택'으로 집계됨 → 결과 집합이 바뀌면 선택 초기화 (`ResultList`에 `key={buildSearchHref(query)}`). → Task 3 수동 확인 항목
4. 가격 칸에 `1,000`·`-5`·`1.5` 입력 → 조용히 무시하지 말고 필드 오류. → Task 2 테스트
5. `prodNo`가 null인 매물에 상품명 검색 → 오류 없이 상품명만으로 매칭. → Task 1 테스트

---

### Task 1: 검색 조건 해석·필터 순수 함수 + mock

**Files:**
- Modify: `frontend/src/types/listing.ts` (스펙 "데이터"의 `TradeStatus`, `ListingSearchItem` 그대로 추가)
- Create: `frontend/src/lib/search.ts`
- Create: `frontend/src/lib/mock/search.ts`
- Test: `frontend/src/lib/search.test.ts`

**Interfaces:**
- Produces (`lib/search.ts`):
  ```ts
  export type SearchField = "name" | "brand";
  export type StatusFilter = TradeStatus | "all";
  export interface SearchQuery {
    q: string; field: SearchField; category: string; status: StatusFilter;
    minStock?: number; minPrice?: number; maxPrice?: number; deliveryBy?: string; // YYYY-MM-DD
  }
  export type RawSearchParams = Record<string, string | string[] | undefined>;
  export function parseSearchParams(raw: RawSearchParams): SearchQuery;
  export function filterListings(items: readonly ListingSearchItem[], query: SearchQuery): ListingSearchItem[];
  /** 기본값인 파라미터는 생략. 항상 "/search" 또는 "/search?..." */
  export function buildSearchHref(query: SearchQuery): string;
  /** category·status(available 아님)·minStock·minPrice·maxPrice·deliveryBy 중 걸린 개수 */
  export function activeFilterCount(query: SearchQuery): number;
  /** q·field만 남긴 조건 (초기화) */
  export function clearFilters(query: SearchQuery): SearchQuery;
  export function listingHref(item: Pick<ListingSearchItem, "userId" | "regDate">): string; // `/listings/${userId}/${regDate}`
  ```
- Produces (`lib/mock/search.ts`): `export const searchListings: ListingSearchItem[]` — 15건. 첫 행은 `{ prodNo: "LM324AD", prodName: "LM324AD", prodBrand: "STMICROELECTRONICS", category: "기타", prodState: "양호", ... }`. 거래완료 2건, `deliveryDate: null` 2건, `prodNo: null` 1건, `hasPhoto: false`·`hasDataSheet: false` 섞기. 카테고리는 `lib/mock/home.ts`의 `categories` 값 중에서. `userId`는 uuid 형태 문자열, `regDate`는 14자리.

- [ ] **Step 1: 브랜치 생성** — `git checkout -b feat/search-results main`

- [ ] **Step 2: 실패하는 테스트 작성** (`lib/search.test.ts`, 테스트용 작은 배열을 파일 안에서 만든다 — mock에 의존하지 않음)
  - `parseSearchParams({})` → `{ q: "", field: "name", category: "", status: "available" }` (숫자·날짜 키 없음)
  - `q: "  LM324  "` → `q: "LM324"`; `q: "   "` → `q: ""`
  - `field: "brand"` → brand; `field: "x"` → name; `status: "bogus"` → available; `status: ["completed", "all"]` → completed
  - `minStock: "-1"`·`"abc"`·`"100001"` → `minStock` undefined; `"0"` → 0; `maxPrice: "1000000000"` → 1e9, `"1000000001"` → undefined
  - `deliveryBy: "2026-02-30"`·`"2026/10/01"` → undefined; `"2026-10-31"` → 그대로
  - `filterListings`: name 검색은 상품명·상품번호 부분 일치, 대소문자 무시(`"lm324"`가 `"LM324AD"` 매칭), `prodNo: null`이어도 상품명으로 매칭; brand 검색은 제조사만(상품명에만 있는 단어는 불일치)
  - status 기본(available)이면 completed 제외, `all`이면 포함; category 정확히 일치
  - `minStock: 10` → `stockQuantity >= 10`; `minPrice/maxPrice` 경계 포함; `deliveryBy: "2026-10-15"` → `deliveryDate <= "2026-10-15"`이고 `deliveryDate: null` 제외
  - `buildSearchHref(parseSearchParams({}))` → `"/search"`; 왕복: 임의 조건 `query`에 대해 `parseSearchParams(Object.fromEntries(new URLSearchParams(href.split("?")[1])))`이 `query`와 같음
  - `activeFilterCount`: 기본 0, `status: "all"` + `minPrice` → 2; `clearFilters`는 q·field 유지, 나머지 기본

- [ ] **Step 3: 실패 확인** — `pnpm test src/lib/search.test.ts` → FAIL (모듈 없음)

- [ ] **Step 4: 구현** — 위 시그니처. 날짜 유효성은 `new Date(y, m-1, d)` 재조립 비교(business.ts `startDateSchema`와 같은 방식). `buildSearchHref`는 `URLSearchParams`, 키 순서 q, field, category, status, minStock, minPrice, maxPrice, deliveryBy. mock 작성.

- [ ] **Step 5: 통과 확인** — `pnpm test src/lib/search.test.ts` → PASS, `pnpm typecheck && pnpm lint` 통과

- [ ] **Step 6: 커밋** — `feat(frontend): 검색 조건 해석·필터 함수와 검색 mock`

### Task 2: 필터 입력 검증 + 문구

**Files:**
- Create: `frontend/src/messages/search.ts`
- Create: `frontend/src/lib/validation/searchFilter.ts`
- Test: `frontend/src/lib/validation/searchFilter.test.ts`

**Interfaces:**
- Consumes: `SearchQuery`, `StatusFilter` (Task 1)
- Produces (`messages/search.ts`): `export const search = { ... }` — 키:
  - `form`: `label`("장비 검색"), `fieldLabel`("검색 구분"), `fields: { name: "상품명", brand: "제조사" }`, `placeholder`, `button`("검색")
  - `filter`: `title`("필터"), `category`, `allCategories`("전체"), `status`, `statuses: { available: "거래 가능", completed: "거래 완료", all: "전체" }`, `stock`("재고"), `stockSuffix`("개 이상"), `price`("가격"), `priceMin`, `priceMax`, `won`("원"), `delivery`("납품일"), `deliverySuffix`("까지"), `reset`("초기화"), `apply`("적용")
  - `validation`: `stock`("재고는 0개 이상 100,000개 이하의 정수로 입력하세요"), `price`("가격은 0원 이상 10억 원 이하의 정수로 입력하세요 (쉼표 없이)"), `priceOrder`("최대 가격은 최소 가격보다 크거나 같아야 해요"), `date`("올바른 날짜를 고르세요")
  - `result`: `count`(`(n: number) => \`검색결과 ${n}건\``), `selected`(`(n: number) => \` · ${n}개 선택\``), `selectAll`("전체 선택"), `selectRow`(`(name: string) => \`${name} 선택\``), `quote`("견적 요청"), `buy`("구매"), `pending`("구매·견적 요청은 준비 중이에요. 거래 방식이 정해지면 열립니다."), `dismiss`("알림 닫기"), `completedBadge`("거래완료"), `dataSheet`("데이터시트"), `photo`("사진"), `none`("없음")
  - `columns`: `prodNo`("상품번호"), `prodName`("상품명"), `brand`("제조사"), `description`("부품상세"), `dataSheet`("데이터시트"), `photo`("사진"), `state`("상태"), `quantity`("수량"), `price`("단가")
  - `empty`: `title`("조건에 맞는 매물이 없어요"), `reset`("필터 초기화"), `tryOther`("다른 검색어로 찾아보세요")
- Produces (`lib/validation/searchFilter.ts`):
  ```ts
  export const searchFilterSchema; // z.object({ category: string, status: enum, minStock: string, minPrice: string, maxPrice: string, deliveryBy: string }) — 숫자·날짜 칸은 문자열 입력("" 허용) → 출력 number|undefined / string|undefined
  export type SearchFilterInput = z.input<typeof searchFilterSchema>;
  export type SearchFilterOutput = z.output<typeof searchFilterSchema>;
  export function filterDefaults(query: SearchQuery): SearchFilterInput; // undefined → ""
  ```
  `SearchFilterOutput`의 키 이름은 `SearchQuery`의 필터 키와 같아서 `{ ...query, ...output }`로 합칠 수 있다.

- [ ] **Step 1: 실패하는 테스트 작성** (`searchFilter.test.ts`, `safeParse` 결과와 오류 문구를 `messages/search.ts` 값으로 비교)
  - 전부 빈 칸 → 성공, 숫자·날짜 키 undefined
  - `minStock: "0"`·`"100000"` 성공, `"100001"`·`"-1"`·`"1.5"` → `validation.stock`
  - `minPrice: "0"`, `maxPrice: "1000000000"` 성공; `"1000000001"`·`"1,000"`·`"-5"` → `validation.price`
  - `minPrice: "500"`, `maxPrice: "100"` → `maxPrice` 경로에 `validation.priceOrder`; 같으면 성공
  - `deliveryBy: "2026-02-30"` → `validation.date`
  - `filterDefaults(parseSearchParams({ minPrice: "100" }))` → `{ category: "", status: "available", minStock: "", minPrice: "100", maxPrice: "", deliveryBy: "" }`

- [ ] **Step 2: 실패 확인** — `pnpm test src/lib/validation/searchFilter.test.ts` → FAIL

- [ ] **Step 3: 구현** — 정수 판정은 `/^\d+$/` 후 범위 비교. 날짜는 Task 1의 날짜 판정을 `lib/search.ts`에서 `export function isValidDate(s: string): boolean`로 꺼내 재사용. 맨 위 주석: 수치는 `docs/security.md` "입력 검증"이 원본.

- [ ] **Step 4: 통과 확인** — `pnpm test && pnpm typecheck && pnpm lint`

- [ ] **Step 5: 커밋** — `feat(frontend): 검색 필터 입력 검증과 문구`

### Task 3: `/search` 페이지 — 검색창·결과 표/카드·선택

**Files:**
- Modify: `frontend/src/components/common/Icon.tsx` (`file`: 문서 아이콘, `image`: 사진 아이콘, `filter`: 깔때기 아이콘 — 24 viewBox 선 경로)
- Create: `frontend/src/app/search/page.tsx`
- Create: `frontend/src/components/search/SearchForm.tsx`
- Create: `frontend/src/components/search/ResultList.tsx`

**Interfaces:**
- Consumes: Task 1 전부, `search` 문구(Task 2), `formatPrice`, `MobileTabBar`, `Checkbox`(`components/ui/checkbox`)
- Produces:
  - `export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> })`
  - `export function SearchForm({ query }: { query: SearchQuery })` — 서버 컴포넌트, `<form action="/search">`. 보이는 칸: `field` select, `q` input. 현재 필터 값은 `<input type="hidden">`으로 실어서 재검색해도 유지 (값이 없는 키는 안 실음).
  - `export function ResultList({ items, query }: { items: ListingSearchItem[]; query: SearchQuery })` — `"use client"`. 선택 `Set<string>`(키 `${userId}/${regDate}`).
  - 페이지 배치: `<main className="flex-1 min-h-0 overflow-y-auto">` 안에 최대 폭 1200 칸 → `SearchForm` → (Task 4의 `FilterBar` 자리) → `<ResultList key={buildSearchHref(query)} …/>`. 아래 `<MobileTabBar active="" />`.

- [ ] **Step 1: Icon 3개 추가**, `SearchForm` 작성 — 스펙 "화면 > 데스크톱 1"·"모바일" 규격 (높이 44, `@md:` 48, select 폭 72 / `@md:` 112).

- [ ] **Step 2: `ResultList` 작성** — 스펙 "결과 머리줄"·"결과 표"·"모바일"·"행 동작"·"빈 상태" 규격.
  - 데스크톱 `<table>`은 `hidden @md:table`, 모바일 카드 `<ul>`은 `@md:hidden`.
  - 행 클릭: `onClick`으로 `router.push(listingHref(item))`, 단 체크박스 칸 클릭은 `stopPropagation`. 상품명은 `<Link href={listingHref(item)}>`.
  - 체크박스 `aria-label={search.result.selectRow(item.prodName)}`, 헤더 체크박스는 전체/일부 선택(`checked="indeterminate"`).
  - 구매·견적 클릭 → 안내 한 줄(`role="status"`, 닫기 ×). 같은 문구 재낭독은 `QuickMenu`의 `seq` key 방식 그대로.
  - 모바일 고정 바: 선택 1개 이상일 때 `fixed` 하단, 탭바(높이 60) 위.
  - 빈 상태의 [필터 초기화]는 `buildSearchHref(clearFilters(query))` 링크, 필터가 0개면 `empty.tryOther` 문구.
  - 데이터시트·사진: 있으면 `<Icon name="file" | "image" aria-label=… role="img">`, 없으면 `–` + `sr-only` `result.none`.

- [ ] **Step 3: 페이지 조립** — `page.tsx`는 얇게: `await searchParams` → `parseSearchParams` → `filterListings(searchListings, query)`.

- [ ] **Step 4: 검증** — `pnpm typecheck && pnpm lint && pnpm test` 통과. `pnpm dev` 후 확인:
  - 홈에서 "LM324" 검색 → `/search?q=LM324&category=` → 검색창에 LM324, 결과에 LM324AD
  - 390px: 카드 목록, 체크 시 하단 고정 바, 탭바와 안 겹침
  - 1280px: 표 10열이 한 줄, 부품상세 말줄임
  - 행 클릭 → `/listings/...` 이동, 체크박스 클릭은 이동 안 함
  - `?q=없는모델` → 빈 상태
  - (Review Focus 3) 2개 체크 후 다른 검색어로 검색 → 선택 0개

- [ ] **Step 5: 커밋** — `feat(frontend): 검색 결과 화면 — 검색창, 결과 표·카드, 일괄 선택`

### Task 4: 필터 바

**Files:**
- Create: `frontend/src/components/search/FilterBar.tsx`
- Modify: `frontend/src/app/search/page.tsx` (`SearchForm` 아래에 `<FilterBar key={buildSearchHref(query)} query={query} />`)

**Interfaces:**
- Consumes: `searchFilterSchema`, `filterDefaults`, `SearchFilterInput/Output` (Task 2), `buildSearchHref`, `clearFilters`, `activeFilterCount` (Task 1), `categories` (`lib/mock/home.ts`)
- Produces: `export function FilterBar({ query }: { query: SearchQuery })` — `"use client"`

- [ ] **Step 1: 작성** — 스펙 "필터 바"·"모바일" 규격.
  - `useForm<SearchFilterInput, unknown, SearchFilterOutput>({ resolver: zodResolver(searchFilterSchema), mode: "onBlur", reValidateMode: "onChange", defaultValues: filterDefaults(query) })` (LoginForm과 같은 방식).
  - 제출: `router.push(buildSearchHref({ ...query, ...output }))`. '적용'은 오류가 있으면 비활성.
  - '초기화': `router.push(buildSearchHref(clearFilters(query)))`.
  - 거래상태 3칸 토글은 `role="radiogroup"` + 라디오 input (선택 칸 `primary-soft` 배경, `primary-dark` 글자).
  - 숫자 칸은 `inputMode="numeric"`, 날짜는 `type="date"`. 오류 문구는 칸 아래 12px `down`, 칸에 `aria-invalid`·`aria-describedby`.
  - 모바일: [필터] 버튼(`aria-expanded`, `activeFilterCount > 0`이면 개수 표시)로 펼침/접기, `@md:` 이상은 항상 펼침.
  - `key`로 URL이 바뀌면 폼이 새 기본값으로 다시 그려진다 (뒤로가기 시 칸 값이 URL과 어긋나지 않게).

- [ ] **Step 2: 검증** — `pnpm typecheck && pnpm lint && pnpm test` 통과. `pnpm dev`:
  - 가격 500~100 입력 후 blur → 최대 가격 아래 오류, '적용' 비활성 → 고치면 즉시 사라짐
  - `1,000` 입력 → 가격 오류
  - 거래 완료 선택 후 적용 → 거래완료 2건만, 흐린 글자 + 뱃지
  - 재고·가격·납품일 적용 → URL 반영, 결과 줄어듦, 뒤로가기 시 칸 값·결과 함께 복원
  - 초기화 → 검색어만 남음
  - 390px: [필터 (n)] 펼침/접기

- [ ] **Step 3: 커밋** — `feat(frontend): 검색 결과 필터 바 — 카테고리·거래상태·재고·가격·납품일`

### Task 5: 문서

**Files:**
- Modify: `docs/design.md` — "컴포넌트 규격"에 **검색 결과 화면** 항목 추가 (스펙 "화면" 요약: 검색창 48/44, 필터 바, 결과 표 행 44·열 목록, 모바일 카드·고정 바, 페이지 스크롤 허용 예외). "원칙"의 홈 스크롤 없음 줄은 그대로.
- Modify: `docs/decisions.md` — 새 항목 `## 2026-10-01 거래상태는 API의 tradeStatus, 지금은 dt_expire로 판단` (결정·이유·대안: 거래정보 테이블/상태 컬럼·재검토 조건: 견적 흐름이 정해져 중간 상태가 필요할 때). 색인 표 '프론트' 행에 "검색 결과는 URL 파라미터가 상태, 필터는 결과 화면에만" 추가.

- [ ] **Step 1: 수정** (한글 파일이므로 필요한 줄만 국소 편집)
- [ ] **Step 2: 커밋** — `docs: 검색 결과 화면 규격, 거래상태 판단 결정`

### 마무리

- [ ] `pnpm typecheck && pnpm lint && pnpm test` 최종 통과
- [ ] 푸시 + PR (본문: 무엇을·왜·확인 방법, 백엔드 검색 API·상세 화면은 다음 작업). `/code-review` 실행 후 반영.
