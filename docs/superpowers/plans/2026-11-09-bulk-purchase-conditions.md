# 대량구매 조건 열과 정확한 상품 찾기 (2026-11-09)

> **구현 방식:** CLAUDE.md "중간 크기 기능" — 이 파일 하나가 설계+계획. 승인 뒤 직접(native) 구현, PR 에서 `/code-review` 한 번(새 커밋 범위만). 브랜치 `feat/bulk-purchase`(PR #135 에 이어서). 바탕 계획: `2026-11-09-bulk-purchase-excel.md`.

**Goal:** 엑셀 대량구매가 "최저가 하나 자동 선택" 대신, 구매자가 줄마다 적은 **조건**(상태·단가·보증·제공가능일·증빙)으로 매물을 거르고, 통과한 매물 중에서 정해진 기준으로 하나를 고른다. 상품 찾기는 사용자가 모르는 분류번호·상품ID 없이도 **하나로 정해질 때만 자동**으로 정한다(여럿이면 묻는다).

**Architecture:** 서버는 여전히 줄 상태를 저장하지 않는다. 줄 DTO 에 조건 칸이 늘고, `CartBulkService` 의 매물 후보 판정(`reasonOf`)이 조건까지 본다 — 조건에 안 맞으면 **못 사는 사유**가 붙어 회색으로 남는다(지금 재고 부족 등과 같은 방식). 기본 매물 선택(`defaultPick`)은 화면에서 정한 정렬 기준을 받는다. **새 라이브러리·DB 변경 없음.**

## 설계

### 정해진 것 (사용자 확인, 2026-11-09)

- 조건은 **거르는 것**, 정렬은 **고르는 것**이다. 조건을 모두 통과한 매물 중에서 하나를 기본으로 고르고, 통과한 매물이 없으면 "매물 없음"이며 사유(어떤 조건에서 막혔나)가 회색 후보 줄에 남는다. 사용자가 조건 칸을 고치면 다시 검사된다.
- 항상 걸리는 것: 거래 중(거래완료 아님)·재고가 요청 수량 이상·최소주문량·주문단위(지금 규칙 그대로). 재고가 요청 수량보다 적으면 못 사는 매물이고 "재고(N)가 수량보다 적어요"로 표시한다(지금 구현).
- 줄마다 적는 조건(모두 선택, 비우면 조건 없음):
  - **최소 상태**: 상품상태 7단계(신품 → 신품대비 90~99% → … → 50% 미만) 중 고른 단계 **이상**.
  - **단가 상한**: 매물 등록단가가 이 값 **이하**.
  - **최소 보증(개월)**: 1·3·6·12·24·36 중 하나. 매물 보증기한(일 단위 30·90·180·360·720·1080)이 그 개월 수에 해당하는 일수 **이상**. 보증 없는(null) 매물은 조건이 있으면 탈락.
  - **제공가능일**: 매물 제공가능일이 납품희망일 **이전이거나 같아야** 한다. 희망일보다 늦게 줄 수 있는 매물은 못 산다.
  - **증빙 필수**: 데이터시트·사진·불량지원방법·테스트리포트·정품인증서 — 칸에 `Y` 라고 쓴 것만 "있어야 함", 비우면 상관없음. 값의 내용이 아니라 **있는지만** 본다. (대체품은 이번 범위에서 뺐다 — 사용자 결정 2026-11-09)
- 정렬(통과한 매물 중 기본 선택): 단가 낮은 순 → 보증 긴 순 → 상태 좋은 순 → 제공가능일 빠른 순 → 재고 많은 순 → 등록일시 빠른 순. 페이지 위 선택지(**최저가 우선 / 상태 우선 / 보증 우선**, 기본 최저가)가 앞쪽 순서만 바꾼다(상태 우선 = 상태 → 단가 → 보증…, 보증 우선 = 보증 → 단가 → 상태…). 줄마다 정렬을 따로 두지 않는다.
- 상품 찾기: 상품ID 가 있으면 그 마스터. 없으면 이름+제조사가 같은(대소문자·공백·하이픈 무시) 마스터를 찾는다 — **분류번호가 비어 있으면 분류번호는 보지 않고**, 적혀 있으면 지금처럼 같아야 한다. 결과가 **정확히 하나면 자동으로 정하고**, 둘 이상이면 자동으로 고르지 않고 후보 칩으로 사용자가 고르게 한다(줄 오류 "같은 이름의 상품이 여럿이에요"). 없으면 지금처럼 이름이 겹치는 후보 칩. 제조사는 **선택**으로 낮춘다(비우면 이름만으로 찾고, 여럿이면 선택).
- 판매 쪽 "같은 상품" 규칙(이름·제조사·분류번호)과 판매 다량 등록은 **바꾸지 않는다**. 구매는 새로 만들 수 없고 찾아야만 해서 여기만 느슨하다.

### 내가 정한 것 (승인 때 확인)

1. **제공가능일 비교의 기준**: 지금 시스템은 장바구니·구매에서 제공가능일과 납품희망일을 비교하지 않는다(납품희망일은 "오늘 이후"만 검사). 이 비교는 **대량구매에만 새로 생기는 규칙**이고 장바구니 화면에서 같은 매물을 직접 담을 땐 안 걸린다. 매물 제공가능일 칸은 DB 에서 not null 이라 "비어 있음"은 없고, 날짜 형식이 아닌 레거시 글(예: 협의)은 비교할 수 없어 통과시킨다.
2. **대체품은 이번 범위 밖**(사용자 결정): 엑셀에 대체품 열을 만들지 않고, 매물 `replace_prod` 글도 조건으로 보지 않는다. 이미 구현된 **대체 마스터 제안**(대체상품명 일치, [대체품으로 바꾸기]를 눌러야 선택)은 코드를 건드리지 않고 그대로 둔다 — 대체상품명 데이터가 비어 있어 지금은 뜨지 않는다. 그 제안의 매물도 같은 `reasonOf` 를 지나므로 위 조건이 자동으로 적용된다(추가 작업 없음). 대체품 데이터 입력(판매 엑셀 열·등록 폼의 상품 찾기로 고르기)과 ID 연결은 별도 계획.
3. **조건은 매물 사유로 표현**: 조건에 안 맞는 매물은 `ListingOption.reason` 에 첫 번째 사유가 들어가 선택 불가가 된다(지금 재고 부족과 같음). 사용자가 후보 팝업에서 직접 골라도 조건을 어기는 매물은 못 고른다 — 정확성이 목적이므로 우회 버튼을 두지 않고, 조건 칸을 비우거나 고치게 한다.
4. **엑셀 열**: 기존 7개(상품명*, 제조사, 분류번호, 상품ID, 수량*, 납품희망일*, 요청사항) + 새 8개(최소상태, 단가상한, 최소보증(개월), 데이터시트, 사진, 불량지원, 테스트리포트, 정품인증서). 제조사의 `*` 는 사라진다. 헤더는 이름으로 찾으므로 새 열이 없는 **옛 양식 파일도 그대로 읽힌다**.
5. **화면**: 줄 카드에 접이식 "조건" 구역(기본은 접힘, 조건이 하나라도 있으면 요약 배지 + 펼침). 페이지 위에 정렬 기준 선택. 조건 칸의 검증은 프론트 zod 와 백엔드가 같은 수치(상태는 목록, 단가 1~1,000,000,000(매물 등록단가 최대와 같음), 보증은 개월 목록, 증빙은 Y/빈칸).
6. **판정 위치**: 조건 판정은 `trade.service` 의 package-private `CartBulkConditions` 로 분리해 `CartBulkService` 가 커지지 않게 한다. 매물의 상태·보증·증빙 값은 `ListingTradeSnapshot` 에 칸을 늘리지 않고(거래가 복사해 가는 값이라 영향이 큼) `ListingService.traitsOf(ids)` 가 별도 record(`ListingTraits`)로 돌려준다 — 기존 `replaceHints` 와 같은 방식. 상태 단계 순서는 `listing` 쪽 한 곳(`ProdStates`)에 두고 trade 가 service 를 통해 쓴다.
7. **이번 범위 밖**: 상품 찾기 모달에 줄의 상품명을 미리 채워 여는 것(모달 개선 PR #136 머지 뒤), 판매 다량 등록의 유사 마스터 후보 제안, 장바구니·지난 구매를 양식으로 내려받기, 오타 유사 검색(`pg_trgm`). 각각 따로 계획한다.

### 영향 검토

- 줄 DTO(`CartBulkRowDto`)에 칸이 늘어 API 요청·응답 모양이 바뀐다 — 프론트 타입·저장본(`sessionStorage` 키 버전 올림: 옛 보관본은 버린다)·Bruno 요청을 같이 바꾼다. 옛 필드는 그대로라 호환.
- 정렬 기준이 `check`/`commit` 요청에 들어간다(`CartBulkRowsRequest.sort`, 없으면 최저가 우선). 미리 본 기본 매물과 담는 매물이 같도록 두 호출에 같은 값을 보낸다.
- 조건 판정에 필요한 매물 값은 마스터별 매물을 한 번에 읽는 기존 흐름에 `traitsOf` 한 번을 더한다(줄당 조회 +1). 측정 전 최적화 안 함.
- `CartService`·`TradeService`·검색·판매 다량 등록은 안 건드린다. 상품 찾기 변경은 `ProductRepository`/`ProductService` 에 구매 전용 조회 메서드를 **추가**하는 것이고 판매 쪽 `findSame` 계열은 그대로다.
- 개인정보: 응답에 새로 나가는 값은 상태·보증·증빙 유무뿐(파일 키·URL 없음).

## Global Constraints

- 문구는 `frontend/src/messages/buyBulk.ts` 에. 입력 검증 두 층(프론트 zod ↔ 백엔드 같은 수치). 새 오류 코드는 필요 없음(줄 `fields` 로 표시).
- 새 API 가 아니라 기존 4개의 요청·응답 변경 → `bruno/cart/bulk-*.bru` 갱신, 기존 테스트 갱신 + 조건별 테스트 추가. `docs/security.md`(엑셀 대량구매 항목)·`docs/decisions.md`·`docs/design.md` 갱신.
- UTF-8(BOM 없음), CRLF 파일은 필요한 줄만 국소 수정. 실제 IP·호스트 금지. 새 의존성 금지.

## Review Focus

1. **상태 순서 경계**: "신품대비 50% 미만"을 최소로 쓰면 조건 없음, "신품"이면 신품만. 알 수 없는 값은 줄 오류. (작업 1·3)
2. **보증 null/0**: 최소 보증 조건이 있으면 null·0일 매물은 탈락, 조건이 없으면 상관없음. 개월 → 일수 변환이 선택 목록(30/90/180/360/720/1080)과 정확히 맞는지(12개월 = 360일). (작업 3)
3. **제공가능일 경계**: 같은 날은 통과, 하루 늦으면 탈락, null 은 통과. (작업 3)
4. **조건 때문에 전부 탈락**: 마스터는 있는데 통과 매물 0 → `UNAVAILABLE` + 사유가 후보 줄에 남음. 조건을 지우면 다시 `AVAILABLE`. (작업 3)
5. **사용자가 고른 매물이 조건 위반**: 서버가 다른 매물로 바꾸지 않고 `fields.listing` 사유. (작업 3)
6. **이름이 같은 마스터 여럿**: 자동으로 고르지 않고 후보 칩, 분류번호가 적혀 있으면 그것으로 하나로 좁혀짐. (작업 2)
7. **정렬 기준 변경**: 같은 입력에서 최저가/상태/보증 우선이 서로 다른 매물을 고르고, check 와 commit 이 같은 매물을 담는다. (작업 3·4)
8. **옛 양식·옛 보관본**: 새 열 없는 파일이 읽히고, 옛 보관본은 깨지지 않고 버려진다. (작업 4·5)

---

## 작업

### 작업 1. 매물 특성 조회와 상태 순서 (백엔드, listing)

**Files:** Create `listing/service/ProdStates.java`(7단계 목록·순서 비교), `listing/dto/ListingTraits.java`; Modify `ListingService`(`traitsOf(Collection<ListingId>): Map<ListingId, ListingTraits>`), 필요하면 `ListingRepository` 조회; Test `ListingTraitsTest`, `ProdStatesTest`.

**Interfaces:** `ListingTraits(String prodState, Integer warrantyDays, boolean hasDataSheet, hasPhoto, hasWarrantyCoverage, hasTestReport, hasCertificate)` — 값은 유무만(파일 키·URL 없음). `ProdStates.rank(String): int`(알 수 없으면 -1), `ProdStates.LABELS`(화면·템플릿과 같은 순서).

- [ ] **Step 1: 실패하는 테스트** — 매물별 유무가 정확히 나온다(사진은 1~4 중 하나라도, 빈 글은 없음), 보증 null 이 그대로, 7단계 순서·알 수 없는 값 -1.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현** → **Step 4: 통과** → **Step 5: 커밋** `feat(backend): 매물 특성(상태·보증·증빙 유무) 조회`

### 작업 2. 상품 찾기: 유일할 때만 자동 (백엔드)

**Files:** Modify `ProductRepository`(이름[+제조사][+분류번호] 정규화 일치 목록), `ProductService`, `CartBulkService.checkOne`; Test `ProductServiceMatchTest`, `CartBulkServiceTest`(갱신).

**Interfaces:** `ProductService.findAllByNameBrandIgnoreCase(name, brand|null, classNo|null): List<Product>` — 비교 시 소문자·공백·하이픈 제거, `brand`/`classNo` 가 null 이면 그 칸은 안 본다. 하나면 자동, 여럿이면 줄 `FAILED`(`fields.prodName` "같은 이름의 상품이 여럿이에요…") + `candidates`(최대 5, 지금 `Candidate`), 없으면 지금처럼 이름 겹침 후보.

- [ ] **Step 1: 실패하는 테스트** — 분류번호 비움 + 마스터 하나 → 자동, 둘 → 후보(자동 안 함), 분류번호를 적으면 좁혀짐, 제조사 비움 + 이름 하나 → 자동·여럿 → 후보, `R740`/`R-740`/` r 740 ` 정규화, 제조사만 다르면 자동 안 함, 상품ID 가 있으면 그대로.
- [ ] **Step 2~5**: 실패 확인 → 구현 → 통과 → 커밋 `feat(backend): 대량구매 상품 찾기를 이름 기준 유일 일치로`

### 작업 3. 조건 판정과 정렬 (백엔드, trade)

**Files:** Create `trade/service/CartBulkConditions.java`(파싱·검증·판정·정렬 비교자); Modify `CartBulkRowDto`(조건 9칸 추가: `minState, maxPrice, minWarrantyMonths, needDataSheet, needPhoto, needCoverage, needTestReport, needCertificate`), `CartBulkRowsRequest`(`sort`), `CartBulkService`(`reasonOf` 가 조건 사유 반영, `defaultPick(options, sort)`), `CartBulkRowResult`(`ListingOption` 에 상태·보증일·증빙 유무를 보임용으로 추가); Test `CartBulkConditionsTest`, `CartBulkServiceTest`.

**Interfaces:** `CartBulkConditions.of(row, fields): Conditions`(형식 오류는 칸 이름으로 `fields` 에: `minState`·`maxPrice`·`minWarrantyMonths`·`need*`), `Conditions.failure(snapshot, traits, reqDeliDate): String|null`(첫 사유 문구: "상태가 조건(…)보다 낮아요", "단가가 상한(…원)을 넘어요", "제공가능일(…)이 납품희망일보다 늦어요", "보증기한이 조건(N개월)보다 짧아요", "데이터시트가 없어요" …; 대체품 조건은 없음), `Sort { PRICE, STATE, WARRANTY }` + `comparator()`. 사유 우선순위: 거래완료 → 내 매물 → 수량 규칙 → 재고 → 조건(상태·단가·보증·제공가능일·증빙 순).

- [ ] **Step 1: 실패하는 테스트** — 설계의 모든 조건을 경계 포함해 각각(상태 단계, 단가 같음/초과, 보증 12개월=360일·null·0, 제공가능일 같은 날/하루 늦음/null, 증빙 각 Y), 조건 전부 통과한 것 중 정렬 3종이 서로 다른 매물을 고름, 통과 0 → `UNAVAILABLE` + 사유, 조건을 지우면 `AVAILABLE`, 고른 매물이 조건 위반이면 `fields.listing`, 대체 후보 매물에도 같은 조건, 조건 칸 형식 오류(알 수 없는 상태·0 이하 단가·목록 밖 보증 개월·`Y` 아닌 증빙 값)는 그 칸 오류, 조건이 모두 비면 지금 동작과 같음(회귀).
- [ ] **Step 2~5**: 실패 확인 → 구현 → 통과 → 커밋 `feat(backend): 대량구매 조건 판정과 정렬 기준`

### 작업 4. 양식·파서·API (백엔드)

**Files:** Modify `CartBulkParser`(새 열은 **선택** 헤더, 제조사의 `*` 제거, `HEADER_LABELS` 갱신, 증빙 칸 `Y/y/예` 정규화는 하지 않고 서버 검증이 판단), `CartBulkTemplate`(새 열 + 상태·`Y` 드롭다운 검증), `CartBulkController`/`CartBulkRowsRequest`(`sort`), `bruno/cart/bulk-*.bru`, `docs/security.md`; Test `CartBulkParserTest`, `CartBulkTemplateTest`, `CartBulkApiTest`(갱신).

- [ ] **Step 1: 실패하는 테스트** — 새 열이 있는 양식을 읽는다, 새 열이 없는 옛 양식도 읽는다, `build()` 결과 헤더·드롭다운, `sort` 가 없으면 최저가·알 수 없는 값은 400, 세 호출 모두 `sort`·조건을 받는다.
- [ ] **Step 2~5**: 실패 확인 → 구현 → 통과(`./gradlew test --tests "*CartBulk*"`) → 커밋 `feat(backend): 대량구매 양식·API 에 조건 열과 정렬 기준`

### 작업 5. 프론트 로직

**Files:** Modify `types/cartBulk.ts`, `lib/validation/buyBulk.ts`, `lib/buyBulk.ts`(줄에 조건, `toCheckRow/toCommitRow`, 조건 편집 액션), `lib/buyBulkStorage.ts`(키 버전 올림), `lib/api/cartBulk.ts`(`sort`), `messages/buyBulk.ts`; Test 각 `*.test.ts`.

- [ ] **Step 1: 실패하는 테스트** — zod(상태 목록·단가 범위·보증 개월 목록·증빙 Y/빈칸·제조사 선택), reducer(조건을 고치면 서버 오류가 지워지고 재검사 대상, 상품 후보 칩을 누르면 `prodId` 가 채워짐), storage(옛 버전 버림), 요청 변환에 조건·`sort` 포함.
- [ ] **Step 2~4**: 실패 확인 → 구현 → 통과 + `pnpm typecheck && pnpm lint` → **Step 5 커밋** `feat(frontend): 대량구매 조건 칸과 정렬 기준 상태`

### 작업 6. 프론트 화면

**Files:** Modify `components/buy/BuyBulkRows.tsx`(줄 카드의 접이식 "조건" 구역 + 요약 배지, 후보 칩 안내 문구), `BuyBulkView.tsx`(정렬 기준 선택, 안내 문구), `ListingOptionDialog.tsx`(후보 줄에 상태·보증·증빙 표시와 조건 사유), `docs/design.md`, `docs/decisions.md`(2026-11-09 항목: 조건 열·유일 일치·제공가능일 새 규칙).

- [ ] **화면 확인**: 넓은 칸·아주 넓은 칸·390px·3분할 오른쪽 아래 칸(960×500, 640×330)에서 조건 구역이 잘리지 않음, 모달 안은 `md:` 변형(컨테이너 쿼리 금지), 빈·로딩·오류 상태.
- [ ] **Step: `pnpm typecheck && pnpm lint && pnpm test`** → 커밋 `feat(frontend): 대량구매 줄 조건 구역과 정렬 기준 선택`, 문서 `docs:` 별도 커밋.

### 작업 7. 테스트 파일·E2E·마무리

- [ ] 테스트용 `대량구매_테스트.xlsx` 를 새 양식으로 다시 만든다(개발 DB 실제 마스터, 조건 있는 줄·재고 부족 줄·이름이 여럿인 줄 포함).
- [ ] `frontend/e2e/bulk-purchase.spec.ts` 는 **삭제**한다(E2E 값어치 대비 비용이 크다는 판단, 2026-11-09). 단위·API 테스트와 화면 직접 확인으로 대신한다. 삭제 전 `git grep` 으로 spec 을 가리키는 문서·CI 설정이 없는지 본다.
- [ ] `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `git grep` 으로 IP·호스트 없음.
- [ ] 푸시(PR #135 갱신, 본문에 "조건 열·유일 일치·새 규칙(제공가능일 비교)" 추가) → `/code-review` 1회(새 커밋 범위) → 반영 → 재검사 → 보고. 머지는 사용자가 한다.
