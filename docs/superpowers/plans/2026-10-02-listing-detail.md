# 매물 상세 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/listings/{userId}/{regDate}`에 매물 하나의 전체 정보(정보 표·제품 개요·데이터시트 PDF·서류·사진)를 보여주고, 판매자는 자기 매물을 삭제할 수 있게 한다.

**Architecture:** 백엔드는 기존 상세 조회 응답(`ListingResponse`)에 6개 필드만 더한다(스키마 변경 없음). 프론트는 클라이언트 컴포넌트가 `lib/api/client.ts`로 매물과 `me()`를 동시에 조회하고, 데이터시트·서류는 blob으로 받아 iframe·새 탭에 띄운다. 표시 규칙(행 목록·대체값·날짜·경로 검사)은 순수 함수(`lib/listingDetail.ts`)로 빼서 Vitest로 고정한다.

**Tech Stack:** Spring Boot 4.1 / Java 21 / Testcontainers, Next.js 16 App Router / React / Tailwind / Vitest(node 환경, 컴포넌트 렌더 테스트 없음).

**Spec:** `docs/superpowers/specs/2026-10-02-listing-detail-design.md`

## Global Constraints

- 작업 위치는 worktree `C:\market\.claude\worktrees\listing-detail`, 브랜치 `feat/listing-detail`. `C:\market`(다른 세션의 `feat/file-upload`)은 건드리지 않는다.
- 스키마 변경 없음, 의존성 추가 없음, 새 API 없음.
- 응답 필드는 추가만 한다. 기존 필드 이름·값을 바꾸지 않는다(직전 버전 호환).
- 판매자 이름·연락처·이메일을 응답·화면에 넣지 않는다.
- 사용자에게 보이는 문구는 전부 `frontend/src/messages/listing.ts`. 컴포넌트에 한글 하드코딩 금지.
- 디자인 토큰은 `docs/design.md`: 카드 흰 배경(`bg-surface`) + 1px `line` + radius 6, 값 없음 `–`(`ink-3`), 버튼 34(`h-8.5`), 거래완료 뱃지 `line-2`/`ink-2`.
- 프론트 검증은 항상 `pnpm typecheck && pnpm lint && pnpm test` 셋 다 (lessons.md 2026-09-29).
- 커밋 메시지 한국어 Conventional Commits, 본문에 "왜", 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 수동 확인 시 포트는 백엔드 8081, 프론트 3001 (다른 세션과 겹치지 않게).

## Review Focus

- **`dt_expire`가 있는 매물(거래완료)**: 구매자 버튼 둘 다 비활성 + 제목 옆 '거래완료' 뱃지 — Task 1이 `tradeStatus`를, Task 2가 `buyerActionsDisabled`를 테스트로 고정.
- **`userId` 대소문자 차이**: `me().id`와 경로 `userId`가 대소문자만 다르면 같은 사람 — Task 2 `isOwner` 테스트.
- **경로가 깨진 URL(`/listings/abc/123`)**: API 호출 없이 "찾을 수 없음" — Task 2 `isValidListingPath` 테스트, 백엔드도 500이 아니어야 함 — Task 1 테스트.
- **access 토큰 만료 상태에서 PDF 열기**: 401 → refresh → 재시도로 blob을 받는다 — Task 3 `fetchFile` 테스트.
- **파일 응답이 JSON 오류 본문일 때**(401·404): blob으로 iframe에 넣지 않고 실패 결과 — Task 3 `fetchFile` 실패 테스트.

---

## File Structure

```
backend/src/main/java/com/company/market/listing/
├── dto/ListingResponse.java              (수정: 필드 6개 추가)
└── service/ListingService.java           (수정: toResponse + 날짜 변환 private static 2개)
backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java (수정: 테스트 추가)
bruno/listings/get.bru                    (수정: docs)

frontend/src/
├── types/listing.ts                      (수정: ListingDetail)
├── messages/listing.ts                   (수정: detail 문구)
├── lib/listingDetail.ts (+ .test.ts)     (새: 순수 함수)
├── lib/files.ts                          (새: filePath·fileUrl)
├── lib/api/client.ts (+ client.test.ts)  (수정: fetchFile)
├── lib/api/listings.ts                   (새: getListing·deleteListing)
├── app/listings/[userId]/[regDate]/page.tsx (새)
└── components/listing/
    ├── ListingDetailView.tsx             (조회·상태 분기·카드 배치)
    ├── ListingSummaryCard.tsx            (카드 ①)
    ├── ListingActions.tsx                (구매자·판매자 버튼, 삭제)
    ├── DataSheetCard.tsx                 (카드 ②)
    └── PhotosCard.tsx                    (카드 ③)
docs/design.md, docs/decisions.md         (수정)
```

---

### Task 1: 백엔드 — 상세 응답에 필드 6개 추가

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/dto/ListingResponse.java`
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` (`toResponse`)
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`
- Modify: `bruno/listings/get.bru` (docs 블록)

**Interfaces:**
- Produces (JSON, `data` 안): `category: string`, `mufcDate: string|null`, `productDataSheet: string|null`, `productPhoto: string|null`, `tradeStatus: "available"|"completed"`, `warrantyUntil: string|null`. 기존 필드는 그대로.

새 테스트는 등록 API를 거치지 않고 `productRepository`·`listingRepository`로 직접 행을 만든다 — `feat/file-upload`가 등록 API에 업로드 키 검사를 넣으므로 rebase 후에도 깨지지 않게. `Listing` 빌더엔 `dtExpire`가 없어서 거래완료는 `jdbc.update("update listings set dt_expire = ? where ...")`로 만든다. 헬퍼 `UUID`/`regDate`는 `setUp`의 `userId` 사용.

- [ ] **Step 1: 실패 테스트 작성** — `ListingApiTest`에 private 헬퍼 `void saveListing(String prodId, String regDate, String mufcDate, Integer warrantyPeriod)`(상품 `categoryCode "ELEC0001"`, `prodDataSheet "p-sheet.pdf"`, `prodPhoto1 "p-photo.jpg"`, 매물 사진 없음)와 테스트:

```java
@Test @DisplayName("상세 응답에 카테고리·제조일·상품 데이터시트·상품 사진·거래상태·보증기한이 담긴다")
void detailIncludesDerivedFields() // regDate "20261001091500", mufc "20240122", warranty 30
  // GET (쿠키 없이) → 200
  // $.data.category == "ELEC0001", $.data.mufcDate == "2024-01-22"
  // $.data.productDataSheet == "p-sheet.pdf", $.data.productPhoto == "p-photo.jpg"
  // $.data.tradeStatus == "available", $.data.warrantyUntil == "2026-10-31"

@Test @DisplayName("거래완료일시가 있으면 tradeStatus 는 completed")
void tradeStatusCompletedWhenExpired() // dt_expire = "20261002100000" → "completed"

@Test @DisplayName("제조일은 14자리도 날짜로, 그 외 형식은 원문 그대로, 없으면 null")
void mufcDateFormats()
  // "20240122093000" → "2024-01-22"; "2024년 1월" → "2024년 1월"; null → jsonPath doesNotExist() 또는 isEmpty()

@Test @DisplayName("보증기간이 없으면 warrantyUntil 은 null, 0일이면 등록일")
void warrantyUntilEdges() // null → null; 0 → "2026-10-01"

@Test @DisplayName("UUID 가 아닌 경로는 500 이 아니다")
void malformedUserIdIsNot500() // GET /api/v1/listings/abc/20261001091500 → status().is4xxClientError()
```

null 필드 직렬화는 기존 응답과 같은 Jackson 설정을 따른다 — 먼저 기존 응답에서 null이 `null`로 나가는지 빠지는지 확인하고 단언을 거기에 맞춘다.

- [ ] **Step 2: 실패 확인**

Run (backend/): `./gradlew test --tests "com.company.market.listing.controller.ListingApiTest"`
Expected: 새 테스트 4개 FAIL (`No value at JSON path "$.data.category"` 등). `malformedUserIdIsNot500`은 이미 통과할 수 있다 — 통과하면 그대로 두고, 500이면 Step 3에서 `GlobalExceptionHandler`에 `MethodArgumentTypeMismatchException` → 400 `VALIDATION` 처리를 추가한다.

- [ ] **Step 3: 구현**
  - `ListingResponse` 끝에 `String category, String mufcDate, String productDataSheet, String productPhoto, String tradeStatus, String warrantyUntil` 추가 (끝에 붙여 기존 순서 유지).
  - `ListingService`에 `private static String toIsoDate(String raw)`: `raw`가 `\d{8}` 또는 `\d{14}`이면 앞 8자리를 `yyyy-MM-dd`로, null이면 null, 그 외 원문. 주석으로 "등록 API가 제조일 형식을 검사하지 않아 원문을 버리지 않는다".
  - `private static String warrantyUntil(String regDate, Integer days)`: days null이면 null, 아니면 `regDate` 앞 8자리 날짜 + days일 → `ISO_LOCAL_DATE`.
  - `toResponse`가 `product.getCategoryCode()`, `toIsoDate(product.getProdMufcDate())`, `product.getProdDataSheet()`, `product.getProdPhoto1()`, `listing.getDtExpire() == null ? "available" : "completed"`, `warrantyUntil(listing.getRegDate(), listing.getWarrantyPeriod())`를 넘긴다.

- [ ] **Step 4: 통과 확인**

Run: `./gradlew test --tests "com.company.market.listing.*"` → PASS. 이어서 `./gradlew check` → BUILD SUCCESSFUL.

- [ ] **Step 5: Bruno docs 갱신** — `get.bru` docs에 새 필드 6개 한 줄씩(값 규칙 포함) 추가.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/company/market/listing backend/src/test/java/com/company/market/listing bruno/listings/get.bru
git commit  # feat(backend): 매물 상세 응답에 카테고리·제조일·거래상태·보증기한 추가 — 본문: 상세 화면이 쓰는 값, tradeStatus 는 10-01 결정과 같은 기준
```

---

### Task 2: 프론트 — 상세 타입·문구·표시 규칙 순수 함수

**Files:**
- Modify: `frontend/src/types/listing.ts`
- Modify: `frontend/src/messages/listing.ts`
- Create: `frontend/src/lib/listingDetail.ts`
- Test: `frontend/src/lib/listingDetail.test.ts`

**Interfaces:**
- Consumes: Task 1의 JSON 모양.
- Produces:
  - `interface ListingDetail` — 필드: `userId, regDate, prodId, prodName, prodBrand: string; prodNo, prodSpecInfo: string|null; tradeType, prodState: string; salesUnitPrice, salesQuantity, minOrderQuantity, orderUnit: number; deliveryDate: string|null; stockQuantity: number|null; description, listingDataSheet: string|null; photos: string[]; warrantyPeriod: number|null; warrantyCoverage, replaceProd, testReport, certificateOfAuthen, dtUpdate, dtExpire: string|null; category: string; mufcDate, productDataSheet, productPhoto: string|null; tradeStatus: TradeStatus; warrantyUntil: string|null`
  - `isValidListingPath(userId: string, regDate: string): boolean`
  - `formatRegDate(regDate: string): string`
  - `mainPhoto(d: ListingDetail): string | null`
  - `dataSheetKey(d: ListingDetail): string | null`
  - `isOwner(meId: string | null, userId: string): boolean`
  - `buyerActionsDisabled(d: ListingDetail): boolean`
  - `interface InfoRow { label: string; value: string; mono?: boolean }`, `infoRows(d: ListingDetail): InfoRow[]`
  - `listing.detail` 문구 객체 (아래 Step 3)

- [ ] **Step 1: 실패 테스트 작성** (`listingDetail.test.ts`, 기준 객체 `base: ListingDetail` 하나를 만들고 spread로 변형)

```ts
it("isValidListingPath: UUID(대소문자 무관) + 14자리 숫자만 통과")
  // ("3f2b6c1e-8a4d-4f7b-9c21-5d0e7a9b1c11","20261001091500") true
  // ("3F2B6C1E-8A4D-4F7B-9C21-5D0E7A9B1C11","20261001091500") true
  // ("abc","20261001091500") false; (uuid,"2026100109") false; (uuid,"2026100109150a") false
it("formatRegDate: yyyyMMddHHmmss → YYYY-MM-DD HH:mm") // "20261001091500" → "2026-10-01 09:15"
it("mainPhoto: 매물 사진 첫 장, 없으면 상품 사진, 둘 다 없으면 null")
it("dataSheetKey: 매물 데이터시트, 없으면 상품 데이터시트, 둘 다 없으면 null")
it("isOwner: 대소문자 무시 비교, meId null 이면 false")
it("buyerActionsDisabled: tradeStatus completed 면 true")
it("infoRows: 순서·라벨이 스펙대로이고 빈 값은 – ")
  // labels 순서 == [제조사, 상품코드, 리드 타임, 상태, 단가, 수량, 카테고리, 거래종류, 제조일,
  //                 최소주문수량, 주문단위, 등록수량, 보증기한, 불량지원, 등록일]
  // 단가 320 → "320원", 단가 3500000 → "3,500,000원", 수량 1200 → "1,200"
  // deliveryDate null → "–", 상품코드 행 mono true, 등록일 → formatRegDate 값
```

- [ ] **Step 2: 실패 확인** — Run (frontend/): `pnpm test src/lib/listingDetail.test.ts` → FAIL (모듈 없음).

- [ ] **Step 3: 구현**
  - `types/listing.ts`에 `ListingDetail` (위 Interfaces 그대로, 주석: "백엔드 ListingResponse 와 1:1").
  - `messages/listing.ts`에 `detail` 추가 — 정확한 문구:
    - 행 라벨: `brand "제조사"`, `prodId "상품코드"`, `leadTime "리드 타임"`, `state "상태"`, `unitPrice "단가"`, `stock "수량"`, `category "카테고리"`, `tradeType "거래종류"`, `mufcDate "제조일"`, `minOrder "최소주문수량"`, `orderUnit "주문단위"`, `salesQuantity "등록수량"`, `warranty "보증기한"`, `coverage "불량지원"`, `regDate "등록일"`
    - `won: (n: string) => \`${n}원\``, `empty "–"`, `completedBadge "거래완료"`
    - `overview "제품 개요"`, `noDescription "등록된 설명이 없습니다."`
    - `dataSheet "데이터시트"`, `noDataSheet "등록된 데이터시트가 없습니다."`, `loginToView "로그인 후 열람할 수 있습니다."`, `login "로그인"`, `fileLoadFailed "파일을 불러오지 못했어요."`, `retry "다시 시도"`
    - `docs: { testReport "테스트리포트", certificate "정품인증서", replaceProd "대체품" }`
    - `photos "사진"`, `noPhotos "등록된 사진이 없습니다."`, `openOriginal: (n: number) => \`사진 ${n} 원본 보기\``
    - `quote "견적 요청"`, `buy "구매"`, `edit "수정"`, `remove "삭제"`, `pendingTrade "구매·견적 요청은 준비 중이에요. 거래 방식이 정해지면 열립니다."`, `pendingEdit "매물 수정은 준비 중이에요."`, `dismiss "알림 닫기"`, `confirmDelete "이 매물을 삭제할까요? 되돌릴 수 없습니다."`
    - `notFound "매물을 찾을 수 없습니다."`, `toSearch "검색으로 가기"`, `loadFailed "불러오지 못했어요."`
    - `errors`에 `FORBIDDEN: "내 매물만 삭제할 수 있습니다."` 추가.
  - `lib/listingDetail.ts`: 위 시그니처. 숫자 포맷은 `Intl.NumberFormat("ko-KR")`. 라벨은 `listing.detail`에서.

- [ ] **Step 4: 통과 확인** — `pnpm test src/lib/listingDetail.test.ts` PASS, 이어서 `pnpm typecheck && pnpm lint && pnpm test` 전부 통과.

- [ ] **Step 5: 커밋** — `feat(frontend): 매물 상세 타입·문구·표시 규칙` (본문: 정보 표 순서는 사용자 이미지 행 먼저, 나머지 컬럼 뒤 — 스펙 "이미지 항목 ↔ 컬럼").

---

### Task 3: 프론트 — 파일 blob 조회와 매물 API 함수

**Files:**
- Modify: `frontend/src/lib/api/client.ts`
- Test: `frontend/src/lib/api/client.test.ts`
- Create: `frontend/src/lib/files.ts`
- Create: `frontend/src/lib/api/listings.ts`

**Interfaces:**
- Consumes: `ListingDetail` (Task 2), 기존 `api<T>()`, `ApiResult<T>`.
- Produces:
  - `fetchFile(path: string): Promise<ApiResult<Blob>>` (client.ts)
  - `filePath(key: string): string` → `"/api/v1/files/" + key` (슬래시 인코딩 안 함 — 키에 폴더 구분 `/`가 들어 있음), `fileUrl(key: string): string` → `BASE + filePath(key)`. `BASE`는 client.ts와 같은 `NEXT_PUBLIC_API_URL ?? "http://localhost:8080"` — client.ts에서 `export const API_BASE`로 꺼내 공유한다.
  - `listingsApi.get(userId: string, regDate: string): Promise<ApiResult<ListingDetail>>` (`cache: "no-store"`), `listingsApi.remove(userId: string, regDate: string): Promise<ApiResult<null>>` (`method: "DELETE"`)

- [ ] **Step 1: 실패 테스트 작성** (`client.test.ts`에 `describe("fetchFile()")`. 기존 `mockFetch`는 JSON만 만드므로 바이너리 응답용 `{ status: 200, raw: "PDFDATA", type: "application/pdf" }` 형태를 받도록 헬퍼를 넓힌다)

```ts
it("200 이면 본문을 Blob 으로 돌려준다") // result.ok, await result.data.text() === "PDFDATA", data.type === "application/pdf"
it("401 → refresh 성공 → 다시 받아 Blob") // calls == ["/api/v1/files/k", "/api/v1/auth/refresh", "/api/v1/files/k"]
it("404 JSON 오류 본문이면 그 실패 결과를 돌려준다") // { ok:false, code:"NOT_FOUND", ... } 그대로
it("네트워크 오류면 UNREACHABLE")
```

- [ ] **Step 2: 실패 확인** — `pnpm test src/lib/api/client.test.ts` → FAIL (`fetchFile` 없음).

- [ ] **Step 3: 구현** — `send`에 응답 해석 함수를 인자로 받게 최소로 나눈다(`read: (res: Response) => Promise<ApiResult<T>> = parse`). `api()`의 401→refresh→재시도 흐름을 내부 함수 하나로 묶어 `api()`와 `fetchFile()`이 공유. `fetchFile`의 해석: `res.ok`면 `{ ok: true, data: await res.blob() }`, 아니면 기존 `parse(res)`. 기존 `api()` 테스트가 그대로 통과해야 한다.

- [ ] **Step 4: 통과 확인** — `pnpm typecheck && pnpm lint && pnpm test` 전부 통과 (기존 client 테스트 포함).

- [ ] **Step 5: 커밋** — `feat(frontend): 파일 blob 조회와 매물 조회·삭제 API 함수` (본문: PDF를 API 주소로 iframe에 넣으면 X-Frame-Options DENY와 토큰 만료 refresh 불가 — blob으로 받아 api()와 같은 refresh를 탄다).

---

### Task 4: 프론트 — 상세 페이지·카드 ①·버튼·상태

**Files:**
- Create: `frontend/src/app/listings/[userId]/[regDate]/page.tsx`
- Create: `frontend/src/components/listing/ListingDetailView.tsx`
- Create: `frontend/src/components/listing/ListingSummaryCard.tsx`
- Create: `frontend/src/components/listing/ListingActions.tsx`
- Modify: `docs/decisions.md` (항목 + 색인)

**Interfaces:**
- Consumes: Task 2 함수·문구, Task 3 `listingsApi`, `fileUrl`, 기존 `authApi.me()`, `Icon`, `MobileTabBar`.
- Produces:
  - `ListingDetailView({ userId, regDate }: { userId: string; regDate: string })`
  - `ListingSummaryCard({ detail, owner }: { detail: ListingDetail; owner: boolean })`
  - `ListingActions({ detail, owner }: { detail: ListingDetail; owner: boolean })`
  - Task 5가 `ListingDetailView` 안의 두 자리(`DataSheetCard`, `PhotosCard`)를 채운다: `<DataSheetCard detail={detail} loggedIn={loggedIn} />`, `<PhotosCard photos={detail.photos} />`.

- [ ] **Step 1: 페이지** — `page.tsx`는 서버 컴포넌트로 `params: Promise<{ userId: string; regDate: string }>`를 await해 `ListingDetailView`에 넘긴다. 바깥 구조는 `app/search/page.tsx`와 같다(`<main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">` + 안쪽 `max-w-300 mx-auto flex flex-col gap-3 @md:gap-4` + `<MobileTabBar active="" />`).

- [ ] **Step 2: `ListingDetailView`** (`"use client"`)
  - `isValidListingPath`가 false면 바로 notFound 화면(요청 없음).
  - 그 외 `Promise.all([listingsApi.get, authApi.me])`. 상태: `loading | notFound | error | ready`. `LISTING_NOT_FOUND`면 notFound, 그 외 실패는 error. `me` 실패는 `loggedIn=false, meId=null`(구매자 화면).
  - loading: 카드 3개 크기 스켈레톤(`animate-pulse`, `bg-line-2` 블록). notFound: `notFound` + `/search` 링크(`toSearch`). error: `loadFailed` + [다시 시도] 버튼(같은 조회 재실행).
  - ready: `ListingSummaryCard` → (Task 5 자리) → (Task 5 자리). Task 5 전까지는 두 자리를 비워 둔다.
  - effect 안 동기 setState는 lint(`react-hooks/set-state-in-effect`)에 걸린다 — 조회 시작 시 상태 초기화는 이벤트 핸들러(다시 시도)나 비동기 콜백 안에서 한다.

- [ ] **Step 3: `ListingSummaryCard`** — 스펙 "카드 ①" 그대로: 제목줄(상품명 22/700 + 상품번호 mono `ink-2` + 거래완료 뱃지), `prodSpecInfo` 13 `ink-2`, 왼쪽 사진(`mainPhoto` → `<img src={fileUrl(key)} className="object-contain">`, 없으면 `Icon name="image"` 자리), 오른쪽 `infoRows` 표(라벨 `ink-2`, 값 없으면 `ink-3`), 그 아래 `ListingActions`, 카드 아래쪽 제품 개요(`whitespace-pre-line`, 없으면 `noDescription`). `@md` 미만은 사진·표 세로 쌓기(`flex-col @md:flex-row`).
  - `<img>` 사용은 Next lint `@next/next/no-img-element` 경고가 날 수 있다 — API 서버 이미지라 `next/image` 원격 설정이 필요해지므로 `<img>`를 쓰고 해당 줄에 이유 주석과 함께 lint 예외를 단다.

- [ ] **Step 4: `ListingActions`**
  - 남의 매물: [견적 요청](outline `primary`) [구매](`primary`), `buyerActionsDisabled`면 `disabled`. 누르면 위에 `pendingTrade` 안내(검색 결과 `ResultList`의 notice 마크업과 같은 모양, 닫기 ×).
  - 내 매물(`owner`): [수정](outline, `pendingEdit` 안내) [삭제]. 삭제: `window.confirm(confirmDelete)` → `listingsApi.remove` → 성공 시 `router.push("/search")`. 실패 시 버튼 옆 `role="alert"` 한 줄: `listing.errors[code] ?? message`. 요청 중엔 삭제 버튼 비활성.

- [ ] **Step 5: decisions.md** — "## 2026-10-02 매물 상세: 클라이언트 조회, PDF는 blob iframe" 항목(결정·이유·대안·재검토 조건 = 스펙 "결정" 두 줄 요약, 5줄 이내). 색인 "프론트" 행 끝에 "매물 상세는 클라이언트 조회·PDF blob (10-02 매물 상세)" 덧붙임.

- [ ] **Step 6: 검증** — `pnpm typecheck && pnpm lint && pnpm test` 통과. `pnpm dev --port 3001`(백엔드는 `SERVER_PORT=8081 APP_URL=http://localhost:3001 ./gradlew bootRun` — `APP_URL`이 CORS·Origin 검사의 유일한 허용 출처라 3001로 맞춰야 함, 프론트 `NEXT_PUBLIC_API_URL=http://localhost:8081`)로 Bruno로 만든 매물 상세를 열어 카드 ①, 거래완료 매물(`dt_expire` 수동 설정)의 비활성 버튼, `/listings/abc/1` notFound, 내 매물 삭제 → `/search` 이동을 확인. 사진은 `feat/file-upload` 머지 전이라 깨진 이미지가 정상.

- [ ] **Step 7: 커밋** — 코드 커밋 `feat(frontend): 매물 상세 화면 — 정보 표·버튼·상태`, decisions.md는 같은 브랜치의 별도 커밋 `docs: 매물 상세 결정 기록`.

---

### Task 5: 프론트 — 카드 ② 데이터시트·서류, 카드 ③ 사진

**Files:**
- Create: `frontend/src/components/listing/DataSheetCard.tsx`
- Create: `frontend/src/components/listing/PhotosCard.tsx`
- Modify: `frontend/src/components/listing/ListingDetailView.tsx` (두 자리 채우기)
- Modify: `docs/design.md` (컴포넌트 규격 "매물 상세")

**Interfaces:**
- Consumes: `dataSheetKey`, `fetchFile`, `filePath`, `fileUrl`, `listing.detail` 문구, `ListingDetail`.
- Produces: `DataSheetCard({ detail, loggedIn }: { detail: ListingDetail; loggedIn: boolean })`, `PhotosCard({ photos }: { photos: string[] })`.

- [ ] **Step 1: `DataSheetCard`**
  - 비로그인: `loginToView` + `<Link href={"/login?next=" + encodeURIComponent(현재 경로)}>`(`login`). 뷰어·서류 링크 숨김.
  - 로그인 + `dataSheetKey` 있음: `fetchFile(filePath(key))` → `URL.createObjectURL` → `<iframe title={dataSheet} src={blobUrl} className="w-full h-120 @md:h-160">`. 언마운트·키 변경 시 `URL.revokeObjectURL`. 실패: 카드 안 `fileLoadFailed` + [다시 시도]; 실패 코드가 `UNAUTHENTICATED`·`SESSION_EXPIRED`·`UNAUTHORIZED`면 비로그인 화면으로.
  - 로그인 + 키 없음: `noDataSheet`.
  - 서류 링크 3개(`testReport`, `certificateOfAuthen`, `replaceProd` 순, 라벨 `docs.*`): 값 없으면 라벨 옆 `–`. 클릭 시 `const w = window.open("", "_blank")`를 **await 전에** 호출, `fetchFile` 성공하면 `w.location.href = URL.createObjectURL(blob)`, 실패하면 `w.close()` + 링크 옆 `fileLoadFailed`. 새 탭 blob URL은 탭이 쓰므로 바로 revoke하지 않는다(60초 뒤 revoke).

- [ ] **Step 2: `PhotosCard`** — 제목 `photos`. 사진 없으면 `noPhotos`. 있으면 `grid grid-cols-2 @md:grid-cols-4 gap-2`, 각 `<a href={fileUrl(key)} target="_blank" rel="noopener noreferrer" aria-label={openOriginal(i+1)}>` 안에 `<img className="aspect-square object-cover rounded">` (Task 4와 같은 lint 예외 주석).

- [ ] **Step 3: `ListingDetailView`의 두 자리를 채운다.**

- [ ] **Step 4: design.md** — 컴포넌트 규격에 "**매물 상세**" 문단: 카드 3개(상세 내역·데이터시트·사진) 순서, 제목 22/700 + 상품번호 mono, 정보 표 순서(이미지 행 먼저), 버튼 34(구매자 견적 outline·구매 채움 / 판매자 수정 outline·삭제), PDF 뷰어 높이 640(모바일 480), 사진 4열(모바일 2열), `@md` 미만 세로 쌓기.

- [ ] **Step 5: 검증** — `pnpm typecheck && pnpm lint && pnpm test` 통과. 수동: 비로그인이면 "로그인 후 열람", 로그인이면 PDF 요청이 나가는지(파일 API가 없는 main 기준이라 실패 → 카드 안 오류 + 다시 시도가 정상), 서류 링크 클릭 시 빈 탭이 열렸다 닫히고 오류 한 줄.

- [ ] **Step 6: 커밋** — `feat(frontend): 매물 상세 데이터시트 뷰어·서류·사진` + `docs: design.md 매물 상세 규격`.

---

### Task 6: 파일 업로드 머지 후 rebase·실제 파일 확인 (선행: `feat/file-upload`가 main에 머지됨)

**Files:** 충돌 나는 파일만 (예상: `ListingApiTest.java`, `ListingService.java`, `docs/decisions.md`, 상품등록 세션이 먼저 머지되면 `types/listing.ts`·`messages/listing.ts`·`lib/api/listings.ts`)

- [ ] **Step 1:** `git fetch origin && git rebase origin/main`. 충돌은 양쪽 변경을 모두 살려 합친다(우리 쪽 필드 추가 + 업로드 키 검사 등). 미커밋 변경을 버리는 명령은 쓰지 않는다.
- [ ] **Step 2:** `./gradlew check` + `pnpm typecheck && pnpm lint && pnpm test` 통과.
- [ ] **Step 3: 수동 확인** — Bruno `bruno/uploads/upload.bru`로 사진 2장·데이터시트 PDF·테스트리포트를 올리고 그 키로 매물 등록. 상세에서: 큰 사진·사진 목록·원본 새 탭, PDF 뷰어 표시, 서류 새 탭, 비로그인 "로그인 후 열람", 판매자 삭제, 타일 분할 칸(좁은 폭)·모바일 폭 레이아웃. 확인 결과를 PR 본문 "확인 방법"에 적는다.
- [ ] **Step 4:** 푸시·PR(`feat/listing-detail` → main). PR 본문: 무엇을·왜·확인 방법. `/code-review` 실행 후 반영. 머지는 사용자가 웹에서.
