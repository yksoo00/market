# 구매: 매물 구매요청 → 구매자 거래완료(확정) / 양쪽 취소

> 2026-10-15. 사용자 지시(대화): 거래 정의서(`TRD_TRADE_INFO`, `TRD_TRADE_HISTORY`)로 구매만 먼저 만든다.
> 장바구니·비교용·견적·자동 처리(기간 만료 취소·자동 확정)·공통코드 테이블은 이번 범위 밖.

## 목적

검색·상세의 [구매]를 켜서 구매자가 매물을 그대로(단가 고정) 사고, 구매자·판매자가 각자 목록에서 거래를 처리한다.
decisions.md 미정 항목 "채팅 없이 판매자·구매자 연결·거래 방식" 중 **직접 구매** 흐름을 정한다 (견적은 여전히 미정).

## 사용자 결정 (대화 2026-10-15)

- 흐름: 구매자가 [구매요청] → 판매자 승인 없음. 상태 `구매요청`이 되고 재고가 바로 줄어든다.
- 확정: **구매자가 [거래완료]**를 누르면 `구매확정` + 거래이력 1줄. 판매자는 누르지 않는다. 확정 뒤엔 취소 불가.
- 취소: `구매확정` 전이면 구매자·판매자 누구나 언제든. 재고를 되돌린다. 행은 남기고 상태 `취소`. 취소한 사람은 저장하지 않는다.
- 자동 처리 없음: 기간 제한 취소, 납품희망일 기준 자동 확정은 **나중에** (사용자가 다시 정함). 스케줄러 없음.
- 한 번 보낸 요청은 수정 불가 — 바꾸려면 취소 후 다시 요청. 판매자도 취소 후 매물을 고친다.
- 단가는 등록단가로 고정, 구매자가 바꿀 수 없다.
- 구매 가능: 로그인한 사용자 누구나, 자기 매물은 불가.
- 주문량: 최소주문량 이상, 재고 이하, 주문단위의 배수. 프론트(zod)도 같은 규칙으로 막아 [구매요청]을 끈다.
- 납기일 없는 매물: 구매자가 납품희망일을 반드시 입력. INFO `prov_date`만 nullable(정의서는 NOT NULL), `req_deli_date`는 NOT NULL 그대로.
- INFO 는 매물(`trd_prod_reg`)에서 가져올 수 있는 칸을 모두 서버가 복사(스냅샷).
- 코드 값은 지금은 한글 문자열. 나중에 숫자 코드(공통코드 테이블)로 바꾼다.
- 거래완료(`dt_expire` 있음)된 매물은 수정 불가. 거래가 1건이라도 있는 매물은 삭제 불가.
- 판매자 화면: 받은 구매요청 목록을 따로 만들고, 내 판매글 행에도 요청 건수를 보여 누르면 그 매물로 걸러진 목록으로 간다.
- 구매 입력은 모달.

## 정한 것 (사용자가 안 정해서 내가 고름 — 틀리면 알려 달라)

- 취소된 거래는 HISTORY 에 쌓지 않는다 ("거래가 완료된 거래 이력"이라). INFO 상태로만 남는다.
- 취소로 재고가 돌아오면 `dt_expire`도 지운다 → 다시 판매 중, 다시 수정 가능.
- 구매요청 rate limit **20회/시간** (매물 수정과 같은 값). 검증 실패(400)는 세지 않는다 (`hitUnlessInvalid`).
- 구매요청은 매물 등록처럼 `Idempotency-Key`를 받는다 — 두 번 눌러 재고가 두 번 줄지 않게.
- 목록의 상대방 표시는 닉네임(`user_nickname`)만. 이메일·전화 없음.

## 데이터 (`db/trade-tables` 브랜치, 마이그레이션 1개)

### trd_trade_info (TRD_TRADE_INFO — 거래정보)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | uuid | PK(복합), FK→trd_user_info | 구매자. 정의서 varchar(20) → uuid |
| trade_id | varchar(20) | PK(복합), **unique** | `yyMMddHH`(한국 시간) + 순번 3자리, 11자. 예 `26092917001`. unique 는 HISTORY FK 용(정의서 밖 추가) |
| trade_type | varchar(20) | not null | `구매요청` / `구매확정` / `구매취소` |
| seller_id | uuid | FK(seller_id, reg_date)→trd_prod_reg(user_id, reg_date) | 정의서 물리명 `USER_ID`가 구매자와 겹쳐 이름 변경(사용자 결정) |
| reg_date | varchar(14) | 위 FK | 매물 등록일시 |
| prod_id | varchar(20) | | 정의서 50 → 마스터에 맞춰 20 |
| prod_state | varchar(20) | | 복사 |
| sales_unit_price | integer | | 복사 (등록단가) |
| stock_quantity | integer | | 복사 (요청 시점, 줄이기 전) |
| min_order_quantity | integer | | 복사 |
| order_unit | integer | | 복사 |
| prov_date | varchar(10) | **nullable** | 복사 (제공가능일). 정의서 NOT NULL — 매물 납기일이 선택이라 |
| order_unit_price | integer | not null | = 등록단가 (고정) |
| order_quantity | integer | not null | 구매자 입력, 기본 최소주문량 |
| req_deli_date | varchar(10) | not null | 구매자 입력(yyyy-MM-dd), 기본 제공가능일 |
| remarks | varchar(100) | | 요청사항 |
| trade_stats | varchar(10) | not null | `구매요청` / `구매확정` / `취소` |
| spare_col | varchar(100) | | |

인덱스: `(seller_id, reg_date)` (FK·판매자 목록·건수). 구매자 목록은 PK 앞부분 `user_id`.

### trd_trade_history (TRD_TRADE_HISTORY — 거래이력)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| trade_id | varchar(20) | PK(복합), FK→trd_trade_info(trade_id) | |
| trade_date | varchar(14) | PK(복합) | 확정일시 `yyyyMMddHHmmss` |
| prod_id | varchar(20) | PK(복합) | |
| trade_type | varchar(10) | not null | `구매확정` |
| seller_id | uuid | not null, FK→trd_user_info | 정의서 물리명이 논리명과 뒤바뀜(판매자=BUYER_ID) → 바로잡음(사용자 결정) |
| buyer_id | uuid | not null, FK→trd_user_info | |
| trade_unit_price | integer | | |
| trade_quantity | integer | | |
| trade_amount | integer | | 단가 × 수량 |
| spare_col | varchar(100) | | |

이번 흐름에선 거래 1건 = 이력 1줄. PK 는 정의서대로(나중의 견적·분할 확정용).

## API (`trade` 패키지 새로)

모두 로그인 필요(401). 본인 id 는 인증 정보에서만.

### POST /api/v1/trades — 구매요청
- 본문: `sellerId`, `regDate`, `orderQuantity`(1~100000), `reqDeliDate`(yyyy-MM-dd, 선택), `remarks`(≤100, 선택).
- 순서: 매물 조회(없으면 404) → 자기 매물 403 → `dt_expire` 있으면 409 → 주문량(최소주문량 이상·주문단위 배수) 400 → 납품희망일(없으면 매물 납기일, 그것도 없으면 400 필수, 오늘(한국) 이전이면 400) → 금액 `단가×수량`이 int 초과면 400 `fields.orderQuantity`.
- 재고: `update trd_prod_reg set stock_quantity = stock_quantity - :q, dt_expire = case when stock_quantity - :q = 0 then :now end where user_id=:s and reg_date=:r and dt_expire is null and stock_quantity >= :q` — 바뀐 행 0이면 409 재고 부족. 락 없이 음수 방지.
- `trade_id`: 이번 한국 시간대 `yyMMddHH` 로 시작하는 건수 + 1. unique 충돌이면 몇 번 재시도, 999 넘으면 409 "잠시 후 다시".
- INFO 저장(매물 값 복사), 201 + 거래 응답. 같은 트랜잭션.
- rate limit 20회/시간, `Idempotency-Key`.

### POST /api/v1/trades/{tradeId}/complete — 거래완료
- 구매자 본인만(아니면 403, 없으면 404), `구매요청`만(아니면 409).
- INFO `trade_type=구매확정`, `trade_stats=구매확정`. HISTORY 1줄.
- 동시 처리: 상태 조건부 update(`where trade_stats='구매요청'`) 행 수로 판정 → 확정·취소가 겹쳐도 하나만.

### POST /api/v1/trades/{tradeId}/cancel — 취소
- 구매자 또는 그 매물의 판매자만(403), `구매요청`만(409).
- INFO `trade_type=구매취소`, `trade_stats=취소`. 재고 `+ order_quantity`, `dt_expire = null`.

### GET /api/v1/trades?role=buyer|seller&reg=&cursor=
- `role=buyer`: 내가 구매자. `role=seller`: 내가 판매자, `reg`(`<regDate>`)로 내 매물 하나로 거름.
- 최신순(`trade_id` 내림차순) 20개 + 커서.
- 항목: `tradeId`, `tradeStats`, 매물 키(`sellerId`, `regDate`), 상품명, 상대 닉네임, `orderQuantity`, `orderUnitPrice`, 금액, `reqDeliDate`, `remarks`, 대표 사진(공개 키만).

### 매물 쪽 변경
- `GET /api/v1/listings?mine=true` 항목에 `pendingTradeCount` (`구매요청` 상태 건수).
- `PATCH /api/v1/listings/{userId}/{regDate}`: `dt_expire` 있으면 409.
- `DELETE …`: 거래가 있으면 409 "거래 내역이 있는 매물은 삭제할 수 없어요".

## 오류

| 상황 | 코드 |
|---|---|
| 주문량·납품희망일·요청사항·금액 범위 | 400 `fields` |
| 비로그인 | 401 |
| 자기 매물 구매, 남의 거래 확정·취소, 판매자 확정 | 403 |
| 매물·거래 없음 | 404 |
| 재고 부족, 거래완료 매물, 이미 확정·취소된 거래, 거래완료 매물 수정, 거래 있는 매물 삭제, 순번 초과 | 409 + 문구 |
| 한도 초과 | 429 |

## 화면

문구는 `messages/trade.ts`.

### 구매 모달 (`components/trade/PurchaseDialog`)
- 상세·검색 결과의 [구매]를 켠다. [견적 요청]은 계속 "준비 중".
- 표시: 상품명, 단가(읽기 전용), 재고, 최소주문량, 주문단위, 납기일. 입력: 주문량(기본 최소주문량), 납품희망일(기본 납기일, 없으면 빈칸·필수), 요청사항.
- 금액 실시간. zod 검증 → 필드 옆 문구, 오류면 [구매요청] 끔. 서버 `fields`는 해당 칸, 409 는 모달 안 문구(재고 부족이면 매물을 다시 읽어 재고 갱신).
- 성공 → 모달 닫고 `ResultDialog` + [내 구매목록].
- [구매] 비활성: 비로그인(누르면 로그인으로), 자기 매물, 거래완료, 재고 < 최소주문량 — 이유 문구.

### 내 구매목록 `/my/purchases` (빈 화면 채움)
- 행: 거래ID, 상품명, 판매자 닉네임, 주문량, 단가, 금액, 납품희망일, 상태. `구매요청` 행에 [거래완료]·[취소](각각 확인 창).
- 표/카드·[더 보기]는 `/my/listings` 패턴. 409 면 목록 다시 읽기.

### 받은 구매요청 `/my/sales` (새 화면)
- 같은 목록 컴포넌트를 판매자용으로: 구매자 닉네임·요청사항, `구매요청` 행에 [취소]만.
- `?reg=` 면 그 매물만 + [전체 보기].
- 사용자 메뉴·마이페이지 허브·`tileScreens` 등록, 넓은 화면 확인.

### 내 판매글 `/my/listings`
- "구매요청" 열: N건(0이면 "-"), 누르면 `/my/sales?reg=…`.
- 거래완료 행은 [수정] 없음.

## 테스트

백엔드 (Testcontainers)
- 흐름: 요청 → 재고 감소·INFO / 확정 → HISTORY 1줄·금액 / 취소 → 재고 복원.
- 재고 0 → `dt_expire`, 취소 → 지움.
- 규칙: 최소주문량, 배수, 재고 초과, 금액 초과, 과거 납품희망일, 납기일 없는 매물의 납품희망일 누락.
- 권한: 자기 매물, 남의 거래 확정, 판매자 확정, 제3자 취소.
- 상태: 확정 후 취소, 취소 후 확정, 두 번 확정.
- 동시: 재고 5에 3개씩 동시 2건 → 1건만 성공.
- `trade_id` 형식(11자·한국 시간)·같은 시간대 순번 증가.
- 매물: 거래완료 PATCH 409, 거래 있는 DELETE 409, `pendingTradeCount`.
- 스키마 테스트(정의서 물리명)에 두 테이블.

프론트
- Vitest: 구매 zod(배수·범위·납기일 없을 때 필수), 금액 계산.
- E2E: 판매자 등록 → 구매자 모달 요청 → 내 구매목록 [거래완료] 상태 변경, 받은 구매요청에서 판매자 취소.

## 그 외

- Bruno: `trades/` create·complete·cancel·list.
- 문서: data-model.md(두 테이블), decisions.md(거래 흐름 결정, 미정 항목 아래 덧붙임), security.md(검증 수치·rate limit·새 API).
- 브랜치: 스키마 `db/trade-tables` → 코드 `feat/purchase`.

## 범위 밖

장바구니·비교용 바구니, 견적(조정요청·회신·비교), 자동 확정·기간 제한 취소, 공통코드 테이블·숫자 코드, 결제·배송, 엑셀 대량구매, 취소한 사람 기록.
