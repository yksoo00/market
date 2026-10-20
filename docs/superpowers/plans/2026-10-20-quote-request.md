# 견적요청 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 구매자가 매물에 희망단가 견적을 보내고, 판매자가 수락(매물 단가 변경)·거절하며, 모든 단계를 메일로 알린다. 거래 코드 값을 정의서 체계(TYPE=종류, STATS=진행)로 맞춘다.

**Architecture:** `trd_trade_info` 재사용(새 테이블 없음). 백엔드 `trade` 도메인에 견적 API·상태 전이, `common/mail` 에 SMTP/로그 발송기, 거래 이벤트 → 커밋 뒤 메일. 프론트는 판단 로직을 `lib/` 순수 함수로 두고 `TradeList`·새 `QuoteDialog` 가 쓴다.

**Tech Stack:** Spring Boot 4.1·Java 21·Flyway·`spring-boot-starter-mail`(새 의존성, 사용자 확인), Next.js 16·zod·Vitest·Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-quote-request-design.md`

## Global Constraints

- 브랜치: `db/trade-quote`(마이그레이션 2개 + data-model.md) → `feat/quote-request`(base = db 브랜치). 둘 다 PR, 머지는 사용자.
- 코드 값(한글 라벨 그대로 DB): TYPE `구매검토`·`견적조정`·`거래`, STATS `장바구니`·`비교용`·`견적요청`·`견적회신`·`구매요청`·`구매확정`. API 응답 코드: STATS `cart`·`compare`·`quoteRequested`·`quoteReplied`·`requested`·`confirmed`, TYPE `review`·`quote`·`purchase`.
- 취소는 행 삭제(값 없음). 수락·거절 → `견적회신`.
- 견적 검증 수치: 1~20개, 희망단가 1~등록단가, 수량 = 구매 규칙(최소주문량 이상·주문단위 배수·재고 이하·1~100,000), 단가×수량 ≤ 2,147,483,647, 비고 ≤ 100자. 프론트 zod·백엔드 같은 값.
- 메일 주소는 API 응답·로그에 넣지 않는다. 로그엔 tradeId·uid 만.
- 사용자 문구는 `frontend/src/messages/`. 새 page 없음 — 모달은 3분할 칸 크기(960×500, 640×330) 확인.
- 프론트 검증은 `pnpm typecheck && pnpm lint && pnpm test` 같이, 백엔드 `./gradlew check`.

## Review Focus

1. 같은 견적에 판매자 수락과 구매자 취소가 동시에 오면 하나만 성공, 매물 단가는 수락이 이긴 경우에만 바뀐다. → Task 5 동시 테스트.
2. 메일 발송이 실패(SMTP 오류·이메일 없음)해도 요청·수락·거래는 성공으로 남는다. → Task 6 테스트.
3. 수락 때 매물 단가가 이미 희망단가보다 낮으면 올리지 않는다. → Task 5 테스트.
4. 견적 N건 중 하나라도 틀리면 아무것도 저장되지 않고 오류가 그 행 칸에 붙는다. → Task 4 테스트.
5. 견적 행(`req_deli_date` null)이 목록·응답에서 깨지지 않는다(프론트 납품희망일 칸 "-"). → Task 4·7 테스트.

---

### Task 1: 마이그레이션 (`db/trade-quote`)

**Files:**
- Create: `backend/src/main/resources/db/migration/V202610201000__trade_req_deli_date_nullable.sql`
- Create: `backend/src/main/resources/db/migration/V202610201010__trade_codes_to_definition.sql`
- Modify: `docs/data-model.md` (trd_trade_info·history 값 목록, req_deli_date nullable)

- [ ] Step 1: 1번 파일 — `alter table trd_trade_info alter column req_deli_date drop not null;` 상단에 되돌리기 주석(`set not null`, 그 전에 null 행 처리).
- [ ] Step 2: 2번 파일 — `delete from trd_trade_info where trade_stats = '취소';` → `update trd_trade_info set trade_type = '거래' where trade_type in ('구매요청','구매확정','구매취소');` → `update trd_trade_history set trade_type = '거래' where trade_type = '구매확정';`. 상단 주석: 왜(정의서 값으로), 되돌리기 불가 부분(삭제 행), 새 코드와 같은 배포로 나가야 함.
- [ ] Step 3: `./gradlew test` — 기존 테스트는 2번 이후 옛 값을 쓰는 코드라 실패할 수 있다. **이 브랜치는 마이그레이션만** 이므로 `Flyway` 적용·`ddl validate` 만 확인: `./gradlew test --tests '*SchemaTest*'`(있는 스키마 검증 테스트) 또는 앱 기동 테스트 1개. Expected: 스키마 검증 PASS.
- [ ] Step 4: data-model.md 갱신 후 커밋 `db: 거래 코드 값을 정의서 체계로, req_deli_date nullable`. 푸시·PR(본문: Task 2 와 같이 배포해야 함).

### Task 2: 거래 코드 체계 교체 + 취소는 삭제 (`feat/quote-request`, base `db/trade-quote`)

**Files:** `trade/domain/TradeType.java`, `TradeStats.java`, `trade/service/TradeService.java`, `trade/repository/TradeInfoRepository.java`, `trade/dto/TradeResponse.java`, 테스트 `TradeApiTest`, `TradeIdGeneratorTest`

**Interfaces — Produces:**
- `TradeType { REVIEW("구매검토"), QUOTE("견적조정"), PURCHASE("거래") }` + `String code()` → `review|quote|purchase`
- `TradeStats { CART("장바구니"), COMPARE("비교용"), QUOTE_REQUESTED("견적요청"), QUOTE_REPLIED("견적회신"), REQUESTED("구매요청"), CONFIRMED("구매확정") }` + `String code()` → spec 응답 코드
- `TradeInfoRepository.deleteIfStatus(String tradeId, TradeStats stats): int`
- `TradeResponse` 에 `String tradeType`, `int salesUnitPrice` 추가, `reqDeliDate` nullable.

- [ ] Step 1: 테스트 먼저 — `TradeApiTest` 의 취소 테스트들을 "취소하면 행이 없어지고 재고 복원, 목록에서 사라짐"으로 바꾸고, 저장 값 단언을 `trade_type = '거래'`, history `'거래'` 로. `TradeIdGeneratorTest.codesAreStoredAsKoreanLabels` 를 `PURCHASE`/`REQUESTED` → `거래`/`구매요청`. 응답 `$.data.tradeType == "purchase"`, `$.data.salesUnitPrice` 단언 추가.
- [ ] Step 2: 실행 → FAIL 확인.
- [ ] Step 3: 구현. `cancel` 은 `deleteIfStatus(id, REQUESTED)` 0이면 `TRADE_NOT_PENDING`, 1이면 재고 복원. complete 는 TYPE 그대로·STATS `CONFIRMED`(updateStatus 의 type 인자 제거). 응답 코드는 enum `code()`.
- [ ] Step 4: `./gradlew test` 전체 PASS → 커밋 `feat(backend): 거래 코드 값을 정의서 체계로, 취소는 행 삭제`.

### Task 3: 메일 발송기 (`common/mail`)

**Files:** `backend/build.gradle`(+`spring-boot-starter-mail`), Create `common/mail/Mailer.java`, `SmtpMailer.java`, `LoggingMailer.java`, `MailConfig.java`, `application.yml`(`app.mail.*`), `AppProperties`(`Mail(host, port, username, password, from)`), `.env.example`(키 이름만), 테스트 `common/mail/MailConfigTest.java`

**Interfaces — Produces:** `interface Mailer { void send(String to, String subject, String body); }` — 실패는 예외로 던진다(호출자가 잡아 로그).

- [ ] Step 1: 테스트 — host 비면 `LoggingMailer` 빈, host 있으면 `SmtpMailer`(ApplicationContextRunner 로 두 경우).
- [ ] Step 2: FAIL → 구현. SMTP 는 `JavaMailSenderImpl` 직접 생성(host 빈 값으로 Boot 자동 설정이 켜지는 것을 피함), 465 면 `mail.smtp.ssl.enable=true`, `mail.smtp.auth=true`, 타임아웃 10초. 본문 text/plain UTF-8.
- [ ] Step 3: PASS → 커밋 `feat(backend): 메일 발송기 — 하이웍스 SMTP, 설정 없으면 로그만`.

### Task 4: 견적 요청 API

**Files:** Create `trade/dto/QuoteCreateRequest.java`(`List<@Valid Item> items` `@Size(min=1,max=20)`, Item: `sellerId`·`regDate`·`@Min(1) orderUnitPrice`·`@Min(1) @Max(100_000) orderQuantity`·`@Size(max=100) remarks`), `TradeService.requestQuotes(UUID buyer, QuoteCreateRequest): List<TradeResponse>`, `TradeController` `POST /quotes`, `ErrorCode.QUOTE_ALREADY_REQUESTED`(409), `TradeInfoRepository.existsByUserIdAndSellerIdAndRegDateAndTradeStats`, `bruno/trades/quote-create.bru`, 프론트 `messages` errors 키는 Task 7, 테스트 `TradeApiTest`(또는 새 `QuoteApiTest`)

- [ ] Step 1: 테스트 — 정상 2건(행 2개, `견적조정`/`견적요청`, 재고 그대로, `req_deli_date` null, 응답 tradeType quote), 희망단가 > 등록단가 → 400 `fields["items[1].orderUnitPrice"]` 이고 행 0개, 21개 → 400, 내 매물 403, 거래완료 409, 같은 매물 두 번 409 `QUOTE_ALREADY_REQUESTED`, 비로그인 401, 멱등 키 재전송 → 같은 결과·행 그대로.
- [ ] Step 2: FAIL → 구현. 각 매물 `lockForTrade` 로 읽고 검증(구매 `validate` 의 수량 규칙 재사용 — 필드 키 앞에 `items[i].`). 하나라도 실패면 `ValidationException` 모아 던짐(트랜잭션 롤백). 멱등 scope `quote-create`, 저장 값 = tradeId 목록(쉼표).
- [ ] Step 3: PASS → 커밋 `feat(backend): 견적 요청 API — 희망단가·수량·비고, 여러 매물 한 번에`.

### Task 5: 수락·거절·견적 취소, 요청 건수

**Files:** `TradeService.accept/reject`, `cancel` 분기, `ListingService.applyQuotePrice(UUID sellerId, String regDate, int price)`, `TradeController` `/accept`·`/reject`, `pendingCounts`(견적요청+구매요청), bruno `accept.bru`·`reject.bru`, 테스트

- [ ] Step 1: 테스트 — 판매자 수락: 매물 단가 = 희망단가, 행 `견적회신`, 두 번째 수락 409. 매물이 이미 더 싸면 단가 유지. 거래완료 매물 수락 409. 거절: 단가 그대로·`견적회신`. 구매자·남이 수락 403. 구매자 견적 취소: 행 삭제, `견적회신` 뒤 취소 409. 판매자는 견적 취소 불가 403. pending-counts 에 견적요청 포함. 동시 수락·취소 → 하나만 성공(Review Focus 1, 기존 latch 패턴).
- [ ] Step 2: FAIL → 구현. accept: 행 확인(판매자·QUOTE·QUOTE_REQUESTED) → `applyQuotePrice`(매물 잠금, 완료면 409, `min(현재, 희망)`) → `updateStatus(QUOTE_REQUESTED→QUOTE_REPLIED)` 0이면 409(롤백). reject: 상태만. cancel: QUOTE 면 구매자만·`deleteIfStatus(QUOTE_REQUESTED)`, PURCHASE 면 Task 2 그대로.
- [ ] Step 3: PASS → 커밋 `feat(backend): 견적 수락(매물 단가 변경)·거절·취소`.

### Task 6: 거래 메일 (커밋 뒤)

**Files:** Create `trade/service/TradeMailEvent.java`(record: kind, tradeId, buyerId, sellerId, prodName, unitPrice, salesUnitPrice, quantity), `trade/service/TradeMailListener.java`(`@TransactionalEventListener(AFTER_COMMIT)`), `trade/service/TradeMailComposer.java`(제목·본문 한 곳), `UserDirectory.emailsOf(Collection<UUID>): Map<UUID,String>`, TradeService 에서 publish(7종), 테스트(테스트용 `Mailer` 빈으로 받은 메일 수집)

- [ ] Step 1: 테스트 — 견적 요청 → 판매자 1통(상품명·희망단가 포함), 수락·거절 → 구매자 1통(제목에 수락/거절), 견적 취소 → 판매자, 구매요청 → 판매자, 거래 취소 → 상대, 거래완료 → 2통. 롤백된 요청(400)엔 0통. `Mailer` 가 예외를 던져도 API 200/201(Review Focus 2). 이메일 없는 사용자는 건너뜀. 본문·로그에 상대 이메일 없음.
- [ ] Step 2: FAIL → 구현. 리스너는 예외를 잡아 WARN(`tradeId`, 받는 uid). 링크는 `appUrl` + `/my/sales` 또는 `/my/purchases`.
- [ ] Step 3: `./gradlew check` PASS → 커밋 `feat(backend): 견적·거래 단계마다 상대에게 메일`.

### Task 7: 프론트 — 타입·목록 줄 동작

**Files:** `types/trade.ts`(TradeStats·TradeType 코드, `salesUnitPrice`, `reqDeliDate: string | null`, `QuoteCreateRequest`), `lib/api/trades.ts`(`createQuotes`·`accept`·`reject`), Create `lib/tradeActions.ts` + test, `components/trade/TradeList.tsx`, `messages/trade.ts`(상태 라벨·버튼·확인 문구·errors `QUOTE_ALREADY_REQUESTED`)

**Interfaces — Produces:** `rowActions(item: Trade, asBuyer: boolean): ("complete"|"cancel"|"accept"|"reject"|"buy")[]` — 구매자: 견적요청→[cancel], 견적회신→[buy], 구매요청→[complete, cancel]. 판매자: 견적요청→[accept, reject], 구매요청→[cancel].

- [ ] Step 1: `tradeActions.test.ts` 표 기반 테스트 → FAIL → 구현 → PASS.
- [ ] Step 2: TradeList — 줄마다 `rowActions` 버튼, [buy] 는 `PurchaseDialog`(그 매물), 견적 줄은 단가 칸에 "등록 → 희망" 표시, 납품희망일 null 이면 "-", "취소" 배지·스타일 삭제. 취소 성공 시 줄 제거.
- [ ] Step 3: typecheck·lint·test PASS → 커밋 `feat(frontend): 거래 목록에 견적 줄 — 수락·거절·취소·구매`.

### Task 8: 프론트 — 견적 모달

**Files:** Create `lib/validation/quote.ts` + test(`quoteSchema(limits[])` — 행별 규칙, spec 수치), Create `components/trade/QuoteDialog.tsx`, `components/search/ResultList.tsx`([견적 요청] 연결, 21개+ 안내), `components/listing/ListingActions.tsx`([견적 요청] 연결, 비로그인 → 로그인), `messages/trade.ts`(quote.*), `messages/search.ts`·`listing.ts`(`pending` 문구 제거)

- [ ] Step 1: zod 테스트 — 희망단가 0·등록단가+1 오류, 수량 규칙, 비고 101자, 정상 → FAIL → 구현 → PASS.
- [ ] Step 2: QuoteDialog — 매물 상세를 `Promise.all(listingsApi.get)` 로 읽고, 요청 불가 매물(내 것·거래완료)은 이유만 보이고 제외, 행마다 희망단가(기본 등록단가)·수량(기본 최소주문량)·비고, 서버 `fields["items[i].x"]` 를 그 행 칸에 표시, 멱등 키는 모달 연 동안 하나, 성공 → ResultDialog + [내 구매목록]. 모달 높이는 PurchaseDialog 와 같은 방식(칸 안 스크롤).
- [ ] Step 3: typecheck·lint·test PASS → 커밋 `feat(frontend): 검색 결과·상세 [견적 요청] 모달`.

### Task 9: 프론트 — 홈 아이콘·앱 메뉴 경로

**Files:** `components/home/QuickMenu.tsx`, `components/common/AppLauncher.tsx` — `buyRequest` → `/search`, `buyQuotes` → `/my/purchases`, `sellQuote` → `/my/sales`. TODO 주석에서 구현된 항목 갱신.

- [ ] Step 1: typecheck·lint → 커밋 `feat(frontend): 견적 요청·견적 확인·판매 견적 조정 아이콘 경로 연결`.

### Task 10: 문서·E2E·마무리

- [ ] Step 1: decisions.md(2026-10-20 견적 흐름·TYPE/STATS 역할·취소 삭제·메일, 미정 견적 항목 닫기, 색인 거래 행), security.md(견적 검증 표·새 API·메일 주소 비노출·멱등 scope), design.md(견적 모달·목록 줄·취소 배지 제거), architecture.md(SMTP). 커밋 `docs: 견적요청`.
- [ ] Step 2: `purchase.spec` — 취소 후 "취소" 배지 단언을 "줄 사라짐"으로. 새 `quote.spec`: 판매자 등록 → 구매자 검색 결과에서 [견적 요청](희망단가 9000) → 판매자 받은 구매요청 [수락] → 매물 단가 9000 → 구매자 내 구매목록 [구매]. 이 브랜치 서버를 다른 포트로 띄워 실행.
- [ ] Step 3: 견적 모달 3분할 칸 크기 스크린샷 확인.
- [ ] Step 4: `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test` → 푸시 → PR → `/code-review` + `/security-review`(마이그레이션·권한 검사 변경 있음).
