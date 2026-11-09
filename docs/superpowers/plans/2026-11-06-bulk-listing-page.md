# 엑셀 다량 등록을 페이지로 (2026-11-06)

> **구현 방식:** 이 저장소 규칙(CLAUDE.md "중간 크기 기능")대로 계획 승인 뒤 직접(native) 구현한다. 작업마다 리뷰하지 않고 PR 에서 `/code-review` 한 번. 단계는 `- [ ]` 로 추적. **PR #132(모달 버전)가 머지된 뒤** `dev` 에서 `feat/bulk-listing-page` 를 만들어 시작한다.

**Goal:** 다량 등록 화면을 모달에서 페이지(`/listings/bulk`)로 옮기고, 줄이 많아도 다룰 수 있게 상태 필터·검색·열 머리 정렬을 붙이고, 마스터를 못 찾은 줄은 마스터를 검색해서 고르거나 직접 입력하게 한다.

**Architecture:** 백엔드(양식·parse·check·commit)는 그대로 쓴다. 프론트만 바뀐다. 줄 상태는 기존 `bulkReducer` 를 확장하고 `sessionStorage` 에 보관한다. 필터·검색·정렬은 전부 브라우저에서 한다(서버에는 줄이 없다).

**Tech Stack:** Next.js 16 App Router, zod, Vitest, Playwright. **새 라이브러리·DB 변경·백엔드 변경 없음.**

**Spec:** 이 파일의 "설계" 절 (grilling 2026-11-06 에서 사용자와 정함). 앞선 설계: `docs/superpowers/plans/2026-11-05-bulk-listing-excel.md`.

## 설계

### 정해진 것 (사용자 확인)

- 모달 폐지. 홈 아이콘·앱 메뉴의 "판매상품 다량 등록"은 일반 링크로 `/listings/bulk` 를 연다. 화면 표 그룹 `sell`. `BulkListingDialog` 는 삭제.
- 페이지 맨 위에 드롭존(끌어 놓기 + 파일 선택 + [양식 내려받기]). 새 파일을 올리면 지금 작업을 **덮어쓴다**(작업이 있으면 확인창). 두 파일 합치기는 안 한다.
- 줄 상태는 브라우저가 들고, **`sessionStorage` 에 자동 보관**한다(새로고침해도 이어서). 탭을 닫거나 확정이 끝나면 비운다. 화면 위에 [처음부터 다시].
- **표 모양**: 넓은 화면은 행=줄, 열=칸인 표(칸을 그 자리에서 고침, 열 머리 클릭 정렬). 모바일(390px)은 줄 카드. 페이지 번호 없이 한 번에 스크롤(상한 200줄 유지).
- **필터·검색·정렬(브라우저)**:
  - 상태 탭: 전체 / 등록 가능 / 새 상품 / 확인 필요 / 등록됨. 등록됨은 기본 숨김.
  - 검색: 상품명·제조사 글자(대소문자 무시).
  - 정렬: 열 머리를 누를 때만 다시 정렬(오름 → 내림 → 기본, `lib/columnSort` 방식). 칸을 고쳐도 줄이 위아래로 튀지 않는다. 모바일은 [정렬] 드롭다운(행 번호·상품명·단가·수량·오류 먼저).
  - 이전 "두 목록(등록 가능 / 확인 필요)"은 상태 탭으로 바뀐다.
- **마스터 찾기·직접 입력**: 줄마다 이름이 비슷한 후보 버튼(기존) + [상품 찾기](검색 팝업에서 마스터를 골라 그 줄에 확정) + [직접 입력](상품명·제조사·분류번호·상품번호·카테고리를 입력하면 새 상품으로 등록).
  - **마스터를 고른 줄은 상품 칸이 읽기 전용**으로 잠기고 [직접 입력으로 바꾸기]로 푼다(등록 폼과 같은 방식). 엑셀에서 `prod_id` 가 채워진 줄도 같다.
- **확정 후**: 등록된 줄은 "등록됨"으로 남고(수정·체크 불가) 기본 필터에서 숨는다. 페이지를 떠나면 사라진다.
- **선택 범위**: [오류 없는 줄 모두 선택]은 지금 보이는 줄(필터·검색 적용)만. [전체 확정]은 숨겨진 줄까지 오류 없는 줄 전부이고, 확인 문구에 "N건(숨겨진 M건 포함)"을 넣는다.
- 상한은 200줄 유지. 늘리려면 백엔드 확정 쿼리를 한꺼번에 읽도록 같이 고친다(별도 일).

### 내가 알게 된 것 (계획에 반영)

- 등록 폼의 `ProductPicker`·`CategoryPicker` 는 react-hook-form 컨텍스트에 묶여 있어 표 칸에서 **그대로 재사용할 수 없다**. 같은 API(`catalogApi.searchProducts`, `catalogApi.categories`)와 `lib/categories` 의 트리 함수를 쓰는 **독립 선택기 둘**(`ProductSearchDialog`, `CategoryPickDialog`)을 새로 만든다. 등록 폼 쪽 코드는 건드리지 않는다.
- 모달에서 칸 엔진으로 가므로 새 화면 체크리스트(frontend.md)를 따른다: `tileScreens` 등록, 코드 이동은 `useTileOpen`, 헤더 앱 메뉴 항목에 `data-tile-from-home`(링크로 바뀌므로 확인), 넓은 화면에서 직접 열기·새로고침 복원, 3분할 칸 크기에서 잘림 확인.

### 영향 검토

- 백엔드 API·DB 는 안 바뀐다. `ListingBulkApiTest` 등 백엔드 테스트도 그대로.
- 모달을 없애므로 `BulkListingDialog` 와 `QuickMenu`·`AppLauncher` 의 상태(`bulkOpen`)·E2E(`bulk-listing.spec.ts`)가 바뀐다. E2E 는 새 spec 을 더하지 않고 **기존 spec 을 페이지 흐름으로 고친다**(핵심 흐름: 올리기 → 오류 줄 고치기 → 새 상품 체크 → 확정).
- `sessionStorage` 에 상품·가격 정보가 남는다. 개인정보(이메일·전화)는 줄에 없다. 확정·[처음부터 다시]·새 파일 덮어쓰기에서 비운다. 저장 실패(용량·차단)는 조용히 넘기고 보관만 못 한다.
- 이전 결정 "줄은 목록을 옮겨 다니지 않는다"는 정렬 규칙으로 이어진다(편집이 정렬을 다시 돌리지 않음). 두 목록 구조는 폐기 — `decisions.md` 에 대체 항목을 덧붙인다.

## Global Constraints

- 문구는 `frontend/src/messages/` 에. 컴포넌트에 하드코딩 금지.
- 입력 검증은 프론트 zod(`lib/validation/bulkListing.ts`) → 백엔드 같은 규칙. 이번에 규칙은 안 바뀐다.
- 새 `page.tsx` 는 같은 PR 에서 `lib/tileScreens.ts` 에 등록(없으면 `tileScreens.test.ts` 실패). 모바일(390px) 먼저, 모든 목록에 빈·로딩·오류 상태.
- 인코딩 UTF-8(BOM 없음). CRLF 파일은 필요한 줄만 국소 수정. 새 의존성 금지(필요하면 먼저 묻는다).
- 저장소는 공개: 실제 IP·호스트를 문서·커밋에 쓰지 않는다.

## Review Focus

1. **보관본이 낡았을 때**: 보관 후 서버 규칙이 바뀌었거나(상태 목록 등) 형식이 안 맞는 보관본 → 버리고 빈 화면. 버전 값을 둔다. (작업 2)
2. **필터로 숨긴 줄이 확정에 섞임**: 선택은 보이는 줄만이고 [전체 확정]만 숨긴 줄을 포함, 확인 문구에 개수. (작업 1·4)
3. **정렬 중 칸 수정**: 고쳐도 줄 순서가 바뀌지 않는다. (작업 1)
4. **마스터 고른 줄을 직접 입력으로 바꿀 때**: `prodId` 가 비고 상품 칸은 마스터 값으로 채워진 채 편집 가능해진다. 칸이 비어 날아가지 않는다. (작업 1)
5. **등록됨 줄**: 수정·체크·재검사가 막히고, 다시 확정 대상에 안 들어간다. (작업 1)
6. **새 파일 덮어쓰기 중 오래된 응답**: 올리는 도중 다시 올리거나 떠나면 먼저 보낸 응답이 새 상태를 덮지 않는다. (작업 4)

---

## 작업

### 작업 1. 상태 로직: 필터·검색·정렬·마스터 잠금·등록됨 (프론트)

**Files:**
- Modify: `frontend/src/lib/bulkListing.ts`
- Create: `frontend/src/lib/bulkListingView.ts`
- Test: `frontend/src/lib/bulkListing.test.ts`, `frontend/src/lib/bulkListingView.test.ts`

**Interfaces:**
- Produces(`bulkListingView.ts`): `type BulkTab = "all" | "ok" | "new" | "failed" | "done"`, `type BulkSortKey = "rowNo" | "prodName" | "prodBrand" | "salesUnitPrice" | "salesQuantity" | "status"`, `interface BulkView { tab: BulkTab; query: string; sort: { key: BulkSortKey; dir: "asc" | "desc" } | null }`, `visibleLines(lines: BulkLine[], view: BulkView): BulkLine[]`(탭 → 검색 → 정렬. `all` 은 등록됨 제외), `tabCounts(lines): Record<BulkTab, number>`, `nextSortFor(view: BulkView, key: BulkSortKey): BulkView["sort"]`(오름 → 내림 → 해제, 기존 `columnSort` 와 같은 순서), `confirmWording(...)`는 두지 않는다(메시지 함수는 messages).
- Produces(`bulkListing.ts` 확장): `BulkLine` 에 `locked: boolean`(마스터 고른 줄) · `committed: boolean`(등록됨). 액션 `{ type: "unlocked"; rowNo }`(직접 입력으로 바꾸기), `{ type: "picked"; rowNo; candidate }` 가 `locked` 를 켠다, `{ type: "committed"; rowNos }` 는 줄을 지우지 않고 `committed` 로 표시. `selectVisible(rowNos: number[], value: boolean)` 액션(보이는 줄만 선택). `summary` 는 `committed` 를 빼고 센다.

- [ ] **Step 1: 실패하는 테스트** — `bulkListingView.test.ts`: 탭별 걸러내기(`all` 은 등록됨 제외 · `done` 은 등록됨만), 검색은 상품명·제조사에서 대소문자 무시, 정렬 `nextSortFor` 순환, 정렬해도 입력 상태(원본 배열) 불변, 상태 정렬(오류 먼저). `bulkListing.test.ts`: 마스터 고르면 `locked`, `edited` 로 상품 칸을 못 고침(잠김), `unlocked` 하면 `prodId` 비고 상품 칸 유지·편집 가능, `committed` 는 줄 유지 + 수정·체크·재검사 무시, `selectVisible` 은 넘긴 줄만 바꾸고 `canSelect` 인 줄만, 요약에서 등록됨 제외.
- [ ] **Step 2: 실행해 실패 확인** — `pnpm exec vitest run src/lib/bulkListing.test.ts src/lib/bulkListingView.test.ts`
- [ ] **Step 3: 구현** — 위 시그니처대로. 정렬 키 값 비교는 글자는 `localeCompare("ko")`, 숫자 칸은 수치(쉼표 제거), 상태는 오류 → 새 상품 → 마스터 찾음 순.
- [ ] **Step 4: 통과 + `pnpm typecheck && pnpm lint`**
- [ ] **Step 5: 커밋** — `feat(frontend): 다량 등록 줄 필터·검색·정렬·마스터 잠금`

### 작업 2. 작업 보관 (프론트)

**Files:**
- Create: `frontend/src/lib/bulkStorage.ts`
- Test: `frontend/src/lib/bulkStorage.test.ts`

**Interfaces:**
- Produces: `saveBulk(state: BulkState, storage?: Storage): void`, `loadBulk(storage?: Storage): BulkState | null`, `clearBulk(storage?: Storage): void`. 키 `market.bulkListing.v1`. 형식 불일치·버전 다름·JSON 오류는 `null`(버리고 지움). 저장 예외(용량·차단)는 삼킨다. 보관하는 것: `lines`(`checking` 은 항상 false 로 저장) · `created`.

- [ ] **Step 1: 실패하는 테스트** — 저장 → 읽기 왕복, 깨진 JSON → `null` + 지움, 버전이 다른 값 → `null`, `checking:true` 로 저장해도 읽으면 false, `setItem` 이 던져도 예외 없음, `clearBulk` 후 `null`. (Vitest 환경의 `Storage` 대역으로)
- [ ] **Step 2: 실행해 실패 확인** → **Step 3: 구현** → **Step 4: 통과**
- [ ] **Step 5: 커밋** — `feat(frontend): 다량 등록 작업을 sessionStorage 에 보관`

### 작업 3. 독립 선택기 둘 (프론트)

**Files:**
- Create: `frontend/src/components/listing/ProductSearchDialog.tsx`, `frontend/src/components/listing/CategoryPickDialog.tsx`
- Modify: `frontend/src/messages/listing.ts`(`bulk.pick` 문구)

**Interfaces:**
- Produces: `ProductSearchDialog({ onPick(item: ProductSearchItem): void, onClose(): void })` — 검색어 입력(입력이 멈춘 뒤 `catalogApi.searchProducts`), 결과 목록(이름·제조사·분류번호·카테고리), 로딩·빈·오류 상태, 늦게 온 이전 검색어 결과 무시. `CategoryPickDialog({ value: string, onPick(code: string, name: string): void, onClose(): void })` — `catalogApi.categories` → `buildCategoryTree`, 대·중·소를 차례로 고르고 소분류를 누르면 `onPick`.
- 등록 폼의 `ProductPicker`·`CategoryPicker` 는 건드리지 않는다(react-hook-form 에 묶여 있음).

- [ ] **Step 1~3: 구현** — 모달(`Dialog`) 안에서 열린다. 키보드(↑↓·Enter·Esc)·접근 가능한 이름. 테스트는 이 컴포넌트에 단위 테스트를 두지 않고(상태 로직은 얇다), 작업 5 의 E2E 와 직접 확인으로 본다.
- [ ] **Step 4: `pnpm typecheck && pnpm lint`**
- [ ] **Step 5: 커밋** — `feat(frontend): 마스터 검색·카테고리 선택 팝업(독립)`

### 작업 4. 페이지·표·연결 (프론트)

**Files:**
- Create: `frontend/src/app/listings/bulk/page.tsx`, `frontend/src/components/listing/BulkListingView.tsx`(페이지 본체: 드롭존·필터바·표/카드·확정), `frontend/src/components/listing/BulkRows.tsx`(표 줄·모바일 카드)
- Modify: `frontend/src/lib/tileScreens.ts`(`{ id: "sellBulk", group: "sell", pattern: /^\/listings\/bulk$/ }`, 더 구체적인 경로라 `listingDetail` 보다 위), `frontend/src/lib/tileScreens.test.ts`, `frontend/src/components/home/QuickMenu.tsx`·`frontend/src/components/common/AppLauncher.tsx`(`sellBulk` 를 `LinkItem`/`Link` 로, 모달 상태 제거), `frontend/src/messages/listing.ts`·`home.ts`
- Delete: `frontend/src/components/listing/BulkListingDialog.tsx`
- Modify: `docs/design.md`(다량 등록 화면 모양으로 교체, 홈 아이콘 줄 문구), `docs/decisions.md`(2026-11-06 항목: 모달 → 페이지, 두 목록 → 상태 탭, 보관, 마스터 잠금)

**동작:**
- 위 "설계"의 화면 규칙을 따른다. 칸을 벗어날 때 그 줄만 `/check`, 후보·[상품 찾기]·[직접 입력] 은 즉시 `/check`. 확정은 `/commit`(선택 확정 · 전체 확정), 409 면 선택한 줄을 다시 `/check`.
- 상태가 바뀔 때마다 `saveBulk`(디바운스), 처음 열 때 `loadBulk` 가 있으면 복원하고 "이전 작업을 이어서 보여 줘요"를 안내. [처음부터 다시]·확정 완료는 `clearBulk`.
- 요청 순서 보호: 줄마다 마지막 요청 번호를 두어 오래된 응답을 버린다(모달 버전과 같은 방식). 새 파일 올리는 중에는 올리기·이동 막기.
- 새 화면 체크리스트: ① 화면 표 등록 ② 코드 이동 `useTileOpen`(내 판매글 보기) ③ 앱 메뉴 항목 `data-tile-from-home` ④ 헤더·주기능에서 직접 열기·새로고침 복원 ⑤ 3분할 오른쪽 아래 칸(960×500, 640×330)에서 잘림 없음 ⑥ E2E 의 iframe·URL 기대는 칸 규칙대로. 결과 보고에 확인한 배치를 적는다.

- [ ] **Step 1: `tileScreens.test.ts` 에 새 화면 케이스를 먼저 추가해 실패 확인** — `pnpm exec vitest run src/lib/tileScreens.test.ts`
- [ ] **Step 2: 표 등록 + 페이지·컴포넌트 구현**(위 동작)
- [ ] **Step 3: 홈 아이콘·앱 메뉴를 링크로 바꾸고 모달 삭제**
- [ ] **Step 4: 화면 확인** — 데스크톱, 390px, 3분할 칸. 줄 200개짜리 파일(큰 파일)로 스크롤·필터·정렬이 버티는지.
- [ ] **Step 5: `pnpm typecheck && pnpm lint && pnpm test`**
- [ ] **Step 6: 커밋** — `feat(frontend): 엑셀 다량 등록 페이지(필터·검색·정렬·마스터 찾기)`, 문서는 `docs:` 별도 커밋.

### 작업 5. E2E 수정·마무리

- [ ] `frontend/e2e/bulk-listing.spec.ts` 를 페이지 흐름으로 고친다(홈 아이콘 → 페이지 → 올리기 → 상태 탭에서 확인 필요 줄 고치기 → 새 상품 체크 → 선택 확정 → 등록됨 탭). 이 spec 하나만 1번(시간 초과는 재실행 1번 통과면 끝).
- [ ] `E2E_BASE_URL=<프론트 주소>` 를 쓴다(`.env` 의 `APP_URL` 과 맞춤).
- [ ] `./gradlew check`(백엔드는 안 바뀌어 통과만 확인), `pnpm typecheck && pnpm lint && pnpm test`, `git grep` 으로 실제 IP·호스트 없음 확인.
- [ ] `feat/bulk-listing-page` 푸시 → PR(본문: 무엇을·왜·확인 방법) → `/code-review` 1회 → 반영 → 보고. 머지는 사용자가 한다.
