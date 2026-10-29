# 정의서 재정렬 + 내 활동내역·거래이력 + 페이지 번호 설계

2026-10-27. 사용자와 대화로 정함. 기준 정의서: `KPIT-BRK-테이블정의서.xlsx` (2026-10-27 14:08 판, 저장소 밖).
`docs/superpowers/plans/2026-10-23-listing-trade-pk.md`(매물 PK 를 `reg_date` 하나로)를 대체한다 — 그 계획은 구현 전이다.

## 목표

1. DB 를 정의서에 맞춘다. FK 는 전부 없애고 PK 는 정의서의 복합키를 쓴다. 정의서의 FOREIGN KEY 표는 "의미상 관계"이고 DB 제약이 아니다(사용자).
2. 장바구니·비교를 정의서의 `TRD_CART_INFO` 로 옮긴다.
3. 마이페이지 메뉴를 내 활동내역·내 거래이력으로 정리하고, 검색 화면 범위 탭을 사용자 데이터에 따라 보인다.
4. 목록을 [더 보기] 대신 페이지 번호로 보인다 (커서 기반).

## 원칙

- 테이블은 정의서 + 아래 "정의서와 다른 점"대로. 코드는 테이블에 맞춰 고친다.
- NOT NULL 은 정의서대로. 예외는 `parent_code` 둘(대분류는 부모 없음).
- 사용자ID 는 uuid 유지(정의서 varchar(20)). `trd_user_info.uid` 와 같은 값.
- 테이블명 `trd_prod_reg` 유지 (정의서 `TRD_PROG_REG` 는 오타 — 사용자).
- FK 가 지키던 정합은 서버 코드가 지킨다. 조회 인덱스는 남긴다.
- 운영 배포 전이라 컬럼 이름 변경·삭제를 배포 1회로 한다 (무중단 규칙 예외, decisions.md 에 기록).
- 기존 데이터는 마이그레이션이 새 구조로 옮긴다.

## PR 나누기 (순서대로)

| PR | 브랜치 | 내용 |
|---|---|---|
| 1 | `db/definition-keys` | FK 삭제, 복합키, `trd_prod_reg`·`trd_trade_info`·`trd_trade_history` 컬럼 |
| 2 | `db/product-master` | `trd_prod_master` 정의서대로, `trd_ctgr_master` 새로, 등록 폼 새 칸 |
| 3 | `db/cart-info` | `trd_cart_info` 새로, 장바구니·비교 흐름 |
| 4 | `feat/my-activity` | 헤더 메뉴, 내 활동내역, 내 거래이력, 검색 범위 탭 |
| 5 | `feat/page-numbers` | 커서 기반 페이지 번호 |

스키마 변경은 `db/` 브랜치 규칙이지만 1~3 은 엔티티를 같이 바꾸지 않으면 앱이 뜨지 않아 코드도 같은 브랜치에 둔다 (10/23 계획과 같은 이유).

---

## PR 1 — FK 삭제·복합키·거래 컬럼

### 테이블

**FK 8개 삭제**: `fk_trd_prod_master_category`, `trd_prod_reg_user_id_fkey`, `trd_prod_reg_prod_id_fkey`, `fk_trd_trade_info_buyer`, `fk_trd_trade_info_listing`, `fk_trd_trade_history_trade`, `fk_trd_trade_history_seller`, `fk_trd_trade_history_buyer`.

**`trd_prod_reg`**

| 컬럼 | 지금 | 바뀐 뒤 |
|---|---|---|
| PK | `(user_id, reg_date)` | `(user_id, reg_date, prod_id)` |
| `prov_date` | nullable | NOT NULL. 빈 행은 `reg_date` 앞 8자리를 `yyyy-MM-dd` 로 |
| `prod_coa` | | `certificate_of_authenticity` |
| `min_order_quantity`, `order_unit` | NOT NULL default 1 | nullable default 1 (정의서) |
| 인덱스 | `ix_trd_prod_reg_prod_id`, `ix_trd_prod_reg_reg_date` | 그대로 |

**`trd_trade_info`** — PK `(user_id, trade_id)` 그대로 (정의서와 같음)

| 컬럼 | 지금 | 바뀐 뒤 |
|---|---|---|
| `reg_date` (매물 등록일시) | nullable | `prod_reg_date` NOT NULL |
| `reg_date` (거래 등록일시) | 없음 | varchar(14) nullable. 기존 행은 `'20' \|\| substr(trade_id,1,8) \|\| '0000'` |
| `prod_id` | varchar(20) | varchar(50) |
| `prov_date` | nullable | NOT NULL. 빈 행은 그 매물 `prov_date` |
| `req_deli_date` | nullable (견적 행 null) | NOT NULL. 빈 행은 `prov_date` |
| `ux_trd_trade_info_trade_id` | unique | 삭제 |
| `ux_trd_trade_info_one_quote`, `ux_trd_trade_info_one_cart` | `(user_id, seller_id, reg_date)` 부분 unique | `(user_id, seller_id, prod_reg_date, prod_id)` 로 다시 만듦 (정의서 밖, 10/21 사용자 결정 유지) |
| `ix_trd_trade_info_listing` | `(seller_id, reg_date)` | `(seller_id, prod_reg_date, prod_id)` |

**`trd_trade_history`**

| 컬럼 | 지금 | 바뀐 뒤 |
|---|---|---|
| PK | `(trade_id, trade_date, prod_id)` | `(user_id, trade_id, trade_date)` |
| `buyer_id` | | `user_id` (구매자) |
| `prod_id` | varchar(20) | varchar(50) |

### 매물 찾기

- 거래 → 매물: `seller_id` = 매물 `user_id`, `prod_reg_date` = `reg_date`, `prod_id` = `prod_id`. `ListingId` 에 `prodId` 를 더한다.
- 매물 주소 `/listings/{userId}/{regDate}` 와 거래 API 요청 본문(`sellerId`, `regDate`)은 그대로. 서버가 `(user_id, reg_date)` 로 매물 1개를 찾고 `prod_id` 를 채운다 — 아래 "같은 초 등록"이 두 값으로 1개를 보장한다.

### 같은 초 등록

`ListingService.create` 가 사용자별 `pg_advisory_xact_lock` 을 잡고 `(user_id, reg_date)` 행이 있으면 409 `LISTING_DUPLICATE_REG_TIME` (지금 문구 그대로). DB unique 는 두지 않는다.

### 매물 삭제 막기

지금은 FK 위반을 잡아 409 `LISTING_HAS_TRADES`. 바뀐 뒤: 거래 도메인이 이미 듣는 `ListingDeletingEvent` 처리에서 지울 행(장바구니·견적)을 지운 뒤 그 매물에 남은 거래 행이 있으면 `ApiException(LISTING_HAS_TRADES)` 을 던진다. 같은 트랜잭션이라 매물 삭제도 롤백된다. 매물 → 거래 직접 호출(순환)은 생기지 않는다.

### 입력

| 칸 | 지금 | 바뀐 뒤 |
|---|---|---|
| 매물 등록·수정 제공가능일 | 선택 | **필수**, YYYY-MM-DD, 오늘(한국) 이후 (기존 납기일 규칙) |
| 구매 납품희망일 `reqDeliDate` | 비우면 매물 납기일 | **필수**. 화면 기본값 = 제공가능일, 바꿀 수 있음 |
| 견적 납품희망일 | 받지 않음 | **필수**, 구매와 같은 규칙. 견적 모달에 칸 추가 |
| 수락된 견적 → 구매 | 수량·납품희망일·요청사항 | 그대로 (납품희망일 필수) |

프론트 zod·백엔드 Bean Validation·`docs/security.md` 를 같이 고친다.

### 거래 행 만들 때

`reg_date` = 서버 현재 시각(한국, `yyyyMMddHHmmss`), `prod_reg_date`·`prod_id` = 매물 값. 기존 행을 고칠 때(재요청·구매 전환)는 `reg_date` 를 바꾸지 않는다.

---

## PR 2 — 상품마스터·카테고리 마스터

### `trd_prod_master`

| 컬럼 | 지금 | 바뀐 뒤 |
|---|---|---|
| `prod_mpn` | | `prod_part_no` varchar(20) |
| `prod_photo_1` | | `prod_image` varchar(100) (정의서 40, 저장소 키 80자라 사용자 결정 100) |
| `prod_data_sheet` | varchar(100) | 그대로 100 (정의서 40, 사용자 결정) |
| `prod_brand` | varchar(50) NOT NULL | varchar(40) nullable. 41자 이상 행이 있으면 마이그레이션 전에 확인 |
| `prod_name` | NOT NULL | nullable |
| `reg_date` | NOT NULL | nullable |
| `prod_class_no` varchar(20), `prod_useful_life` int, `warranty_method` varchar(20), `alter_prod_name` varchar(40) | 없음 | 새 컬럼 |
| `major_category`, `middle_category`, `minor_category` varchar(40) | 없음 | 새 컬럼. 기존 `category_code`(`P01-Q01-R001`)를 조각으로 나눠 채움 |
| `category_code`, `prod_scan_code` | | 삭제 |
| `prod_mufc_date` | | 유지 (정의서 밖, 사용자 결정) |
| unique `(prod_name, prod_brand)` | | 삭제 |

### `trd_ctgr_master` (새 테이블)

정의서대로. 다른 점: `category_code` varchar(12) (정의서 4, 나중에 바뀔 수 있어 사용자 결정), `parent_code` nullable.
`trd_ctgr_code` 239행으로 채운다: `category_code` = 경로의 마지막 조각(`R001`), `category_depth` = 기존 `category_class`(대/중/소), `parent_code` = 기존 `parent_code`(부모 조각, 대분류 null), 나머지 칸은 같은 값. 조각 코드 239개는 겹치지 않는다(확인함).
`trd_ctgr_code` 는 바꾸지 않는다.

### 쓰임

- 카테고리 패널(`GET /categories`)은 지금처럼 `trd_ctgr_code` 를 읽는다. 등록 폼은 소분류 경로 코드를 보낸다.
- 서버는 받은 소분류 코드의 조각을 `trd_ctgr_master` 의 부모 관계로 확인해 `major/middle/minor_category` 에 저장한다.
- 상세·검색 결과의 카테고리 이름("대 > 중 > 소")과 검색 카테고리 필터는 상품마스터의 세 칸 + `trd_ctgr_master` 로 찾는다.

### 등록 폼·API

- 직접 입력 칸 추가: 물품분류번호, 보증년수, 정품보증방법, 대체상품명. 마스터에서 고르면 마스터 값.
- 제조사 길이 50 → 40.
- 상품마스터 검색(`GET /products`) 응답·매물 상세 응답에 새 칸.
- 직접 입력 재사용: 이름·제조사·분류번호·제조일이 모두 같은 마스터가 있으면 그것을 쓰고, 없으면 새로 만든다. 사양은 비교하지 않는다. 동시 등록은 `pg_advisory_xact_lock` 으로 줄 세운다(unique 대신).

---

## PR 3 — `trd_cart_info` (장바구니·비교)

### 테이블

정의서대로. 다른 점:

| 정의서 | 만들 것 |
|---|---|
| 사용자ID varchar(20) | `user_id` uuid (구매자) |
| 판매자ID `USER_ID` | `seller_id` uuid |
| 상품등록일시 `REG_DATE` | `prod_date` |
| 제공가능일 `REG_DATE` | `prov_date` |
| 등록일시 `REG_DATE` | `reg_date` (담은 시각) |

PK `(user_id, trade_id, ser_no)`. 나머지 칸(`cart_type`, `prod_name`, `prod_no`, `manufacturer`, `mufc_date`, `prod_spec_info`, `prod_state`, `order_unit_price`, `order_quantity`, `req_deli_date`, `remarks`)과 NOT NULL 은 정의서대로.

### 흐름

| 동작 | 저장 |
|---|---|
| 장바구니 담기 (검색 결과·상세) | 구매처럼 수량·납품희망일(기본 제공가능일)·요청사항 입력, 구매와 같은 검증. `trd_trade_info` 1행(새 거래ID, `구매검토`/`장바구니`, 매물 값 복사, 단가 = 등록단가) + `trd_cart_info` 1행(같은 거래ID) |
| 비교 담기 (검색 목록에서만) | 입력 없음. 수량 = 최소주문량, 납품희망일 = 제공가능일, 요청사항 빈 값. `구매검토`/`비교용` + `cart_type=비교용` |
| 목록·개수·헤더 배지 | `trd_cart_info` 에서 (`cart_type` 별) |
| 빼기 | 두 행 삭제 |
| 장바구니 → 구매·견적 | `trd_cart_info` 행 삭제, **같은** `trd_trade_info` 행의 `trade_type`·`trade_stats`·입력값을 바꾼다 (지금은 행을 지우고 새로 만듦) |
| 매물 삭제 | 그 매물의 장바구니·비교 행(두 테이블) 삭제 |

`trd_cart_info` 값의 출처:

| 칸 | 출처 |
|---|---|
| `user_id`, `trade_id`, `order_*`, `req_deli_date`, `remarks` | 같은 `trd_trade_info` 행 |
| `ser_no` | 그 구매자 행 중 최대 + 1 |
| `seller_id`, `prod_date`, `prod_no`(= `prod_id`), `prod_state`, `prov_date` | 매물 |
| `prod_name`, `manufacturer`(= `prod_brand`), `mufc_date`, `prod_spec_info` | 상품마스터. 빈 사양은 `''` |
| `reg_date` | 담은 시각 |

장바구니·비교 행에서 매물 찾기: `seller_id` + `prod_date` + `prod_no`.
`구매검토` 행은 내 활동내역·판매자 화면·요청 건수·검색 범위 판정에 나오지 않는다 (지금 `tradeType <> 구매검토` 조건 그대로).
기존 장바구니 행(`trd_trade_info` 의 `장바구니`)은 마이그레이션이 `trd_cart_info` 행을 만든다.

### 검색 목록의 선택 줄 (사용자 2026-10-29)

- 비교는 검색 목록에서만, 같은 소분류끼리 2~4개. 장바구니 화면의 [비교] 버튼은 없앤다.
- 체크한 매물은 목록 위 "선택한 상품" 줄에 칩(상품명 + ✕)으로 계속 보인다 — 자기가 뭘 골랐는지 알게. ✕ 로 뺀다. [비교]·[견적 요청]·[구매]는 이 줄의 매물 기준.
- 소분류가 다른 매물을 골라 [비교]를 누르면 알림 "같은 카테고리(소분류) 상품끼리만 비교할 수 있어요." (가정: 문구)
- 가정: 검색어·필터를 바꿔도 선택은 유지 (여러 번 검색해 고른 것을 같이 비교). 페이지를 넘겨도 유지되는 건 PR 5 에서 확인.

---

## PR 4 — 메뉴·내 활동내역·내 거래이력·검색 범위 탭

### 헤더·마이페이지

헤더 사용자 메뉴: 마이페이지 · 내 활동내역 · 내 거래이력 · 로그아웃. 장바구니는 헤더 아이콘 그대로. 마이페이지 바로가기도 같은 둘.

### 내 활동내역 `/my/activity?tab=requests|sales|purchases` (기본 `requests`)

| 탭 | 내용 | 데이터 |
|---|---|---|
| 요청 | 받은 견적 [수락]·[거절], 받은 구매요청 [취소]. 진행 중만 | 판매자 거래 목록 (`견적요청`, `구매요청`) |
| 판매 | 지금 내 판매글 화면 그대로 (검색·필터·행 안 수정). "구매요청 N건" → 같은 페이지 요청 탭, 그 매물로 걸러서 | 검색 `mine` |
| 구매 | 보낸 견적, 구매중. 진행 중만 | 구매자 거래 목록 (`견적요청`, `견적수락`, `견적거절`, `구매요청`) |

### 내 거래이력 `/my/history?tab=all|buy|sell`

`trd_trade_history` 에서 읽는다. 구매 = `user_id` 가 나, 판매 = `seller_id` 가 나. 줄: 확정일시·상품명·상대 닉네임·단가·수량·금액, 전체 탭은 구매/판매 표시. 새 API `GET /api/v1/trades/history?side=all|buy|sell`.

### 검색 범위 탭 (`/search` 맨 위)

| 내 데이터 | 탭 |
|---|---|
| 판매만 (내 매물 1개 이상, 판매중·판매완료) | [전체 · 내 판매] |
| 구매만 (`구매검토` 아닌 구매자 거래 행 또는 거래이력 1건 이상) | [전체 · 내 구매] |
| 둘 다 | [전체 · 내 판매 · 내 구매] |
| 둘 다 없음 · 비로그인 | 탭 줄 없음 |

- 판정 API: `GET /api/v1/trades/scopes` → `{ sales, purchases }`. 거래 도메인이 매물 서비스를 부른다(거래 → 매물 방향이라 순환 없음).
- 내 구매 결과: 내가 거래한 매물(진행 중 + 구매확정). 거래 도메인의 `GET /api/v1/trades/listings` 가 내 거래의 매물 키를 모아 매물 검색 서비스에 넘긴다(같은 필터·같은 응답).

### 지우는 화면

`/my/listings`, `/my/sales`, `/my/purchases` 는 내 활동내역 탭으로 옮기고 지운다. 링크(홈 아이콘 줄·결과 대화상자 [내 구매목록] 등)는 새 주소로.

---

## PR 5 — 커서 기반 페이지 번호

- 화면: `‹ 1 2 3 … 10 ›` + 전체 건수. 주소 `?page=N`(1부터). 필터·검색어가 바뀌면 1페이지. 새로고침·뒤로가기에 같은 페이지.
- 서버: 같은 조건으로 ① 전체 건수와 20개마다 경계 키(정렬 키) 목록을 한 쿼리로 구하고, ② 요청 페이지의 경계 키부터 키셋으로 20개를 읽는다. 응답 `{ items, page, totalPages, totalCount }`.
- 쓰는 곳: 검색(전체·내 판매·내 구매), 내 활동내역 세 탭, 내 거래이력. [더 보기]는 이 화면들에서 없앤다. 장바구니(최대 100)·상품마스터 검색(10)·카테고리(239)·`/listings/mine` 은 그대로.
- 규칙 변경: `backend.md` "목록은 `{ items, nextCursor }`" 에 페이지 번호 응답 형태를 더한다. offset 금지는 유지. decisions.md 에 기록.
- 감수: 경계 계산이 조건에 맞는 행의 키를 전부 훑는다(전체 건수 세기와 비슷한 비용). 매물이 수만 건을 넘어 느려지면 다시 본다.

---

## 문서

PR 마다 같은 PR 에서: `docs/data-model.md`, `docs/security.md`(입력 규칙), `docs/decisions.md`(아래), `docs/design.md`(PR 4·5), `bruno/`(새 API).

decisions.md 새 항목 / 뒤집는 결정:
- 2026-09-29 매물 복합 PK·FK → 정의서 복합키, FK 없음
- 2026-10-13 카테고리 코드 체계(상품마스터 → `trd_ctgr_code` FK) → 상품마스터 대·중·소 조각 + `trd_ctgr_master`
- 2026-10-20 "TYPE 은 만들 때 정하고 안 바뀐다" → 장바구니 행은 구매·견적으로 넘어갈 때 TYPE 이 바뀐다
- 2026-10-20 견적은 납품희망일을 받지 않는다 → 받는다(필수)
- 2026-10-21 장바구니 행 재활용 안 함 → 같은 거래 행을 바꾼다
- 2026-10-22 비교는 화면만 → `비교용` 행 저장
- 10/23 PK 계획 → 이 설계로 대체
- 무중단 규칙 예외(운영 전 1회 배포), offset·커서 규칙 변경

## 테스트

- 각 PR: 바뀐 영역 Testcontainers 통합 테스트 + 서비스 단위 테스트. 마이그레이션은 기존 데이터가 있는 상태에서 옮겨지는지(백필·조각 나누기·장바구니 이전) 테스트.
- PR 1: 같은 초 다른 상품 409, 남의 userId 매물 주소 404, 거래 있는 매물 삭제 409(FK 없이), 납품희망일 필수(구매·견적), 거래 `reg_date` 채움.
- PR 2: 재사용 규칙(네 값 같으면 재사용, 하나라도 다르면 새로), 카테고리 조각 저장·이름 경로·필터.
- PR 3: 담기(입력·검증), 비교 담기, 장바구니 → 구매·견적 시 같은 거래ID, 빼기, 매물 삭제 시 두 테이블 정리.
- PR 4: 범위 판정 4경우, 내 구매 결과, 거래이력 탭, 남의 거래 안 보임.
- PR 5: 페이지 경계(마지막 페이지·빈 결과·범위 밖 page 400), 필터 바뀌면 1페이지.
- E2E: PR 마다 그 흐름 spec 1번 (purchase·quote·cart·compare·flow).

## 가정 (검토 때 확인)

1. ~~가정~~ 확정(사용자 2026-10-29 "장바구니에서 비교 빼"): 비교 화면: 검색 목록에서 체크 → [비교] → `비교용` 행 저장 → 비교 화면이 내 `비교용` 행을 보인다. 지금 규칙(같은 소분류 2~4개, 값 강조·배지·열마다 [견적 요청]·[구매]·[빼기])은 그대로. 장바구니 화면의 [비교] 버튼은 없앤다.
2. ~~가정~~ 확정(사용자): 같은 매물은 장바구니·비교에 각각 1줄. 이미 담긴 매물을 다시 담으면(다른 수량이어도) 건너뛰고 처음 값을 유지, "이미 담김"을 알린다.
3. 보증년수 입력 범위 0 ~ 50.
4. 내 활동내역 구매 탭의 "진행 중"은 `견적요청`·`견적수락`·`견적거절`·`구매요청`.
5. 장바구니 1시간 만료는 이 설계 밖(다음 작업).
