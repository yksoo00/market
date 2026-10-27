# PR 1 — FK 삭제·정의서 복합키·거래 컬럼 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DB 의 FK 8개를 없애고 `trd_prod_reg`·`trd_trade_info`·`trd_trade_history` 를 정의서 PK·컬럼·NOT NULL 로 맞춘 뒤, FK 가 하던 일(매물 삭제 막기)과 새 규칙(같은 초 등록 409, 제공가능일·납품희망일 필수)을 코드로 옮긴다.

**Architecture:** Flyway 마이그레이션 4개 + JPA 매핑 변경. API 경로·응답 칸 이름은 그대로(`regDate` 는 계속 매물 등록일시). 거래 → 매물은 `ListingId(userId, regDate, prodId)` 세 값으로 찾는다. 매물 삭제 막기는 기존 `ListingDeletingEvent` 리스너가 맡는다(매물 → 거래 직접 호출 없음).

**Tech Stack:** Spring Boot 4.1, JPA, Flyway, PostgreSQL 16, Testcontainers / Next.js 16, zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-definition-realign-design.md` "PR 1" 절.

## Global Constraints

- 브랜치 `db/definition-keys`, git worktree 에서. 엔티티가 바뀌지 않으면 앱이 뜨지 않으므로 코드도 같은 브랜치.
- 마이그레이션 `V{YYYYMMDDHHMM}__{설명}.sql`, 한 파일 한 목적, 상단에 무엇·왜·되돌리기 주석. 인덱스는 일반 `create index`(concurrently 금지 — Flyway 잠금에 멈춤).
- 운영 배포 전이라 컬럼 이름 변경·NOT NULL 을 배포 1회로 한다(무중단 예외, Task 5 에서 decisions.md 기록).
- API 경로·응답 칸 이름 바꾸지 않는다. 요청 본문은 견적 항목에 `reqDeliDate` 추가만.
- 사용자ID 는 uuid. 테이블명 `trd_prod_reg` 유지.
- 프론트·백엔드 검증 같은 규칙. 사용자 문구는 `frontend/src/messages/`. 주석·커밋·문서 한국어.
- 작업 중 테스트는 바꾼 영역만(`./gradlew test --tests ...`, `pnpm exec vitest run <파일>` + `pnpm typecheck && pnpm lint`). 전체 `./gradlew check` 와 E2E 는 Task 5 에서 1번.

## Review Focus

1. 기존 개발 DB 데이터: 제공가능일 없는 매물, 납품희망일 없는 견적 행이 마이그레이션 뒤 채워져 앱이 그대로 뜬다 → Task 1 `DefinitionKeysMigrationTest`.
2. 탭 두 개에서 같은 사용자가 같은 초에 다른 상품 등록 → 두 번째는 409, 매물 주소는 계속 하나로 열린다 → Task 2.
3. 장바구니·견적 행만 있는 매물 삭제는 성공, 구매요청·구매확정 행이 있으면 409 — FK 없이 → Task 1.
4. 장바구니에 같은 매물 다시 담기가 새 부분 unique(`prod_id` 포함)와 `on conflict` 대상이 맞아 SQL 오류 없이 건너뛴다 → Task 1 (기존 `CartApiTest` 중복 담기).
5. 견적 재요청이 납품희망일도 새 값으로 덮어쓴다 → Task 4.

---

### Task 1: 마이그레이션 + 매핑 + 매물 삭제 막기

**Files:**
- Create: `backend/src/main/resources/db/migration/V202610271000__drop_foreign_keys.sql`
- Create: `backend/src/main/resources/db/migration/V202610271010__prod_reg_definition_keys.sql`
- Create: `backend/src/main/resources/db/migration/V202610271020__trade_info_definition_columns.sql`
- Create: `backend/src/main/resources/db/migration/V202610271030__trade_history_definition_keys.sql`
- Modify: `listing/domain/ListingId.java`, `listing/domain/Listing.java`, `listing/repository/ListingRepository.java`, `listing/service/ListingService.java`, `listing/service/ListingDeletingEvent.java`, `listing/dto/ListingTradeSnapshot.java`
- Modify: `trade/domain/TradeInfo.java`, `trade/domain/TradeHistory.java`, `trade/domain/TradeHistoryId.java`, `trade/repository/TradeInfoRepository.java`, `trade/service/TradeService.java`, `trade/service/CartService.java`, `trade/service/TradeListingCleanup.java`
- Modify: `docs/data-model.md` (trd_prod_reg·trd_trade_info·trd_trade_history 표, FK 문구)
- Test: `backend/src/test/java/com/company/market/SchemaConstraintsTest.java`, 새 `DefinitionKeysMigrationTest.java`, 원시 SQL 로 `trd_trade_info`·`trd_trade_history` 에 넣는 기존 테스트 전부(`grep -rln "insert into trd_trade" backend/src/test`)

**Interfaces:**
- Produces: `ListingId(UUID userId, String regDate, String prodId)` + `@Getter`.
- Produces: `ListingTradeSnapshot.id(): ListingId`.
- Produces: `ListingRepository.findByUserIdAndRegDate(UUID, String): Optional<Listing>`, `existsByUserIdAndRegDate(UUID, String): boolean`, `findForUpdate(UUID userId, String regDate, String prodId)` 오버로드. `reserveStock`·`releaseStock` native 쿼리에 `and prod_id = :prodId`.
- Produces: `ListingService.lockForTrade(ListingId)`, `snapshotForTrade(ListingId)` 오버로드(거래 행에서 부를 때), `reserveStock(ListingId, int)`, `releaseStock(ListingId, int)`, `applyQuotePrice(ListingId, int)`. 요청 본문에서 부르는 `lockForTrade(UUID, String)`·`snapshotForTrade(UUID, String)` 는 유지(`findByUserIdAndRegDate` 사용).
- Produces: `ListingDeletingEvent(UUID sellerId, String regDate, String prodId)`.
- Produces: `TradeInfo` 필드 `prodRegDate`(`prod_reg_date`), `regDate`(`reg_date`, 거래 등록일시), 메서드 `listingId(): ListingId`. 빌더 인자 같은 이름.
- Produces: `TradeHistory` 필드 `userId`(구매자, `@Id`), `TradeHistoryId(UUID userId, String tradeId, String tradeDate)`.
- Produces: `TradeInfoRepository` 매물 범위 메서드 이름의 `RegDate` → `ProdRegDate`, 매물 조건에 `ProdId` 추가(`findByUserIdAndSellerIdAndProdRegDateAndProdIdAndTradeTypeAndTradeStatsIn`, `existsByUserIdAndSellerIdAndProdRegDateAndProdIdAndTradeStats`, `deleteCartRow(buyerId, sellerId, prodRegDate, prodId, stats)`, `deleteByListingAndTypeAndStats(sellerId, prodRegDate, prodId, type, stats)`), 새 `existsBySellerIdAndProdRegDateAndProdId(UUID, String, String): boolean`. `findSellerPage` 의 `regDate` 필터·`countBySellerGroupByListing` 묶음은 `prodRegDate`.

- [ ] **Step 1: 실패 테스트 — 스키마**
  `SchemaConstraintsTest` 를 고친다:
  - 삭제: `quoteRowWithoutReqDeliDate`, `listingWithTradeCannotBeDeleted`, `productCategoryForeignKey`.
  - `tradeIdUniqueAndHistoryForeignKey` → `"FK 가 없다 — 이력은 없는 거래를 가리켜도 저장된다"`: `select count(*) from information_schema.table_constraints where constraint_type = 'FOREIGN KEY' and table_name like 'trd_%'` = 0, 없는 거래ID 로 이력 insert 성공.
  - 새 `"trd_prod_reg PK 는 (user_id, reg_date, prod_id)"`: 같은 user·reg_date·다른 prod_id 두 행 insert 성공, 세 값 같으면 `DuplicateKeyException`.
  - 새 `"trd_trade_info 는 prod_reg_date·prov_date·req_deli_date NOT NULL"`: 각각 null insert → `DataIntegrityViolationException`.
  - 새 `"trd_trade_history PK 는 (user_id, trade_id, trade_date)"`: `information_schema.key_column_usage` 로 PK 컬럼 = `[user_id, trade_id, trade_date]`.
  - `oneCartRowPerListing`·`insertTrade`·`insertRow` 의 컬럼 `reg_date` → `prod_reg_date`, `prov_date`·`req_deli_date` 값 추가.
  새 `DefinitionKeysMigrationTest` (`@SpringBootTest` + `TestInfraConfiguration`, `DataSource` 주입, 스키마 `migtest`):
  - `Flyway.configure().dataSource(ds).schemas("migtest").locations("classpath:db/migration").target("202610211300").load().migrate()` 후 사용자·상품(카테고리 시드 코드 `P01-Q01-R001`)·매물 2개(하나는 `prov_date` null, `reg_date` `20261015100000`)·거래 2행(견적 행 `req_deli_date` null·`prov_date` null) 넣기 → `target` 없이 다시 `migrate()`.
  - `"제공가능일 없는 매물은 등록일로 채운다"`: `prov_date` = `2026-10-15`.
  - `"거래 행 prov_date·req_deli_date 는 매물 제공가능일로, reg_date 는 거래ID 앞 8자리로"`: 거래ID `26101510001` → `reg_date` = `20261015100000`, `prov_date`·`req_deli_date` = `2026-10-15`.
  - `"거래이력 buyer_id 는 user_id 로 옮겨진다"`.
  - 끝나면 `drop schema migtest cascade`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*SchemaConstraintsTest" --tests "*DefinitionKeysMigrationTest"` → FAIL.
- [ ] **Step 3: 마이그레이션 4개**
  - `1000`: 위 8개 FK `drop constraint`. 되돌리기 = 각 FK 다시 추가(V202609291000·V202610131520·V202610151000 의 정의).
  - `1010`: `prov_date` 백필 `to_char(to_date(substr(reg_date,1,8),'YYYYMMDD'),'YYYY-MM-DD')` → `set not null` / PK `drop constraint trd_prod_reg_pkey` → `add primary key (user_id, reg_date, prod_id)` / `rename column prod_coa to certificate_of_authenticity` / `min_order_quantity`·`order_unit` `drop not null`(default 1 유지).
  - `1020`: `rename column reg_date to prod_reg_date` → `set not null` / `add column reg_date varchar(14)` → `update ... set reg_date = '20' || substr(trade_id, 1, 8) || '0000'` / `prod_id type varchar(50)` / `prov_date` 를 `trd_prod_reg` 에서(`seller_id = user_id and prod_reg_date = reg_date`) 백필 → `set not null` / `req_deli_date = prov_date` 백필 → `set not null` / `drop constraint ux_trd_trade_info_trade_id` / `ux_trd_trade_info_one_quote`·`ux_trd_trade_info_one_cart`·`ix_trd_trade_info_listing` drop 후 `(user_id, seller_id, prod_reg_date, prod_id)` 와 기존 where 절 그대로(`trade_type = '견적조정' and trade_stats in ('견적요청','견적수락','견적거절')`, `trade_type = '구매검토' and trade_stats = '장바구니'`), 목록 인덱스는 `(seller_id, prod_reg_date, prod_id)`.
  - `1030`: `rename column buyer_id to user_id` / PK → `(user_id, trade_id, trade_date)` / `prod_id type varchar(50)` / `drop index ix_trd_trade_history_buyer`(PK 앞자리와 중복).
- [ ] **Step 4: 매핑·호출부** — 위 Interfaces 대로. 요점:
  - `Listing`: `@Id prodId`, `getId()` 세 값, 인증서 컬럼 `certificate_of_authenticity`, `minOrderQuantity`·`orderUnit` 의 `nullable = false` 제거.
  - `ListingService`: `existsById(new ListingId(...))` → `existsByUserIdAndRegDate`, `findById(new ListingId(...))` → `findByUserIdAndRegDate`. `delete` 는 이벤트에 `prodId` 를 담고 try/catch(`DataIntegrityViolationException` → `LISTING_HAS_TRADES`)를 지운다.
  - `TradeListingCleanup`: 두 삭제 뒤 `existsBySellerIdAndProdRegDateAndProdId` 이면 `throw new ApiException(ErrorCode.LISTING_HAS_TRADES)`. 클래스 주석의 "매물 FK 가 막는다"를 이 확인으로 고친다.
  - `TradeService`·`CartService`: 거래 행 만들 때 `prodRegDate(listing.regDate())`, `regDate(LocalDateTime.now(clock).format(yyyyMMddHHmmss))`. 거래 행에서 매물을 부를 땐 `trade.listingId()`. `new ListingId(t.getSellerId(), t.getRegDate())` → `t.listingId()`. `TradeResponse` 의 `regDate` 는 `prodRegDate` 를 넣는다(응답 칸 이름 유지). 이력 빌더 `.buyerId(` → `.userId(`.
  - `insertCartIfAbsent`: 컬럼 `prod_reg_date`, `reg_date`(지금), `req_deli_date`(= `prov_date`, PR 3 에서 입력값으로 바뀜), `on conflict (user_id, seller_id, prod_reg_date, prod_id) where ...`.
  - `data-model.md`: 세 표의 PK·컬럼·인덱스, "FK" 언급을 "FK 없음 — 서버가 세 값으로 찾는다"로.
- [ ] **Step 5: 통과 확인** `./gradlew test --tests "*SchemaConstraintsTest" --tests "*DefinitionKeysMigrationTest" --tests "*Listing*" --tests "*Trade*" --tests "*Cart*" --tests "*Quote*"` → PASS. 기존 `ListingApiTest`·`TradeApiTest` 의 `LISTING_HAS_TRADES` 테스트가 FK 없이 통과해야 한다. 견적·장바구니 행만 있는 매물 삭제 204 테스트가 없으면 `ListingApiTest` 에 `"장바구니·견적 행만 있는 매물은 지워지고 그 행도 지워진다"` 추가.
- [ ] **Step 6: 커밋** `db: FK 를 없애고 매물·거래·거래이력을 정의서 복합키로`

### Task 2: 같은 사용자 같은 초 등록 409

**Files:**
- Modify: `listing/repository/ListingRepository.java`, `listing/service/ListingService.java` (`create`)
- Test: `listing/controller/ListingApiTest.java`, `listing/service/ListingServiceTest.java`

**Interfaces:**
- Consumes: Task 1 `existsByUserIdAndRegDate`.
- Produces: `ListingRepository.lockRegistration(UUID userId)` — native `select pg_advisory_xact_lock(hashtext('listing-reg:' || cast(:userId as text)))` (같은 방식의 기존 예: `TradeIdGenerator`).

- [ ] **Step 1: 실패 테스트** — `ListingApiTest` 고정 Clock 으로 `"같은 사용자가 같은 초에 다른 상품을 등록하면 두 번째는 409 LISTING_DUPLICATE_REG_TIME"` (상품 A·B 각각 직접 입력, 두 번째 응답 409, `select count(*) from trd_prod_reg where user_id = ?` = 1), `"남의 userId 를 붙인 매물 주소는 404"`(없으면 추가). `ListingServiceTest` 의 저장 mock 에 `lockRegistration`·`existsByUserIdAndRegDate` 반영, `"같은 초 행이 있으면 저장하지 않고 409"`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*ListingApiTest" --tests "*ListingServiceTest"` → FAIL.
- [ ] **Step 3: 구현** `create` 에서 `reg_date` 를 정하기 직전 `lockRegistration(userId)`, `existsByUserIdAndRegDate(userId, regDate)` 이면 `ApiException(LISTING_DUPLICATE_REG_TIME)`. 기존 `saveAndFlush` catch 는 남긴다(세 값 PK 충돌 대비). 주석: 왜 DB unique 대신 잠금인지(정의서 PK 가 세 값, 매물 주소는 두 값).
- [ ] **Step 4: 통과 확인** 같은 명령 → PASS.
- [ ] **Step 5: 커밋** `feat(backend): 같은 사용자 같은 초 매물 등록은 잠금으로 409`

### Task 3: 제공가능일 필수 (매물 등록·수정)

**Files:**
- Modify: `listing/dto/ListingCreateRequest.java` (`deliveryDate` `@NotBlank`), `listing/dto/ListingUpdateRequest.java`, `listing/domain/Listing.java` (`update` 에서 빈 값으로 지우지 않음), `listing/service/ListingService.java` (`validateDates`)
- Modify: `frontend/src/lib/validation/listing.ts`, `frontend/src/lib/validation/listingEdit.ts`, `frontend/src/messages/listing.ts`, `frontend/src/components/listing/ListingForm.tsx`·`ListingEditForm.tsx`(필수 표시만)
- Modify: `docs/security.md` 입력 검증 표의 매물 납기일 줄
- Test: `ListingApiTest`, `frontend/src/lib/validation/listing.test.ts`, `listingEdit.test.ts`

**Interfaces:**
- 수정 요청의 `deliveryDate`: `null` = 안 바꿈(지금 규칙), `""` = 400 `fields.deliveryDate` "제공가능일을 입력해 주세요."(새 문구, 메시지 키 `required`). 오늘 이전 규칙은 지금과 같다(바꾸지 않은 옛 값은 통과).

- [ ] **Step 1: 실패 테스트** — 백엔드 `"제공가능일 없이 등록하면 400 fields.deliveryDate"`, `"수정에서 제공가능일을 빈 값으로 보내면 400"`. 프론트 `listing.test.ts` `"제공가능일이 비면 오류"`, `listingEdit.test.ts` `"제공가능일을 지우면 오류"`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*ListingApiTest"`, `pnpm exec vitest run src/lib/validation/listing.test.ts src/lib/validation/listingEdit.test.ts` → FAIL.
- [ ] **Step 3: 구현** 위 Files.
- [ ] **Step 4: 통과 확인** 같은 명령 + `pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 5: 커밋** `feat: 매물 제공가능일 필수`

### Task 4: 납품희망일 필수 (구매·견적·수락된 견적 구매)

**Files:**
- Modify: `trade/dto/TradeCreateRequest.java`, `trade/dto/QuotePurchaseRequest.java` (`reqDeliDate` `@NotBlank`), `trade/dto/QuoteCreateRequest.java` (항목에 `@NotBlank @Pattern(DELIVERY_DATE_PATTERN) String reqDeliDate`), `trade/service/TradeService.java` (`request`·`requestQuotes`·`purchaseFromQuote`·`validate`), `trade/dto/TradeResponse.java` 주석
- Modify: `frontend/src/lib/validation/trade.ts`, `frontend/src/lib/validation/quote.ts`, `frontend/src/types/trade.ts`, `frontend/src/lib/api/trades.ts`, `frontend/src/components/trade/PurchaseDialog.tsx`, `frontend/src/components/trade/QuoteDialog.tsx`, `frontend/src/messages/trade.ts`
- Modify: `docs/security.md` 구매·견적 표, `bruno/` 견적 요청 파일(`reqDeliDate` 추가)
- Test: `TradeApiTest`, `QuoteApiTest`, `frontend/src/lib/validation/trade.test.ts`, `quote.test.ts`

**Interfaces:**
- `TradeService.validate(ListingTradeSnapshot listing, int quantity, String reqDeliDate)` — `deliDateFromListing` 인자와 "비우면 매물 납기일" 분기 삭제. 날짜 규칙(실제 날짜, 오늘 한국 이후)은 그대로.
- 견적 항목 오류는 기존처럼 `fields["items[i].reqDeliDate"]`.
- 화면: 구매·견적 모달의 납품희망일 기본값 = 매물 제공가능일(`detail.deliveryDate`), 사용자가 바꿀 수 있음. 요청에 늘 보낸다.

- [ ] **Step 1: 실패 테스트** — `TradeApiTest` `"납품희망일 없이 구매하면 400 fields.reqDeliDate"`; `QuoteApiTest` `"견적 항목에 납품희망일이 없으면 400 fields[items[0].reqDeliDate]"`, `"견적 행에 납품희망일이 저장되고 재요청하면 새 값으로 바뀐다"`(Review Focus 5); `"수락된 견적 구매에 납품희망일 없으면 400"`. 프론트 `trade.test.ts` `"납품희망일이 비면 오류"`, `quote.test.ts` `"항목 납품희망일이 비거나 오늘 전이면 오류"`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*TradeApiTest" --tests "*QuoteApiTest"`, `pnpm exec vitest run src/lib/validation/trade.test.ts src/lib/validation/quote.test.ts` → FAIL.
- [ ] **Step 3: 구현** 위 Files. `QuoteDialog` 는 행마다 희망단가·수량 옆(좁으면 아래)에 납품희망일 칸(`type=date`), 기본값 그 매물 제공가능일.
- [ ] **Step 4: 통과 확인** 같은 명령 + `pnpm typecheck && pnpm lint` → PASS.
- [ ] **Step 5: 커밋** `feat: 구매·견적 납품희망일 필수, 기본값은 제공가능일`

### Task 5: 결정 기록 + 전체 검사 + PR

**Files:**
- Modify: `docs/decisions.md`, `docs/superpowers/plans/2026-10-23-listing-trade-pk.md`(맨 위 "대체됨 → 2026-10-27" 한 줄)

- [ ] **Step 1: decisions.md** 새 항목 `2026-10-27 정의서 복합키·FK 없음` (5줄 이내): 결정(FK 전부 삭제·정의서 PK·NOT NULL·같은 초 잠금·삭제 막기는 이벤트), 이유(정의서 FOREIGN KEY 표는 의미상 관계 — 사용자), 감수(DB 가 정합을 안 지킴, 무중단 예외 1회 배포), 재검토 조건(운영 배포 뒤 스키마 변경은 다시 2회). 2026-09-29 매물 PK 항목·2026-10-20 견적 납품희망일 항목 제목에 `[일부 대체 → 2026-10-27]`. 색인 표 갱신.
- [ ] **Step 2:** `./gradlew check` PASS, 프론트 `pnpm typecheck && pnpm lint && pnpm test` PASS.
- [ ] **Step 3:** 로컬 compose DB 에 적용 — `api-dev` 재시작 로그에 Flyway 4개 성공, `\d trd_prod_reg`·`\d trd_trade_info`·`\d trd_trade_history` 가 Task 1 과 같음, FK 0개.
- [ ] **Step 4:** E2E `flow.spec`·`purchase.spec`·`quote.spec`·`cart.spec` 1번(시간 초과는 재실행 1번).
- [ ] **Step 5:** 푸시 → PR(무엇을·왜·확인 방법) → `/code-review` → `/security-review`(마이그레이션 있음) → 반영·재검사 → 보고.
