# 매물·거래 PK 정리 + 거래 등록일시 Implementation Plan

> **대체됨 → 2026-10-27** `docs/superpowers/plans/2026-10-27-definition-keys.md` (사용자가 정의서 복합키·FK 없음으로 정함). 이 계획은 구현하지 않았다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매물 PK 를 `reg_date` 하나로, 거래정보 PK 를 `trade_id` 하나로 바꾸고, 거래정보 `spare_col` 을 거래 등록일시 `trade_date` 로 바꾼다.

**Architecture:** Flyway 마이그레이션 4개 + JPA 엔티티 id 교체. API·URL(`/listings/{userId}/{regDate}`)은 그대로 둔다 — 서버가 `user_id + reg_date` 로 찾으므로 남의 id 를 붙인 주소는 지금처럼 404. 같은 초 등록은 거래ID 와 같은 방식(advisory lock)으로 줄 세워 다음 초로 민다.

**Tech Stack:** Spring Boot 4.1, JPA, Flyway, PostgreSQL 16, Testcontainers.

**Spec:** 이 파일 "설계" 절 (대화 2026-10-23 사용자 결정).

## 설계

사용자 결정 (2026-10-23):
1. `trd_prod_reg` PK `(user_id, reg_date)` → `reg_date`. 정의서는 사용자ID 를 FK 로만 표시 — 2026-09-29 에 둘 다 PK 로 잘못 읽었다.
2. 같은 초에 매물 두 개가 등록되면 서버가 advisory lock 으로 줄 세우고, 그 초가 쓰였으면 `가장 큰 reg_date + 1초` 로 저장 (409 없음).
3. `trd_trade_info` PK `(user_id, trade_id)` → `trade_id`. `user_id`(구매자)는 FK + 인덱스.
4. `trd_trade_info.spare_col` → `trade_date varchar(14)` (`yyyyMMddHHmmss`, 한국 시간, 거래 행을 만든 시각). 기존 행은 거래ID 앞 8자리로 채운다(분·초 00). 장바구니 1시간 만료(다음 PR)의 기준.

정의서·기존 스키마와 달라지는 점 (마이그레이션 주석에 적는다):

| 대상 | 지금 | 바뀐 뒤 |
|---|---|---|
| `trd_prod_reg` PK | `(user_id, reg_date)` | `(reg_date)` |
| `trd_prod_reg` 인덱스 | `ix_trd_prod_reg_reg_date (reg_date)` | 삭제(PK 와 중복). `ix_trd_prod_reg_user (user_id, reg_date)` 추가 — FK·내 판매 목록 |
| `trd_trade_info` 매물 FK | `(seller_id, reg_date) → (user_id, reg_date)` | `(reg_date) → trd_prod_reg(reg_date)` + 인덱스 `ix_trd_trade_info_reg_date` |
| `trd_trade_info.seller_id` | 매물 FK 의 일부 | `fk_trd_trade_info_seller → trd_user_info(uid)` (인덱스는 기존 `ix_trd_trade_info_listing` 앞자리) |
| `trd_trade_info` PK | `(user_id, trade_id)` + unique `(trade_id)` | `(trade_id)`. unique 삭제(중복). `ix_trd_trade_info_buyer (user_id, trade_id)` 추가 — 구매자 목록 |
| `trd_trade_info.spare_col` | `varchar(100)` 비어 있음 | `trade_date varchar(14) not null` |

무중단 규칙 예외: 컬럼 이름 변경·NOT NULL 은 원래 배포 2회. 아직 운영 배포 전이라 1회로 한다 (decisions.md 에 기록).

인덱스는 일반 `create index` — 운영 데이터 전, concurrently 는 Flyway 잠금에 멈춤(db.md).

로컬 DB 확인(2026-10-23): `reg_date` 중복 0건, 매물 73행, 거래 55행(`spare_col` 전부 null).

## Global Constraints

- 브랜치 `db/listing-trade-pk` (worktree). 엔티티 id 교체는 마이그레이션 없이는 안 돌아가므로 같은 브랜치.
- 마이그레이션 파일명 `V{YYYYMMDDHHMM}__{설명}.sql`, 한 파일 한 목적, 상단에 되돌리기 주석, `docs/data-model.md` 같은 커밋에서 갱신.
- 주석·커밋·문서 한국어.
- API 경로·응답 모양·프론트 화면은 바꾸지 않는다.

## Review Focus

- 남의 userId 를 붙인 매물 주소(`GET /listings/{다른 사용자}/{내 regDate}`)는 지금처럼 404 — PK 가 reg_date 하나가 돼도 user_id 를 같이 본다. Task 2 에 테스트.
- 같은 초에 다른 사용자 둘이 등록 → 둘 다 201, reg_date 가 1초 차이. Task 2 에 테스트.
- 매물 삭제 시 거래가 남아 있으면 지금처럼 막힘(FK 가 reg_date 로 바뀌어도). 기존 ListingApiTest 삭제 테스트가 통과해야 함.
- 거래 목록 커서·장바구니·견적의 매물 키(`seller_id, reg_date`) 동작 그대로 — 기존 Cart/Quote/TradeApiTest 전부 통과.
- 거래 행을 만들 때마다 `trade_date` 가 채워짐 (구매·견적·장바구니 3곳). Task 3 에 테스트.

---

### Task 1: 마이그레이션 4개 + data-model.md

**Files:**
- Create: `backend/src/main/resources/db/migration/V202610231000__prod_reg_pk_reg_date.sql`
- Create: `backend/src/main/resources/db/migration/V202610231010__trade_info_pk_trade_id.sql`
- Create: `backend/src/main/resources/db/migration/V202610231020__trade_info_trade_date.sql`
- Create: `backend/src/main/resources/db/migration/V202610231030__trade_info_trade_date_backfill.sql`
- Modify: `docs/data-model.md` (trd_prod_reg·trd_trade_info 표, 인덱스 줄)

- [ ] **Step 1: 1000 — 매물 PK.** 순서: `fk_trd_trade_info_listing` drop → `trd_prod_reg_pkey` drop → `primary key (reg_date)` → `ix_trd_prod_reg_reg_date` drop → `ix_trd_prod_reg_user (user_id, reg_date)` → `fk_trd_trade_info_listing foreign key (reg_date) references trd_prod_reg (reg_date)` → `ix_trd_trade_info_reg_date (reg_date)` → `fk_trd_trade_info_seller foreign key (seller_id) references trd_user_info (uid)`. 상단 주석: 위 표의 매물 줄, 되돌리기 역순.
- [ ] **Step 2: 1010 — 거래 PK.** `fk_trd_trade_history_trade` drop → `trd_trade_info_pkey` drop → `ux_trd_trade_info_trade_id` drop → `primary key (trade_id)` → `fk_trd_trade_history_trade` 다시 → `ix_trd_trade_info_buyer (user_id, trade_id)`.
- [ ] **Step 3: 1020 — 컬럼.** `rename column spare_col to trade_date`, `alter column trade_date type varchar(14)`. 주석: 무중단 예외 이유.
- [ ] **Step 4: 1030 — 백필.** `update trd_trade_info set trade_date = '20' || substr(trade_id, 1, 8) || '0000' where trade_date is null;` 후 `set not null`.
- [ ] **Step 5: data-model.md** 두 표의 PK·FK·인덱스 줄과 `trade_date` 행. 이 단계에선 엔티티가 옛 id 라 앱 테스트는 Task 2·3 뒤에 돌린다.

### Task 2: 매물 엔티티 id = reg_date + 등록일시 생성기

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/service/ListingRegDateGenerator.java`
- Modify: `listing/domain/Listing.java` (`@IdClass` 제거, `@Id` 는 regDate 만, `Persistable<String>`, `getId()` → regDate)
- Modify: `listing/domain/ListingId.java` (JPA id 아님 — 거래·장바구니가 쓰는 매물 키 값으로만 남김. 주석 고침)
- Modify: `listing/repository/ListingRepository.java` (`JpaRepository<Listing, String>`, `findByUserIdAndRegDate`, `existsByUserIdAndRegDate`, `findMaxRegDate`)
- Modify: `listing/service/ListingService.java:126,146-150,316,336,350-360,399`
- Modify: `common/exception/ErrorCode.java:43` (`LISTING_DUPLICATE_REG_TIME` 삭제), `frontend/src/messages/listing.ts:5` (같은 문구 삭제)
- Test: `ListingRepositoryTest`, `ListingServiceTest`, `ListingApiTest`, 새 `ListingRegDateGeneratorTest`

**Interfaces:**
- Produces: `ListingRegDateGenerator.next(): String` — `@Transactional(propagation = MANDATORY)`, `pg_advisory_xact_lock(hashtext('listing_reg_date'))`, 후보 = `LocalDateTime.now(clock)` 를 `yyyyMMddHHmmss` 로; `findMaxRegDate()` 가 후보 이상이면 그 값 + 1초.
- Produces: `ListingRepository.findByUserIdAndRegDate(UUID, String): Optional<Listing>`, `existsByUserIdAndRegDate(UUID, String): boolean`, `@Query("select max(l.regDate) from Listing l") Optional<String> findMaxRegDate()`.
- `snapshotsForTrades`·`searchItems` 는 `findAllById(regDate 목록)` 후 userId 가 키와 같은 것만, 맵 키는 `new ListingId(userId, regDate)` (시그니처 그대로).

- [ ] **Step 1: 실패 테스트**
  - `ListingRegDateGeneratorTest` (Testcontainers, `TradeIdGeneratorTest` 와 같은 구성, 고정 Clock 한국 2026-09-29 12:00:00): `"빈 테이블이면 지금 시각"` → `"20260929120000"`; `"같은 초가 이미 있으면 1초 뒤"` → 행 `20260929120000` 저장 후 `"20260929120001"`; `"더 뒤 값이 있으면 그 값 + 1초"` → 행 `20260929120005` 후 `"20260929120006"`.
  - `ListingRepositoryTest`: `"(user_id, reg_date) 복합키…"` 테스트를 `"reg_date 로 저장·조회, 다른 user_id 로는 못 찾는다"` 로 — `findByUserIdAndRegDate(userId, r)` present, `findByUserIdAndRegDate(other, r)` empty. 덮어쓰기 방지 테스트는 다른 사용자·같은 reg_date 로 바꿔 예외 유지.
  - `ListingServiceTest.translatesDuplicateKeyViolation` 삭제(대상 코드 삭제). 생성자에 generator mock 추가.
  - `ListingApiTest`: `"같은 초에 다른 사용자 둘이 등록하면 둘 다 201, reg_date 1초 차"`, `"남의 userId 를 붙인 매물 주소는 404"`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*Listing*"` — 컴파일 실패 또는 위 테스트 FAIL.
- [ ] **Step 3: 구현** (위 Interfaces). `create` 의 try/catch `DataIntegrityViolationException → LISTING_DUPLICATE_REG_TIME` 제거.
- [ ] **Step 4: 통과 확인** `./gradlew test --tests "*Listing*"` PASS.
- [ ] **Step 5: 커밋** `db: 매물 PK 를 등록일시 하나로 — 같은 초 등록은 다음 초로`

### Task 3: 거래 엔티티 id = trade_id + trade_date 채우기

**Files:**
- Modify: `trade/domain/TradeInfo.java` (`@IdClass` 제거, `@Id` tradeId 만, `Persistable<String>`, `spareCol` → `tradeDate` 필드·빌더 인자)
- Delete: `trade/domain/TradeInfoId.java`
- Modify: `trade/repository/TradeInfoRepository.java` (`JpaRepository<TradeInfo, String>`, `insertCartIfAbsent` 에 `trade_date` 인자)
- Modify: `trade/service/TradeService.java:93,171,226` 빌더, `CartService.java:73`
- Test: `TradeApiTest`, `QuoteApiTest`, `CartApiTest`

**Interfaces:**
- Consumes: Task 1 컬럼.
- 거래 행 만들 때 `tradeDate = KoreanDates.now(clock).format("yyyyMMddHHmmss")` — 구매·견적·장바구니 3곳 같은 값 규칙. 재요청·구매 전환처럼 기존 행을 고칠 땐 바꾸지 않는다(만든 시각).

- [ ] **Step 1: 실패 테스트** 각 ApiTest 고정 Clock 기준으로 `select trade_date from trd_trade_info where trade_id = ?` 가 그 시각인지: `TradeApiTest "구매요청 행에 거래 등록일시"`, `QuoteApiTest "견적 행에 거래 등록일시, 재요청해도 그대로"`, `CartApiTest "장바구니 행에 거래 등록일시"`.
- [ ] **Step 2: 실패 확인** `./gradlew test --tests "*TradeApiTest" --tests "*QuoteApiTest" --tests "*CartApiTest"`.
- [ ] **Step 3: 구현.**
- [ ] **Step 4: 통과 확인** 같은 명령 + `--tests "*TradeIdGeneratorTest"` PASS.
- [ ] **Step 5: 커밋** `db: 거래정보 PK 를 거래ID 하나로, 예비 컬럼을 거래 등록일시로`

### Task 4: 결정 기록 + 전체 검사 + PR

- [ ] **Step 1:** `docs/decisions.md` 새 항목 `2026-10-23 매물·거래 PK 정리` (5줄): 위 결정 1~4, 이유(정의서 FK 표시 오독), 무중단 예외, 재검토 조건(초당 등록이 많아져 1초 밀림이 쌓이면 밀리초 등). 2026-09-29 항목 제목에 `[일부 대체 → 2026-10-23]`. 색인 표엔 영향 없음.
- [ ] **Step 2:** `./gradlew check` PASS, 프론트 `pnpm typecheck && pnpm lint` PASS (messages 삭제).
- [ ] **Step 3:** 로컬 compose DB 에 마이그레이션 적용 확인 (`api-dev` 재시작 로그에 Flyway 4개 성공, `\d trd_prod_reg`·`\d trd_trade_info` 가 위 표와 같음).
- [ ] **Step 4:** 푸시 → PR (무엇을·왜·확인 방법) → `/code-review` → `/security-review` (마이그레이션 있음).
