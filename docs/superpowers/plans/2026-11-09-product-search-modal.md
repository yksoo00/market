# 상품마스터 찾기를 큰 검색 모달로 (2026-11-09)

> **구현 방식:** 이 저장소 규칙(CLAUDE.md "중간 크기 기능")대로 계획 승인 뒤 직접(native) 구현한다. 작업마다 리뷰하지 않고 PR 에서 `/code-review` 한 번. 단계는 `- [ ]` 로 추적. 브랜치 `feat/product-search-modal`(`dev` 에서).

**Goal:** 상품마스터 [상품 찾기]가 최대 10건만 보여 주는 한계를 없앤다. 검색어·카테고리·제조사로 걸러 **페이지 번호가 있는 표**에서 하나를 체크하고 [선택]으로 확정하는 큰 검색 모달을 만든다. 판매 다량 등록·(머지되면) 대량구매의 [상품 찾기]와 등록 폼이 같은 모달을 쓴다.

**Architecture:** 기존 `ProductSearchDialog`(독립 팝업, `onPick`·`onClose`)를 **같은 이름·같은 props 로 키운다** — 쓰는 쪽(판매 다량 등록, 대량구매)은 코드 변경 없이 새 모달을 얻는다. 백엔드에는 페이지 번호·필터가 있는 검색 API 를 더하고 기존 `GET /api/v1/products?q=`(10건)는 호환을 위해 그대로 둔다. 등록 폼의 드롭다운(`ProductPicker`)은 두고 [자세히 찾기] 버튼으로 같은 모달을 연다.

**Tech Stack:** Spring Boot 4.1, Next.js 16, zod 불필요(필터 글자뿐), Vitest. **새 라이브러리·DB 변경 없음.**

**Spec:** 이 파일의 "설계" 절 (대화로 사용자와 정함, 2026-11-09).

## 설계

### 정해진 것 (사용자 확인)

- **페이지가 아니라 큰 모달**: 폼에 쳐 둔 값을 잃지 않고 칸 엔진 배치·복원 작업이 없다. 창 가운데 큰 크기(`max-w-5xl`)로 열리고 안에서는 페이지처럼 쓴다.
- **체크는 하나만**(한 줄·한 폼의 마스터는 하나). 줄(행)을 눌러 고르고 [선택]으로 확정한다. 더블클릭은 바로 선택.
- **필터**: 검색어(이름·제조사·상품번호·분류번호 부분일치) + 카테고리(대·중·소 아무 단계나) + 제조사(글자 부분일치).
- **표**: 이름 · 제조사 · 상품번호 · 분류번호 · 카테고리 · **판매 가능한 매물 N건**(재고가 있고 거래완료가 아닌 매물). 구매 쪽에서 매물이 있는 상품을 알아보게.
- **페이지 번호**(`page`·`totalPages`·`total`), 한 페이지 20건. 이 저장소의 목록 페이지 번호 방식(`PageKeys`, backend.md "API")을 따른다.
- 등록 폼의 `ProductPicker` 는 드롭다운 그대로 두고 [자세히 찾기] 버튼으로 같은 모달을 연다(변경 최소).
- 카테고리 선택은 기존 독립 팝업 `CategoryPickDialog` 를 재사용하되 **대·중분류도 고를 수 있는 옵션**(`anyLevel`)을 더한다.

### 내가 정한 것 (승인 때 확인)

1. **API**: `GET /api/v1/products/page?q=&category=&brand=&page=` → `{ items, page, totalPages, total }`. `q`·`brand` 는 50자 이하(기존 검색과 같음), `category` 는 대/중/소 경로 코드(`P01`, `P01-Q01`, `P01-Q01-R001`) 형식 검사, `page` 는 1 이상(범위 밖은 400). 한 페이지 크기는 서버가 20으로 고정(클라이언트가 못 바꿈). 로그인 필요(기존 규칙 그대로).
2. **정렬**: 검색어가 있으면 관련도 순 — 이름이 정확히 같음 → 이름이 검색어로 시작 → 이름에 포함 → 그 밖(제조사·번호에서만 걸림), 같은 등급 안에서는 이름순·상품ID순. 검색어가 없으면 이름순. 정렬 키가 결정적이라 페이지 사이에 중복·누락이 없다.
3. **페이지 경계**: `PageKeys.of(정렬된 상품ID 전부, page, 20)` 로 건수·총 페이지를 구하고 그 페이지의 ID 만 읽는다. 마스터는 수천 건 규모라 키 전부를 읽는 비용이 작다(`PageKeys` 주석이 정한 수준, 수만 건을 넘으면 다시 본다).
4. **매물 N건**: 마스터별 `trd_prod_reg` 행 중 `dt_expire is null and stock_quantity > 0` 개수를 그 페이지 20건만 한 쿼리로 센다(응답 `listingCount`).
5. 기존 `GET /api/v1/products?q=` 와 응답 모양은 안 바꾼다(`ProductPicker` 드롭다운과 외부 호환).

### 영향 검토

- `ProductSearchDialog` 를 쓰는 곳은 `BulkListingView`(판매 다량 등록)뿐이고(대량구매는 PR #135 머지 뒤 같은 이름을 씀) props 가 같아 호출 코드는 안 바뀐다. 대신 팝업 모양이 바뀌므로 판매 다량 등록의 [상품 찾기] 화면 확인이 필요하다.
- `ProductPicker`(등록 폼)는 [자세히 찾기] 버튼과 모달 연결만 더한다. 마스터를 고른 뒤 폼을 채우는 기존 `pickMaster` 를 그대로 쓴다.
- 새 오류 코드는 없다(검증 실패는 기존 `VALIDATION` 400).
- DB 변경 없음. 인덱스 없이 `lower(...) like` 로 훑는다 — 마스터가 수천 건인 지금은 충분하고, 느려지면 측정 후 인덱스를 상의한다.

## Global Constraints

- 문구는 `frontend/src/messages/` 에. 컴포넌트에 하드코딩 금지.
- 입력 검증 두 층: 프론트(검색어 50자 `maxLength`·페이지 숫자)와 백엔드(`@Size`·형식·페이지 범위)가 같은 수치. 검색 글자는 LIKE 와일드카드를 이스케이프한다(`ProductService.search` 와 같음).
- 응답 `{ ok, data }`, 경로 `/api/v1/...`, 새 API 마다 `bruno/products/` 요청 파일 + 정상·권한 없음·잘못된 입력 테스트.
- 모바일(390px) 먼저, 빈·로딩·오류 상태. 인코딩 UTF-8(BOM 없음), CRLF 파일은 필요한 줄만 국소 수정. 새 의존성 금지.
- 저장소는 공개: 실제 IP·호스트를 문서·커밋에 쓰지 않는다.

## Review Focus

1. **검색어에 `%`·`_`·`\`**: 와일드카드가 아니라 문자 그대로 찾는다. (작업 1)
2. **검색어가 빈 글·공백만**: 이름순 전체 목록이 페이지로 나온다. (작업 1)
3. **범위 밖 page**(0·너무 큼): 400 `fields.page`, 결과가 없어도 1페이지는 있다. (작업 1)
4. **같은 등급 안 정렬이 안정적**: 같은 이름 마스터가 여럿이어도 페이지를 넘길 때 중복·누락이 없다. (작업 1)
5. **카테고리 경로 형식 오류**(`ZZZ`, `P01-`, 4단계): 400. 존재하지 않는 코드는 빈 결과. (작업 1)
6. **느린 입력 중 이전 검색어 응답이 새 결과를 덮어씀**: 응답이 지금 조건과 같을 때만 반영. (작업 3)
7. **필터를 바꾸면 1페이지로**, 페이지 이동 중에 선택한 줄이 다른 페이지로 넘어가면 선택은 풀림. (작업 3)

---

## 작업

### 작업 1. 검색·페이지 (백엔드, listing)

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/repository/ProductRepository.java`, `.../service/ProductService.java`
- Create: `.../dto/ProductSearchPageResponse.java`(`items`, `page`, `totalPages`, `total`), `.../dto/ProductPageItemResponse.java`(기존 `ProductSearchItemResponse` 칸 + `listingCount`)
- Test: `backend/src/test/java/com/company/market/listing/service/ProductSearchPageTest.java`

**Interfaces:**
- Produces: `ProductService.searchPage(String q, String category, String brand, int page): ProductSearchPageResponse`(크기 20). 정렬된 상품ID 목록을 읽는 레포지토리 메서드 `ProductRepository.orderedIds(String likePattern, String exact, String prefix, String major, String middle, String minor, String brandPattern)`(네이티브 쿼리, 바인딩만 — 문자열을 SQL 에 이어 붙이지 않는다)와 한 페이지 ID 로 마스터를 읽는 `findAllById` 재사용, 매물 수는 `countListingsByProduct(Collection<String> prodIds): Map<String, Integer>`.

- [ ] **Step 1: 실패하는 테스트** — 검색어 없음 → 이름순 전체와 총 건수·총 페이지, 20건 넘으면 2페이지가 이어지고 중복·누락 없음, 이름 정확히 같음이 앞에 오고(prefix → contains → 제조사만 걸림 순), 제조사 필터(대소문자 무시 부분일치), 카테고리 필터(대·중·소 각 단계), 검색어+카테고리+제조사 조합, `%`·`_`·`\` 는 문자 그대로, 범위 밖 page 는 `ValidationException(page)`, 결과가 없어도 1페이지·총 0건, 카테고리 형식이 틀리면 거절, `listingCount` 는 재고가 있고 거래완료가 아닌 매물만(재고 0·거래완료는 안 셈).
- [ ] **Step 2: 실행해 실패 확인** — `./gradlew test --tests "*ProductSearchPageTest"`
- [ ] **Step 3: 구현** — 위 시그니처. 정렬 `order by rank, lower(prod_name), prod_id`.
- [ ] **Step 4: 통과** → **Step 5: 커밋** — `feat(backend): 상품마스터 검색(필터·페이지 번호)`

### 작업 2. API·문서 (백엔드)

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/controller/ProductController.java`
- Test: `backend/src/test/java/com/company/market/listing/controller/ProductSearchPageApiTest.java`
- Create: `bruno/products/search-page.bru`
- Modify: `docs/security.md`(상품 검색 항목: 새 쿼리 파라미터 상한·형식·페이지 크기 고정·로그인 필요)

**Interfaces:** `GET /api/v1/products/page?q&category&brand&page`(page 기본 1). 컨트롤러는 형식·길이 검사만 하고 위임한다.

- [ ] **Step 1: 실패하는 테스트** — 정상(필터+페이지), 로그인 없이 401, 검색어·제조사 51자·`page=0`·카테고리 형식 오류는 400(`fields` 키 q/brand/page/category), 응답에 개인정보 없음, 기존 `GET /api/v1/products?q=` 는 그대로 10건.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과** (`./gradlew test --tests "*Product*"`)
- [ ] **Step 5: 커밋** — `feat(backend): 상품마스터 검색 API 와 Bruno 요청`

### 작업 3. 큰 검색 모달 (프론트)

**Files:**
- Modify: `frontend/src/components/listing/ProductSearchDialog.tsx`(같은 이름·props, 큰 모달로), `frontend/src/components/listing/CategoryPickDialog.tsx`(`anyLevel` 옵션), `frontend/src/lib/api/catalog.ts`(`searchProductsPage`), `frontend/src/types/listing.ts`(`ProductSearchPage`, `ProductPageItem`), `frontend/src/messages/listing.ts`
- Create: `frontend/src/lib/productSearch.ts`(조건 → 쿼리 문자열·페이지 이동 순수 함수), `frontend/src/lib/productSearch.test.ts`

**Interfaces:**
- Produces: `buildProductSearchParams(f: { q: string; category: string; brand: string; page: number }): string`(빈 조건은 뺌), `clampPage(page: number, totalPages: number): number`. `ProductSearchDialog({ onPick(item: ProductSearchItem), onClose() })` — props 불변. 안에서 필터(검색어·카테고리·제조사)·표·페이지 번호(`lib/pager.pageItems` 재사용)·[선택]·[닫기]. 필터가 바뀌면 1페이지, 응답은 지금 조건과 같을 때만 반영, 로딩·빈·오류(재시도) 상태.

- [ ] **Step 1: 실패하는 테스트** — `productSearch.test.ts`: 빈 조건은 쿼리에서 빠지고 값은 인코딩, 페이지 범위 보정, 조건이 바뀌면 page 가 1 로 돌아가는 규칙(함수로 분리). 
- [ ] **Step 2: 실행해 실패 확인** — `pnpm exec vitest run src/lib/productSearch.test.ts`
- [ ] **Step 3: 구현** — 모달·API 호출·카테고리 `anyLevel`. 키보드(↑↓·Enter·Esc)·접근 가능한 이름, 표는 모바일에서 카드/줄로 접힘.
- [ ] **Step 4: `pnpm typecheck && pnpm lint && pnpm test`** → **Step 5: 커밋** — `feat(frontend): 상품 찾기를 필터·페이지 번호가 있는 큰 검색 모달로`

### 작업 4. 등록 폼 연결·문서·마무리

**Files:**
- Modify: `frontend/src/components/listing/ProductPicker.tsx`([자세히 찾기] 버튼 + 모달, 고르면 기존 `pickMaster` 호출), `frontend/src/messages/listing.ts`, `docs/design.md`(상품 찾기 모달 모양), `docs/decisions.md`(2026-11-09 항목)

- [ ] **Step 1~2: 연결 구현** — 등록 폼 드롭다운은 그대로, [자세히 찾기]로 모달을 열고 고른 마스터를 폼에 채운다(상품 칸이 마스터 값으로 잠김, 기존 동작과 같음).
- [ ] **Step 3: 화면 확인** — 등록 폼·판매 다량 등록·(PR #135 머지 뒤) 대량구매에서 모달이 열리고 검색·필터·페이지·선택이 되는지, 모바일 390px·3분할 오른쪽 아래 칸(960×500, 640×330)에서 잘리지 않는지. 결과 보고에 확인한 배치를 적는다.
- [ ] **Step 4: `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`**, `git grep` 으로 실제 IP·호스트 없음 확인.
- [ ] **Step 5:** `feat/product-search-modal` 푸시 → PR(본문: 무엇을·왜·확인 방법·"내가 정한 것" 명시) → `/code-review` 1회 → 반영 → 재검사 → 보고. 머지는 사용자가 한다. E2E 는 새 spec 을 더하지 않고 단위·API 테스트와 직접 확인으로 대신한다(값어치 대비 비싸다는 의견 반영).
