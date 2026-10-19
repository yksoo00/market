# 구매 후속 Minor 9개 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #59(직접 구매) 코드리뷰에서 보류한 Minor 9개를 고친다.

**Architecture:** 백엔드는 거래 서비스·거래ID 생성기·내 매물 조회와 날짜 공통 유틸(`common/time`)만 바꾼다. 프론트는 판단을 `lib/` 순수 함수로 빼서 Vitest 로 검증하고 컴포넌트는 그 함수를 쓴다. 마이그레이션 없음.

**Tech Stack:** Spring Boot 4.1·Java 21·JUnit/Testcontainers, Next.js 16·zod·Vitest·Playwright.

**Spec:** 별도 스펙 파일 없음 — 2026-10-19 채팅에서 승인한 설계(아래 표)가 원본. 거래 설계 배경은 `docs/superpowers/specs/2026-10-15-purchase-design.md`.

| # | 승인된 설계 |
|---|---|
| 1 | 거래완료 매물: 상세의 [추가등록]·[삭제] 숨김, 추가등록 고르기 목록(`/listings/mine`)에서 제외 |
| 2 | 검색 결과에서 구매 성공 → 그 매물만 `GET` 해 행 교체 |
| 3 | 납품희망일 빈칸 + 매물 납기일이 지났으면 프론트·백엔드 둘 다 같은 뜻의 오류 |
| 4 | 거래 응답 상품명 = 거래에 복사된 `prod_id` 의 마스터 이름 (현재 매물 아님) |
| 5 | 매물 삭제·첫 구매요청 경합: 동시 테스트로 재현 먼저. 500 이 안 나면 테스트만 남기고 "문제 아님" 보고 |
| 6 | 거래ID 순번: `LIKE` count 대신 기존 unique 인덱스를 타는 범위 `max` |
| 7 | 거래 목록 커서 형식이 틀리면 400 `VALIDATION` `fields.cursor` |
| 8 | complete·cancel 은 이미 읽은 거래 행으로 응답 (다시 `findByTradeId` 안 함) |
| 9 | 한국 오늘 날짜·엄격한 날짜 파싱을 `common/time/KoreanDates` 한 곳으로 |

## Global Constraints

- 브랜치 `fix/purchase-minors` (main 에서). 마이그레이션 없음 → `db/` 브랜치 불필요.
- 사용자에게 보이는 문구는 `frontend/src/messages/`. 백엔드 오류 문구는 서비스 안 한국어 그대로(기존 패턴).
- 입력 검증 두 층 규칙: 3번은 프론트 zod 와 백엔드 서비스가 같은 조건에서 같은 필드(`reqDeliDate`)에 오류.
- 도메인 간 호출은 service 경유: `TradeService` 는 상품 이름을 `ListingService` 를 거쳐 얻는다.
- 프론트 검증은 `pnpm typecheck && pnpm lint && pnpm test` 같이. 백엔드는 `./gradlew check`.
- 화면 칸 체크리스트(`.claude/rules/frontend.md`): 새 화면·모달 없음. 2번은 기존 모달 동작만 바뀌므로 넓은 화면 3분할에서 검색 결과 → 구매 → 행 갱신만 확인.

## Review Focus

1. 구매 직후 행 갱신 `GET` 이 실패(네트워크·404 — 그사이 삭제)하면: 행은 그대로 두고 오류를 띄우지 않는다(구매 자체는 성공했고 결과 팝업이 이미 뜸). → Task 7 테스트.
2. 거래완료가 된 바로 그 행(재고 0): 갱신 후 `tradeStatus: "completed"` 로 바뀌어 [구매] 가 막혀야 한다. → Task 7 테스트.
3. 납기일이 **오늘**인 매물에 빈칸 제출은 통과해야 한다(경계). → Task 2·6 테스트.
4. 거래ID 범위 조회는 같은 시간대 `999` 다음 `TRADE_ID_EXHAUSTED` 동작을 그대로 유지. → Task 3 테스트.
5. 커서 `null`·빈 문자열은 첫 페이지(400 아님). → Task 2 테스트.

---

### Task 1: 날짜 공통 유틸 `KoreanDates` (항목 9)

**Files:**
- Create: `backend/src/main/java/com/company/market/common/time/KoreanDates.java`
- Test: `backend/src/test/java/com/company/market/common/time/KoreanDatesTest.java`
- Modify: `listing/service/ListingService.java` (상수 `MUFC_DATE_FORMAT`·`DELIVERY_DATE_FORMAT`·`SEOUL`·`parseStrict` 제거), `listing/service/ProductService.java:35,97`, `trade/service/TradeService.java` (`SEOUL`·`DATE_FORMAT`·`parse` 제거), `trade/service/TradeIdGenerator.java:27,42`

**Interfaces:**
- Produces (모두 `public static`, 생성자 private):
  - `ZoneId SEOUL`
  - `LocalDate today(Clock clock)` — 한국 날짜
  - `LocalDateTime now(Clock clock)` — 한국 시각
  - `LocalDate parseIso(String value)` — `uuuu-MM-dd` STRICT, 실패·null 이면 `null`
  - `LocalDate parseCompact(String value)` — `uuuuMMdd` STRICT, 실패·null 이면 `null`

- [ ] **Step 1: 실패하는 테스트**

```java
@DisplayName("UTC 15:30 은 한국 다음 날")
void todayIsSeoulDate() {
    Clock c = Clock.fixed(Instant.parse("2026-10-18T15:30:00Z"), ZoneOffset.UTC);
    assertThat(KoreanDates.today(c)).isEqualTo(LocalDate.of(2026, 10, 19));
    assertThat(KoreanDates.now(c).getHour()).isEqualTo(0);
}
@DisplayName("없는 날짜·다른 형식은 null")
void strictParse() {
    assertThat(KoreanDates.parseIso("2026-10-19")).isEqualTo(LocalDate.of(2026, 10, 19));
    assertThat(KoreanDates.parseIso("2026-02-30")).isNull();
    assertThat(KoreanDates.parseIso("20261019")).isNull();
    assertThat(KoreanDates.parseIso(null)).isNull();
    assertThat(KoreanDates.parseCompact("20261019")).isEqualTo(LocalDate.of(2026, 10, 19));
    assertThat(KoreanDates.parseCompact("2026-10-19")).isNull();
}
```

- [ ] **Step 2:** `./gradlew test --tests '*KoreanDatesTest'` → 컴파일 실패
- [ ] **Step 3:** `KoreanDates` 구현. 클래스 주석에 "서버 Clock 은 UTC — 한국 날짜가 필요하면 여기만" 한 줄.
- [ ] **Step 4:** 네 사용처를 `KoreanDates` 로 바꾸고 각 파일의 중복 상수·`parseStrict`/`parse` 삭제. 기존 "오늘은 한국 날짜" 주석은 `KoreanDates` 로 옮겨졌으니 사용처에서 지운다.
- [ ] **Step 5:** `./gradlew test` → 전부 PASS (동작 변화 없음)
- [ ] **Step 6:** 커밋 `refactor(backend): 한국 날짜·엄격한 날짜 파싱을 common/time 으로 모음`

---

### Task 2: 거래 서비스 — 납기일 오류·상품명·재조회·커서 (항목 3·4·7·8)

**Files:**
- Modify: `trade/service/TradeService.java`, `listing/service/ListingService.java`
- Test: `backend/src/test/java/com/company/market/trade/controller/TradeApiTest.java`

**Interfaces:**
- Consumes: `KoreanDates.today/parseIso` (Task 1)
- Produces:
  - `ListingService.productNames(Collection<String> prodIds): Map<String, String>` — `products.getAll` 로 prodId → prodName
  - `TradeService.toResponse(TradeInfo trade, TradeStats status, String prodName, String photo, String counterpartNickname)` — 상태를 인자로 받는다(벌크 UPDATE 뒤 엔티티 상태가 옛 값이라)

- [ ] **Step 1: 실패하는 테스트 4개** (`TradeApiTest`, 기존 헬퍼로 매물·구매 생성)

```java
@DisplayName("납품희망일을 비웠는데 매물 납기일이 지났으면 400 fields.reqDeliDate '매물 납기일이 지났습니다'")
// 매물 생성 후 jdbc.update("update trd_prod_reg set prov_date = '2020-01-01' where user_id = ? and reg_date = ?", ...)
// 요청 본문에 reqDeliDate 없음 → status 400, $.fields.reqDeliDate == "매물 납기일이 지났습니다. 납품희망일을 입력해 주세요."
// 같은 매물에 reqDeliDate = 오늘(한국) 을 보내면 201

@DisplayName("판매자가 매물 상품명을 바꿔도 거래 내역 상품명은 구매 때 이름")
// 구매 → 판매자 PATCH prodName "새 이름" → GET 거래 목록(buyer) 의 prodName == 처음 이름

@DisplayName("거래 목록 커서 형식이 틀리면 400 fields.cursor, 비우면 첫 페이지")
// cursor=abc → 400 $.code VALIDATION, $.fields.cursor 존재 / cursor= (빈 값) → 200

@DisplayName("거래완료·취소 응답은 바뀐 상태를 돌려준다")
// complete 응답 $.data.status == "confirmed", cancel 응답 == "canceled" (기존 테스트가 이미 보면 이 케이스는 생략)
```

- [ ] **Step 2:** `./gradlew test --tests '*TradeApiTest'` → 새 테스트 3개 FAIL(납기일 문구, 상품명, 커서)
- [ ] **Step 3: 납기일 (3)** — `validate` 에 `boolean substituted`(빈칸이라 매물 납기일을 쓴 경우)를 더하고, 과거 날짜일 때 `substituted` 면 `"매물 납기일이 지났습니다. 납품희망일을 입력해 주세요."`, 아니면 기존 문구.
- [ ] **Step 4: 상품명 (4)** — `request` 는 `listing.prodName()` 그대로(요청 시점 = 같은 마스터). `get`·`list`·`complete`·`cancel` 은 `listings.productNames(거래들의 prodId)` 에서 이름, 사진은 지금처럼 매물 스냅샷에서. `toResponse` 를 위 시그니처로.
- [ ] **Step 5: 재조회 제거 (8)** — `complete`·`cancel` 끝의 `get(me, tradeId)` 대신 이미 읽은 `trade` + 새 상태로 `toResponse`. 스냅샷(사진)·이름·닉네임만 조회. 상대 닉네임 규칙은 `get` 과 같게(내가 구매자면 판매자).
- [ ] **Step 6: 커서 (7)** — `list` 에서 `cursor` 가 비어 있지 않고 `\d{11}` 이 아니면 `ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."))`. 매물 `mine`·검색 커서는 "깨진 커서는 첫 페이지"가 기존 의도라 이번엔 건드리지 않는다(보고에 적는다).
- [ ] **Step 7:** `./gradlew test --tests '*TradeApiTest'` → PASS. `bruno/trades/` 에 바뀐 요청 형태 없음 확인.
- [ ] **Step 8:** 커밋 `fix(backend): 거래 상품명은 구매 때 마스터, 지난 매물 납기일·잘못된 커서는 400, 확정·취소 재조회 제거`

---

### Task 3: 거래ID 순번은 범위 max (항목 6)

**Files:**
- Modify: `trade/repository/TradeInfoRepository.java:23`, `trade/service/TradeIdGenerator.java`
- Test: `backend/src/test/java/com/company/market/trade/service/TradeIdGeneratorTest.java`

**Interfaces:**
- Produces: `TradeInfoRepository.findMaxTradeIdBetween(String from, String to): Optional<String>` (`select max(t.tradeId) ... where t.tradeId between :from and :to`). `countByTradeIdStartingWith` 삭제.

- [ ] **Step 1: 테스트 추가** — `@DisplayName("중간 번호가 비어도(취소 등과 무관하게) 최댓값 다음 번호")`: 같은 시간대에 `…001`, `…005` 행을 jdbc 로 넣고 `next()` == `…006`. 기존 테스트("첫 번호 001", "999 다음 TRADE_ID_EXHAUSTED")는 그대로 통과해야 한다.
- [ ] **Step 2:** 실행 → 새 테스트 FAIL (count 방식이면 `…003`)
- [ ] **Step 3:** `next()` 가 `findMaxTradeIdBetween(prefix + "000", prefix + "999")` 의 마지막 3자리 + 1 (없으면 1). 클래스 주석의 "건수 + 1" 을 "최댓값 + 1 — unique 인덱스 범위 조회라 LIKE 와 달리 인덱스를 탄다"로.
- [ ] **Step 4:** `./gradlew test --tests '*TradeIdGenerator*' --tests '*TradeApiTest'` → PASS
- [ ] **Step 5:** 개발 DB 에서 확인: `docker compose exec postgres psql -U <user> -d <db> -c "explain select max(trade_id) from trd_trade_info where trade_id between '26101914000' and '26101914999'"` → `ux_trd_trade_info_trade_id` 를 쓰는 `Index Only Scan`(행이 적으면 `Seq Scan` 이 나올 수 있다 — 그때는 `set enable_seqscan = off;` 를 같은 세션에 넣고 인덱스 사용 가능 여부만 확인). 결과를 PR 본문에.
- [ ] **Step 6:** 커밋 `perf(backend): 거래ID 순번을 unique 인덱스 범위의 최댓값으로`

---

### Task 4: 매물 삭제·첫 구매요청 경합 재현 (항목 5)

**Files:**
- Test: `backend/src/test/java/com/company/market/trade/controller/TradeApiTest.java` (기존 "동시 요청" 테스트의 latch 패턴)
- Modify (재현될 때만): `listing/service/ListingService.java` `delete` 또는 `lockForTrade`

- [ ] **Step 1: 테스트** — `@DisplayName("매물 삭제와 첫 구매요청이 동시에 와도 500 은 없다 — 삭제가 이기면 구매 404, 구매가 이기면 삭제 409")`. 거래 없는 매물 하나, 두 스레드가 latch 로 동시에 `DELETE` 와 `POST /trades`. 20회 반복. 단언: 두 응답 상태 집합이 `{204, 404}` 또는 `{201, 409}` 중 하나, 5xx 없음, 끝난 뒤 DB 가 이긴 쪽과 맞다(삭제면 매물·거래 0, 구매면 매물 1·거래 1).
- [ ] **Step 2:** 실행.
  - PASS → 코드 변경 없음. 커밋 `test(backend): 매물 삭제·첫 구매요청 경합은 404/409 — 500 없음 확인`. 보고에 "재현 안 됨, 리뷰 지적은 잠금(findForUpdate) 순서상 성립하지 않음".
  - FAIL(5xx) → `superpowers:systematic-debugging` 으로 원인을 찾고 그 층에서 409/404 로 바꾼 뒤 같은 테스트 PASS. 커밋 `fix(backend): 매물 삭제·첫 구매요청 경합의 500 을 …로`.

---

### Task 5: 추가등록 고르기 목록에서 거래완료 매물 제외 (항목 1, 서버)

**Files:**
- Modify: `listing/repository/ListingSearchRepository.java:41-53` (`findMinePage`), `listing/service/ListingService.java:396` 주석
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingMineApiTest.java`

- [ ] **Step 1: 테스트** — `@DisplayName("거래완료(재고 소진) 매물은 내 매물 고르기 목록에 없다")`: 매물 둘 중 하나를 `dt_expire` 채움(jdbc) → `GET /listings/mine` items 1개, 남은 건 판매 중인 것.
- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** JPQL 에 `and l.dtExpire is null`. `mine` 주석에 "거래완료 매물은 추가등록 대상이 아니라 뺀다" 추가. 이 API 를 쓰는 곳은 `ExtraPicker` 하나뿐(확인됨).
- [ ] **Step 4:** PASS → 커밋 `fix(backend): 추가등록 고르기 목록에서 거래완료 매물 제외`

---

### Task 6: 프론트 — 상세 버튼·납품희망일 검증 (항목 1·3)

**Files:**
- Modify: `frontend/src/lib/listingDetail.ts`, `frontend/src/components/listing/ListingActions.tsx:83-98`, `frontend/src/lib/validation/trade.ts:47-58`, `frontend/src/messages/trade.ts:27-29`
- Test: `frontend/src/lib/listingDetail.test.ts`, `frontend/src/lib/validation/trade.test.ts`

**Interfaces:**
- Produces: `ownerActions(d: Pick<ListingDetail, "tradeStatus">): { edit: boolean; extra: boolean; remove: boolean }` — 거래완료면 셋 다 false

- [ ] **Step 1: 테스트**

```ts
it("거래완료 매물은 수정·추가등록·삭제 모두 숨김", () => {
  expect(ownerActions({ tradeStatus: "completed" })).toEqual({ edit: false, extra: false, remove: false });
  expect(ownerActions({ tradeStatus: "available" })).toEqual({ edit: true, extra: true, remove: true });
});
// trade.test.ts
it("빈칸인데 매물 납기일이 지났으면 deliProvPast", () => {
  expect(errorOf(parse({}, { ...limits, provDate: "2026-10-15" }), "reqDeliDate")).toBe(v.deliProvPast);
  expect(parse({}, { ...limits, provDate: "2026-10-16" }).success).toBe(true); // 오늘 = 통과
});
```

- [ ] **Step 2:** `pnpm test` → FAIL
- [ ] **Step 3:** `ownerActions` 구현, `ListingActions` 의 내 매물 버튼 셋을 이 결과로 렌더(기존 "서버가 수정을 막는다" 주석은 `ownerActions` 위로 옮기고 이유를 "거래완료 = 거래가 있으니 서버가 수정·추가등록·삭제를 409 로 막는다. 누를 수 없는 버튼은 숨긴다"로). 거래완료면 버튼 줄이 비므로 빈 `div` 가 남지 않게 한다.
- [ ] **Step 4:** `messages/trade.ts` 에 `deliProvPast: "매물 납기일이 지났어요. 납품희망일을 입력해 주세요."`. zod 빈칸 분기: `provDate` 없으면 `deliRequired`, `provDate < today` 면 `deliProvPast`.
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test` → PASS
- [ ] **Step 6:** 커밋 `fix(frontend): 거래완료 매물은 수정·추가등록·삭제 숨김, 지난 매물 납기일은 입력 요구`

---

### Task 7: 프론트 — 검색 결과 구매 후 그 행 갱신 (항목 2)

**Files:**
- Modify: `frontend/src/components/search/ResultList.tsx:62-78,172-178`, `frontend/src/components/search/SearchResults.tsx:106-148`
- Create 함수: `frontend/src/lib/rowEdit.ts` 에 `replaceRow`
- Test: `frontend/src/lib/rowEdit.test.ts`

**Interfaces:**
- Consumes: 기존 `applyDetailToItem(item, d)` (`lib/rowEdit.ts:115`), `listingsApi.get(userId, regDate)`
- Produces:
  - `replaceRow(items: ListingSearchItem[], d: ListingDetail): ListingSearchItem[]` — `userId`·`regDate` 같은 행만 `applyDetailToItem`, 나머지 그대로(같은 참조)
  - `ResultList` prop `onPurchased?: (key: { userId: string; regDate: string }) => void`

- [ ] **Step 1: 테스트**

```ts
it("구매한 행만 재고·거래상태가 바뀐다", () => {
  const next = replaceRow([a, b], { ...detailOf(b), stockQuantity: 0, tradeStatus: "completed" });
  expect(next[0]).toBe(a);
  expect(next[1]).toMatchObject({ stockQuantity: 0, tradeStatus: "completed" });
});
it("목록에 없는 매물이면 그대로", () => { expect(replaceRow([a], detailOf(b))).toEqual([a]); });
```

- [ ] **Step 2:** FAIL 확인
- [ ] **Step 3:** `replaceRow` 구현. 기존 `SearchResults.tsx:135` 의 같은 map 도 `replaceRow` 로 바꾼다(같은 로직 두 벌 방지).
- [ ] **Step 4:** `ResultList` 의 `PurchaseDialog onPurchased` 에서 결과 팝업을 띄우는 기존 동작 + `onPurchased?.({ userId, regDate })`. `SearchResults` 가 `listingsApi.get` → `ok` 면 `setState(prev => ({ ...prev, items: replaceRow(prev.items, res.data) }))`, 실패면 아무것도 안 함(주석: "구매는 이미 성공 — 갱신 실패는 다음 검색에서 맞춰진다").
- [ ] **Step 5:** `pnpm typecheck && pnpm lint && pnpm test` → PASS
- [ ] **Step 6:** 커밋 `fix(frontend): 검색 결과에서 구매하면 그 행의 재고·거래상태를 다시 읽는다`

---

### Task 8: 전체 검증·PR

- [ ] **Step 1:** `backend/` `./gradlew check` → BUILD SUCCESSFUL
- [ ] **Step 2:** `frontend/` `pnpm typecheck && pnpm lint && pnpm test` → 통과
- [ ] **Step 3:** E2E — 백엔드·compose 를 이 브랜치로 띄우고 `pnpm e2e purchase`(로컬 임시 config). `purchase.spec` 에 "검색 결과에서 구매 → 그 행 재고 숫자 감소" 단언 한 줄 추가. 이전에 못 돌린 "검색 결과 내 매물 [구매] 차단" 단계도 이번에 전체 실행.
- [ ] **Step 4:** 넓은 화면 3분할(오른쪽 아래 칸)에서 검색 결과 → [구매] → 행 갱신 직접 확인.
- [ ] **Step 5:** `superpowers:verification-before-completion` → 푸시 → `gh pr create` (본문: 항목별 무엇·왜·확인, EXPLAIN 결과, 항목 5 재현 결과, 매물 커서는 그대로 둔 이유).
- [ ] **Step 6:** `/code-review` 직접 실행 → 반영. `/security-review` 는 조건(마이그레이션·인증·권한 검사 변경) 없음 → 안 돌림.
