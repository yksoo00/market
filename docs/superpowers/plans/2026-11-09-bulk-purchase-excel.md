# 엑셀 대량구매 (2026-11-09)

> **구현 방식:** 이 저장소 규칙(CLAUDE.md "중간 크기 기능")대로 계획 승인 뒤 직접(native) 구현한다. 작업마다 리뷰하지 않고 PR 에서 `/code-review` 한 번. 단계는 `- [ ]` 로 추적. 브랜치 `feat/bulk-purchase`(PR #134 머지 뒤 `dev` 에서).

**Goal:** 홈·앱 메뉴의 "엑셀 대량구매"가 `/buy/bulk` 페이지를 열고, 엑셀로 올린 상품·수량을 실제 매물과 대조해서 "매물 있음 / 매물 없음"으로 나눠 보여 주고, 고른 매물을 장바구니에 담는다(구매·견적은 기존 장바구니 흐름).

**Architecture:** 판매 다량 등록(2026-11-05·11-06)과 같은 틀이다 — 서버는 줄 상태를 저장하지 않고(파싱·검사·담기만), 수정·체크·필터·검색·정렬·보관은 브라우저가 한다. 새로 필요한 건 "줄 → 상품마스터 → 그 마스터의 살 수 있는 매물 후보"를 찾는 검사와, 줄마다 장바구니에 담는(부분 성공) 확정이다. 기존 `CartService.add` 를 줄마다 한 번씩 부른다(자기 트랜잭션).

**Tech Stack:** Spring Boot 4.1(POI 기존), Next.js 16, zod, Vitest, Playwright. **새 라이브러리·DB 변경 없음.**

**Spec:** 이 파일의 "설계" 절 (grilling 2026-11-09 에서 사용자와 정함).

## 설계

### 정해진 것 (사용자 확인)

- **범위**: 엑셀 결과로 **장바구니에 담는 데까지**. 구매·견적은 기존 장바구니 화면(`/my/cart`)에서. 새 거래 로직은 없다.
- **엑셀 양식**(서버가 내려줌, 헤더만·예시 줄 없음, 첫 시트): 상품명*, 제조사*, 분류번호, 상품ID, 수량*, 납품희망일*, 요청사항. 단가는 매물 단가라 안 받는다. `.xlsx`, 10MB, **100줄**(장바구니 최대 100줄과 맞춤), 원본 미보관.
- **상품 찾기**: 판매 다량 등록과 같다 — 상품ID 가 있으면 그 마스터, 없으면 이름·제조사·분류번호를 대소문자·공백 무시로 찾는다. 못 찾으면 이름이 겹치는 기존 상품 후보 칩 + [상품 찾기](판매 쪽에서 만든 독립 `ProductSearchDialog` 재사용). 마스터에 없는 상품은 살 매물이 없으므로 **새 상품 개념이 없다** — 줄 오류("상품마스터에 없어요").
- **매물 대조**: 마스터를 찾으면 그 마스터의 **모든 매물**을 후보 목록으로 만든다. 줄 수량에 대해 못 사는 매물은 **빼지 않고 사유와 함께 회색으로 남긴다**(재고 부족 · 최소주문량·주문단위 불일치 · 내 매물 · 거래완료). 살 수 있는 후보가 있으면 **재고가 수량 이상인 최저가**(같으면 재고 많은 것, 그래도 같으면 등록일시 빠른 것)를 기본으로 고르고, 줄에서 [다른 매물 보기] 팝업으로 바꾼다.
- **상태 탭**: 전체 / **매물 있음**(살 수 있는 매물이 골라져 있음) / **매물 없음**(마스터는 있는데 살 수 있는 매물이 없음, 사유 표시) / **확인 필요**(입력 오류·상품 못 찾음·고른 매물이 못 사게 바뀜) / **담김**. 판매 쪽 탭·검색(상품명·제조사)·정렬 구조를 구매 칸에 맞게 다시 쓴다.
- **대체품**: 줄이 "매물 없음"이고 그 마스터의 `대체상품명`(`alter_prod_name`)이 있으면, 그 이름과 같은 마스터(대소문자·공백 무시)의 살 수 있는 매물을 **대체 후보로 제안**한다(한 단계만, 순환 없음). 줄에서 **[대체품으로 바꾸기]를 눌러야만** 그 매물이 골라지고, 바뀐 줄에 "요청: A → 대체: B" 배지가 붙는다. 자동으로 바꾸지 않는다. 담을 때 **요청사항에 "원래 요청: A"가 자동으로 덧붙는다**(100자 안에서, 넘치면 사용자가 쓴 앞부분을 자른다). 매물에 적힌 `대체품` 글(`replace_prod`, 자유 글)은 후보 줄에 힌트 글로만 붙인다. 대체상품명을 채우는 쪽(판매 엑셀 양식·수정 화면 보강)은 이번 범위 밖 — **개발 DB 는 마스터 250건 중 대체상품명이 0건이라 이번엔 거의 안 뜬다**(판매자가 채우면 바로 동작).
- **확정(담기)**: 체크한 줄(선택 확정) 또는 담을 수 있는 줄 전부(전체 확정, 숨은 줄 포함 개수를 확인 문구에 넣음). **줄마다 따로 담고 부분 성공**이다 — 담긴 줄은 "담김" 탭으로, 실패한 줄은 사유와 함께 남는다(다른 사람이 그 사이에 재고를 가져가는 경쟁이 있어서 전부 취소하면 계속 실패한다). 확인 문구와 담긴 뒤 안내에 "재고가 1시간 동안 묶여요, 장바구니에서 1시간 안에 구매·견적하세요"와 [장바구니 열기]를 넣는다. 규칙(1시간·100줄)은 안 바꾼다.
- **파일 안 중복**: 같은 상품(해석된 마스터)이 두 줄이면 둘째 줄부터 실패("파일 안에서 같은 상품이 이미 있어요", 수량은 한 줄에 합쳐 쓰게). 합산은 나중에.
- **화면**: 주소 `/buy/bulk`, 화면 그룹 `buy`, 주기능(보조형 아님). 판매 페이지와 같은 모양 — 드롭존, 탭, 검색, 정렬, 보이는 줄만 선택, 줄 카드(넓은 칸이면 표), 등록됨 대신 "담김". 작업은 `sessionStorage` 에 보관(키는 판매와 다르게, 로그인·로그아웃 때 비움). 판매 쪽 컴포넌트·상태 코드는 **건드리지 않고** 구매 전용으로 새로 만든다(순수 함수는 구매 칸에 맞게 따로 쓴다).
- 홈 아이콘·앱 메뉴의 "엑셀로 대량구매"는 지금의 "준비 중" 안내 대신 이 페이지로 가는 링크.

### 내가 정한 것 (승인 때 확인)

1. **API**: `/api/v1/cart/bulk/{template,parse,check,commit}`(기존 `CartController` 의 `/api/v1/cart` 아래). 모두 로그인 필요(양식 GET 은 판매와 달리 이 경로는 공개 규칙에 안 걸리므로 로그인 필요).
2. 줄 DTO(전부 글자): `rowNo, prodId, prodName, prodBrand, prodClassNo, orderQuantity, reqDeliDate, remarks` + 고른 매물 `sellerId, regDate`(없으면 서버가 기본을 고름). 검사 결과 줄: `rowNo, status(AVAILABLE|UNAVAILABLE|FAILED), prodId, matchedName, chosen(ListingOption|null), options(ListingOption[]), alternatives(Alternative[]), candidates(상품 후보), notices, fields, substituted(boolean)`. `ListingOption = { sellerId, regDate, sellerNickname, unitPrice, stock, minOrder, orderUnit, deliveryDate, replaceHint, reason|null }`(reason 이 null 이면 살 수 있음). `Alternative = { prodId, prodName, prodBrand, options(ListingOption[]) }`.
3. **고른 매물 검증**: 클라이언트가 보낸 `sellerId/regDate` 가 이 줄의 마스터 후보 또는 대체 후보에 없거나 지금 못 사면, 서버가 다른 매물로 바꾸지 않고 줄 오류(`fields.listing` 사유)로 돌려준다(조용한 교체 금지). 후보에 있으면 대체품인지(`substituted`)는 서버가 판단한다 — 클라이언트의 주장은 믿지 않는다.
4. **담기는 줄마다 한 번씩** `CartService.add`(요청 항목 1개)를 부른다 — 호출마다 자기 트랜잭션이라 한 줄의 실패가 앞서 담은 줄을 되돌리지 않고, 같은 매물을 고른 두 줄은 앞 줄이 묶은 재고를 뒤 줄이 보고 판정한다. `CartService` 는 안 바꾼다. 장바구니가 가득 차면 그 줄부터 `CART_FULL` 사유로 실패한다.
5. 판매자 별명은 매물 후보에 보인다(견적요청 목록이 구매자 별명을 보이는 것과 같은 수준의 공개). 이메일·전화는 응답에 없다.

### 영향 검토

- 기존 `CartService`·`TradeService`·검색은 그대로. 새 서비스(`CartBulkService`)가 `ListingService`(매물 후보)·`ProductService`(마스터 찾기·대체상품명)·`CartService`(담기)를 서비스 경유로만 부른다(도메인 간 repository 직접 접근 금지).
- 담은 줄은 평범한 장바구니 줄이라 기존 장바구니 화면·1시간 자동 삭제·구매·견적·비교가 그대로 이어진다. 요청사항에 덧붙은 "원래 요청" 글이 구매·견적 때 판매자에게 보인다.
- 한 번에 최대 100줄 × 줄마다 매물 조회·잠금: 장바구니 담기가 매물을 배타 잠금으로 읽으므로 줄 수만큼 직렬로 돈다. 측정 전에는 일괄 최적화하지 않는다(CLAUDE.md). 느려지면 후보 조회를 마스터 목록으로 한 번에 읽는 걸 먼저 본다.
- 판매 다량 등록 코드(`BulkRows` 등)는 안 건드린다. 비슷한 코드가 둘이 생기는 대가를 감수한다(제네릭 리팩터는 별도 일, decisions.md 에 기록).

## Global Constraints

- 문구는 `frontend/src/messages/` 에(새 파일 `buyBulk.ts`). 컴포넌트에 하드코딩 금지.
- 입력 검증 두 층: 프론트 zod(`lib/validation/buyBulk.ts`) → 백엔드 같은 수치. 수량 1~100000, 납품희망일 형식·오늘 이후(`TradeInputRules` 와 같은 규칙), 요청사항 100자(`CartAddRequest.Item` 과 같음).
- 응답 `{ ok, data }` / `{ ok:false, code, message, fields }`, 경로 `/api/v1/...`, 현재 사용자는 `@AuthenticationPrincipal` 만, 본문에 사용자 id 없음. 개인정보(이메일·전화) 응답·로그 금지.
- 새 API 마다 `bruno/cart/` 요청 파일, 정상·권한 없음·잘못된 입력 테스트. 새 오류 코드가 생기면 `ErrorCode` 와 프론트 errors 키를 같은 PR 에.
- 새 `page.tsx` 는 같은 PR 에서 `lib/tileScreens.ts` 등록. 모바일(390px) 먼저, 빈·로딩·오류 상태. 인코딩 UTF-8(BOM 없음), CRLF 파일은 필요한 줄만 국소 수정. 새 의존성 금지(필요하면 먼저 묻는다).
- 저장소는 공개: 실제 IP·호스트를 문서·커밋에 쓰지 않는다.

## Review Focus

1. **같은 매물을 고른 두 줄**: 재고가 한 줄만큼이면 앞 줄이 담기고 뒤 줄은 재고 부족으로 실패(담기가 줄마다 재고를 묶기 때문). (작업 4)
2. **내 매물뿐인 상품**: 본인이 판 상품만 있으면 "매물 없음"(사유 내 매물)이지 담기 실패가 아니다. (작업 3)
3. **수량이 최소주문량·주문단위에 안 맞는 매물**: 후보에는 남고 회색 사유로, 기본값으로는 안 뽑힌다. 수량을 고치면 재검사로 바뀐다. (작업 3)
4. **대체상품명이 자기 자신·순환**(A→B→A): 한 단계만 보고 자기 자신은 제외. (작업 1)
5. **요청사항 덧붙임이 100자를 넘음**: 사용자가 쓴 앞부분을 자르고 "원래 요청" 문구는 항상 남는다. (작업 4)
6. **장바구니가 중간에 가득 참**: 앞 줄은 담기고 이후 줄은 `CART_FULL` 사유로 실패, 담긴 줄은 담김으로. (작업 4)
7. **확정 직전에 고른 매물이 팔림/삭제됨**: 그 줄만 실패하고 사유가 보인다. (작업 4)
8. **엑셀 숫자·날짜 칸**: 판매 파서와 같은 변환(1000.0 → "1000", 날짜 셀 → YYYY-MM-DD, 쉼표 숫자). (작업 2)

---

## 작업

### 작업 1. 매물 후보·대체상품 조회 (백엔드, listing)

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/repository/ListingRepository.java`(마스터별 매물 조회), `.../repository/ProductRepository.java`(이름으로 마스터 찾기), `.../service/ListingService.java`, `.../service/ProductService.java`
- Test: `backend/src/test/java/com/company/market/listing/service/ProductAlternatesTest.java`, `ListingService` 쪽 새 테스트 클래스

**Interfaces:**
- Produces: `ListingService.snapshotsOfProduct(String prodId): List<ListingTradeSnapshot>`(그 마스터의 모든 매물, 거래완료 포함 — 사유를 보이려고), `ProductService.alternatesOf(Product master): List<Product>`(`alterProdName` 이 비어 있지 않으면 같은 이름(대소문자·공백 무시)의 마스터, 자기 자신 제외, 한 단계만), `ListingService.replaceHints(Collection<ListingId>): Map<ListingId, String>`(매물의 `replace_prod` 글, 없으면 빠짐). 판매자 별명은 기존 사용자 서비스 경유로 `Map<UUID,String>` 을 얻는 방식(견적요청 목록과 같은 방식)을 쓰고, 어떤 메서드를 쓰는지는 이 작업에서 확인해 확정한다.

- [ ] **Step 1: 실패하는 테스트** — 마스터의 매물이 모두 나온다(거래완료 포함·재고 순서 무관), 대체상품명이 있으면 같은 이름 마스터가 나오고 자기 자신은 빠진다, 대체상품명이 빈 글·null 이면 빈 목록, 이름 대소문자·공백 차이를 무시한다, 대체상품이 또 대체상품명을 가져도 한 단계까지만(결과에 이어 붙이지 않음).
- [ ] **Step 2: 실행해 실패 확인** — `./gradlew test --tests "*ProductAlternatesTest"`
- [ ] **Step 3: 구현** — 위 시그니처. 쿼리는 파라미터 바인딩, 이름 비교는 `lower()`.
- [ ] **Step 4: 통과** → **Step 5: 커밋** — `feat(backend): 마스터별 매물 후보·대체상품 조회`

### 작업 2. 양식·파서 (백엔드, trade)

**Files:**
- Create: `backend/src/main/java/com/company/market/trade/dto/CartBulkRowDto.java`, `.../service/CartBulkTemplate.java`, `.../service/CartBulkParser.java`
- Test: `backend/src/test/java/com/company/market/trade/service/CartBulkParserTest.java`

**Interfaces:**
- Produces: `CartBulkParser.HEADER_LABELS: List<String>`(상품명*, 제조사*, 분류번호, 상품ID, 수량*, 납품희망일*, 요청사항), `CartBulkParser.parse(InputStream): List<CartBulkRowDto>`(빈 줄 제외, 101줄 이상·헤더 불일치·`.xlsx` 아님은 `ValidationException(fields.file)`, 헤더는 이름으로 찾아 열 순서가 바뀌어도 읽음), `CartBulkParser.MAX_ROWS = 100`, `CartBulkTemplate.build(): byte[]`(헤더만). 판매 `ListingBulkParser` 와 같은 셀 변환을 쓰되 코드는 따로 둔다(`cellText` 를 복사하고 출처를 주석에 남긴다).

- [ ] **Step 1: 실패하는 테스트** — 양식 헤더대로 읽는다, 날짜 셀은 `YYYY-MM-DD`, 숫자 셀 `1000.0` 은 `"1000"`, 빈 줄은 건너뛰고 `rowNo` 는 엑셀 행 번호, 헤더 순서가 바뀌어도 읽는다, 헤더 빠짐·101줄·엑셀 아닌 파일은 거절, `build()` 결과를 `parse` 하면 줄 없음.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과**
- [ ] **Step 5: 커밋** — `feat(backend): 대량구매 엑셀 양식·파서`

### 작업 3. 줄 검사·매물 대조 (백엔드, trade)

**Files:**
- Create: `.../dto/CartBulkRowResult.java`(+ `ListingOption`, `Alternative` 중첩 record), `.../service/CartBulkService.java`(`check`)
- Test: `backend/src/test/java/com/company/market/trade/service/CartBulkServiceTest.java`(Testcontainers)

**Interfaces:**
- Consumes: 작업 1 의 `ListingService.snapshotsOfProduct`·`replaceHints`·`ProductService.alternatesOf`·`findSameIgnoreCase`·`search`·`find`, `TradeInputRules`(수량·납품희망일 규칙. package-private 이라 같은 `trade.service` 패키지에서 쓴다).
- Produces: `CartBulkService.check(UUID buyerId, List<CartBulkRowDto> rows): CartBulkCheckResult`(= `results` + 지금 장바구니 줄 수·한도 100). `ListingOption.reason` 사유 문구(재고 부족 `재고(N)보다 많아요` · `최소주문량(N) 이상…` · `주문단위(N)의 배수…` · `내 매물이에요` · `거래가 끝났어요`)는 `TradeInputRules`·`CartService` 와 같은 문구를 쓴다.

- [ ] **Step 1: 실패하는 테스트** — 정확히 찾은 마스터의 매물 후보가 나오고 재고 충분한 최저가가 기본으로 골라진다(동가면 재고 많은 것·빠른 등록일), 못 사는 매물은 사유와 함께 `options` 에 남고 기본값으로는 안 뽑힌다(재고 부족·최소주문량·주문단위·내 매물·거래완료 각각), 살 수 있는 매물이 하나도 없으면 `UNAVAILABLE`, 마스터가 없으면 `FAILED`(`fields.prodName` 사유)+이름 후보, 대체상품명이 있고 매물 없음이면 `alternatives` 에 대체 마스터의 살 수 있는 매물, 대체품은 자동으로 골라지지 않는다, 고른 매물(`sellerId/regDate`)이 후보·대체 후보에 있고 살 수 있으면 그대로 `chosen`(대체 후보면 `substituted=true`), 후보에 없거나 못 사면 `fields.listing` 사유 + `FAILED`(교체 안 함), 수량·납품희망일 규칙(최소주문량·주문단위와 별개로 형식·범위·오늘 이후), 파일 안 중복(둘째 줄 실패), 0줄·101줄 거절, 줄 번호 겹침 거절, 응답에 이메일·전화 없음.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과**
- [ ] **Step 5: 커밋** — `feat(backend): 대량구매 줄 검사·매물 대조`

### 작업 4. 담기 확정 (백엔드, trade)

**Files:**
- Modify: `CartBulkService.java`(`commit`)
- Test: `CartBulkServiceTest.java` 또는 `CartBulkCommitTest.java`

**Interfaces:**
- Produces: `CartBulkService.commit(UUID buyerId, List<CartBulkRowDto> rows): CartBulkCommitResult`(= `results: [{ rowNo, ok, code?, message? }]` + 담은 뒤 장바구니 줄 수). 줄마다 먼저 `check` 와 같은 검사로 고른 매물을 확인하고(못 사면 그 줄 실패), `CartService.add(buyerId, CartAddRequest(items=[한 줄]))` 를 줄마다 한 번씩 부른다(트랜잭션 없이 부르는 쪽에서 — 호출마다 자기 트랜잭션). 대체품(`substituted`)이면 요청사항에 `원래 요청: <줄의 상품명>` 을 덧붙이고 100자에 맞춰 사용자 글을 앞에서 자른다. 한 줄의 실패(`ApiException`·`ValidationException`)는 잡아 그 줄 결과로 바꾸고 계속한다. 응답 줄 수는 입력과 같다.

- [ ] **Step 1: 실패하는 테스트** — 전부 담기고 장바구니 줄이 생기며 재고가 묶인다(단가는 매물 단가, 수량·납품희망일·요청사항 그대로), 한 줄이 틀려도 나머지는 담긴다(부분 성공), 같은 매물을 고른 두 줄은 앞 줄이 묶은 재고를 뒤 줄이 보고 실패한다, 장바구니가 중간에 가득 차면 이후 줄이 `CART_FULL`, 고른 매물이 그 사이 팔려 있으면 그 줄만 실패, 대체품 줄은 요청사항에 "원래 요청"이 붙고 100자를 안 넘는다(앞 글만 잘림), 다른 사용자 이름으로는 담기지 않는다(인증 정보), 줄 번호가 입력과 같다.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과**
- [ ] **Step 5: 커밋** — `feat(backend): 대량구매 담기 확정(줄마다·부분 성공)`

### 작업 5. 컨트롤러·API·문서 (백엔드)

**Files:**
- Create: `backend/src/main/java/com/company/market/trade/controller/CartBulkController.java`, `.../dto/CartBulkRowsRequest.java`(`rows` 1~100)
- Test: `backend/src/test/java/com/company/market/trade/controller/CartBulkApiTest.java`
- Create: `bruno/cart/bulk-template.bru`, `bulk-parse.bru`, `bulk-check.bru`, `bulk-commit.bru`
- Modify: `docs/security.md`(엑셀 대량구매 항목: 100줄·10MB·xlsx·원본 미보관·인증·부분 성공·응답에 개인정보 없음)

**Interfaces:** `GET /api/v1/cart/bulk/template`, `POST /api/v1/cart/bulk/parse`(multipart `file` → `{ rows, results, cart }`), `POST /api/v1/cart/bulk/check`·`/commit`(`{ rows }`). 파일 검사·파싱은 서비스가 한다(컨트롤러에 try-catch·로직 없음). `CartBulkRowDto` 의 글자 칸에 `@Size`·`rowNo @Positive` 를 둔다.

- [ ] **Step 1: 실패하는 테스트** — 정상(`parse → check → commit`), 로그인 없이 네 개 모두 401, `.xlsx` 아님·헤더 불일치·101줄·줄 0개는 400, 응답에 이메일·전화 없음, 구매자 본인 장바구니에만 담김.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과** (`./gradlew test --tests "*CartBulk*"`)
- [ ] **Step 5: 커밋** — `feat(backend): 대량구매 API 와 Bruno 요청`

### 작업 6. 프론트 로직

**Files:**
- Create: `frontend/src/types/cartBulk.ts`, `frontend/src/lib/validation/buyBulk.ts`, `frontend/src/lib/buyBulk.ts`(줄 상태 reducer), `frontend/src/lib/buyBulkView.ts`(탭·검색·정렬), `frontend/src/lib/buyBulkStorage.ts`, `frontend/src/messages/buyBulk.ts`
- Modify: `frontend/src/lib/api/cart.ts`(또는 새 `cartBulk.ts`; 기존 `lib/api/cart.ts` 이름 확인 후) — 네 호출, `frontend/src/lib/api/auth.ts`(로그인·로그아웃 때 이 보관본도 비움)
- Test: 각 파일의 `*.test.ts`

**Interfaces:**
- Produces: `buyBulkReducer`(액션: `loaded`·`restored`·`edited`·`checking`·`rechecked`·`toggled`·`selectVisible`·`picked`(상품 후보·상품 찾기)·`chose`(다른 매물)·`substituted`(대체품으로 바꾸기)·`committed`(결과 줄별 ok/실패)), 선택자 `summary`·`canSelect`·`selectedRows`, `visibleLines`·`tabCounts`·`nextSortFor`(탭 `all|available|unavailable|failed|done`, 정렬 키: 행·상품명·제조사·수량·단가(고른 매물)·상태), `saveBuyBulk/loadBuyBulk/clearBuyBulk`(키 `market.buyBulk.v1`, 보관본 모양을 엄격히 검사).

- [ ] **Step 1: 실패하는 테스트** — zod(수량 경계 1/100000·쉼표, 납품희망일 형식·오늘 이후, 요청사항 100자, 상품명·제조사는 `prodId` 가 있으면 비워도 됨), reducer(올리면 매물 있음 줄만 체크, 오류·매물 없음 줄은 체크 불가, 칸을 고치면 서버 오류가 지워지고 검사 중엔 체크 불가, 다른 매물 고르기·대체품으로 바꾸기가 줄의 `chosen` 과 `substituted` 를 바꾸고 재검사 대상이 됨, 마스터를 고르면 상품 칸 잠금·직접 입력으로 풀기, 담김은 줄을 지우지 않고 수정·체크 막음, 보이는 줄만 선택), view(탭·검색·정렬·편집해도 순서 불변은 호출하는 쪽 규칙), storage(왕복·깨진 값·다른 버전·칸 빠진 값은 버리고 지움·저장 예외 삼킴·`checking` 은 읽을 때 풂).
- [ ] **Step 2: 실행해 실패 확인** — `pnpm exec vitest run src/lib/buyBulk*.test.ts src/lib/validation/buyBulk.test.ts`
- [ ] **Step 3: 구현** → **Step 4: 통과 + `pnpm typecheck && pnpm lint`**
- [ ] **Step 5: 커밋** — `feat(frontend): 대량구매 줄 상태·검사 규칙·보관`

### 작업 7. 페이지·팝업·연결·문서 (프론트)

**Files:**
- Create: `frontend/src/app/buy/bulk/page.tsx`, `frontend/src/components/buy/BuyBulkView.tsx`(드롭존·탭·검색·정렬·확정), `frontend/src/components/buy/BuyBulkRows.tsx`(표 줄·카드), `frontend/src/components/buy/ListingOptionDialog.tsx`(다른 매물 보기)
- Modify: `frontend/src/lib/tileScreens.ts`·`tileScreens.test.ts`(`{ id: "buyBulk", group: "buy", pattern: /^\/buy\/bulk$/ }`), `frontend/src/components/home/QuickMenu.tsx`·`frontend/src/components/common/AppLauncher.tsx`(`buyBulk` 를 링크로, 준비 중 안내 제거), `docs/design.md`(화면 모양), `docs/decisions.md`(2026-11-09 항목)

**동작:** 설계 절의 화면 규칙을 따른다. `ProductSearchDialog`(판매 쪽에서 만든 독립 팝업)를 [상품 찾기]에 재사용한다. 줄 카드: 머리(체크·행 번호·배지) / 상품 칸 / 수량·납품희망일·요청사항 / 고른 매물 요약(판매자 별명·단가·재고·납기, [다른 매물 보기]) / 대체 후보 칩([대체품으로 바꾸기]) / 사유. 새 화면 체크리스트(frontend.md): ① 화면 표 등록 ② 코드 이동 `useTileOpen`([장바구니 열기]·내 장바구니) ③ 앱 메뉴 항목 `data-tile-from-home` ④ 헤더·주기능에서 직접 열기·새로고침 복원 ⑤ 3분할 오른쪽 아래 칸(960×500, 640×330)에서 잘림 없음 ⑥ E2E 의 iframe·URL 기대는 칸 규칙대로. 결과 보고에 확인한 배치를 적는다.

- [ ] **Step 1: `tileScreens.test.ts` 에 새 화면 케이스를 먼저 추가해 실패 확인**
- [ ] **Step 2: 표 등록 + 페이지·컴포넌트 구현**
- [ ] **Step 3: 홈 아이콘·앱 메뉴 링크로 교체**
- [ ] **Step 4: 화면 확인** — 넓은 칸·아주 넓은 칸·390px·3분할 칸, 100줄 파일로 스크롤·탭·검색·정렬.
- [ ] **Step 5: `pnpm typecheck && pnpm lint && pnpm test`**
- [ ] **Step 6: 커밋** — `feat(frontend): 엑셀 대량구매 페이지(매물 대조·대체품 제안)`, 문서는 `docs:` 별도 커밋.

### 작업 8. E2E·마무리

- [ ] `frontend/e2e/bulk-purchase.spec.ts` 1개(핵심 흐름만): 판매자 가입·상품 등록 → 구매자 가입 → `/buy/bulk` 에서 엑셀(매물 있음 · 마스터 없음 · 수량 0 오류) 올림 → 탭 확인 → 오류 줄 고치기 → 선택 확정 → 담김 탭 → 장바구니에 줄이 있음. 이 spec 하나만 1번(`E2E_BASE_URL` 사용, 시간 초과는 재실행 1번). **E2E 가 값어치 대비 비싸다는 의견이 있었으므로 이 spec 은 승인 때 뺄 수 있다**(빼면 단위·API 테스트와 직접 확인으로 대신).
- [ ] `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `git grep` 으로 실제 IP·호스트 없음 확인.
- [ ] `feat/bulk-purchase` 푸시 → PR(본문: 무엇을·왜·확인 방법·"대체품은 데이터가 비어 거의 안 뜸"·"내가 정한 것" 명시) → `/code-review` 1회 → 반영 → 재검사 → 보고. 머지는 사용자가 한다.
