# 데이터 모델

> 현재 계정 데이터는 `trd_user_info` 한 테이블에 둔다. 다른 계정 테이블은 사용하지 않는다.
> 매물 스키마(`trd_prod_master`, `trd_prod_reg`)는 사용자가 제공한 레거시 스펙을 그대로 옮긴 초안이다. PRD 확정 전이라 카테고리 마스터·이미지 구조·상태값 체계는 다시 바뀔 수 있다. 거래 스키마(`trd_trade_info`, `trd_trade_history`)는 직접 구매·견적·장바구니가 쓴다 — 비교는 화면만이라 행이 없다(2026-10-22) (채팅은 기능에서 제외, decisions.md 2026-10-01).

> 모든 테이블·컬럼에 정의서 논리명(한글)을 DB 코멘트로 달았다(`V202611051100__comment_korean_names.sql`, 2026-11-05). DBeaver·pgAdmin·ERD 도구에서 한글로 보이는 표시용이고 이름·타입·제약은 그대로다. 값은 `DevTableAliases`(임시 테이블 별명)와 같고 `DevTableAliasTest` 가 둘이 같은지 확인한다 — 새 컬럼을 만들면 코멘트와 별명을 같이 단다.

## 계정: `trd_user_info`

단일 계정 테이블은 `V202609281200__replace_user_account_model.sql`에서 생성한다. 마이그레이션은 기존 계정 테이블과 데이터를 제거하므로 개발 DB를 초기화한 뒤 적용한다.

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `uid` | varchar(11) | 사용자 식별자, PK. `UP` + 가입일(한국) `yyMMdd` + 그날의 일련번호 3자리 (예 `UP261008001`, 2026-11-20 부터 — 그 전엔 uuid). 하루 999명을 넘으면 가입 거절 |
| `user_id` | varchar(20) | 로그인 아이디 (개인·기업 공통, 2026-10-13부터 기업도 직접 정함). 그 전에 가입한 기업 행은 사업자번호가 들어 있다 |
| `password` | varchar(200) | bcrypt 비밀번호 해시 |
| `user_class` | varchar(10) | `personal` 또는 `business` |
| `user_name` | varchar(50) | 개인 이름 또는 기업 담당자 이름 |
| `user_phone` | varchar(20) | 휴대전화 |
| `user_email` | varchar(100) | 이메일 |
| `user_address` | varchar(200) | 사용자 주소 |
| `bus_reg_id` | varchar(20) | 기업 사업자등록번호 |
| `company_type` | varchar(10) | `corporate` 또는 `individual` (`corporation` UI 값은 저장 시 `corporate`로 변환) |
| `company_name` | varchar(50) | 회사명 |
| `company_open_date` | varchar(10) | 개업일 YYYYMMDD. 기업 가입 때 필수로 받는다(API 검증). DB 는 선택 — 기업 행 필수 제약은 `V202610131200` 에서 뺐다 (사용자 제공 표에서 필수 아님) |
| `company_tel` | varchar(20) | 회사 전화번호 |
| `company_address` | varchar(200) | 회사 주소 |
| `dt_reg`, `dt_update`, `dt_expire` | varchar(14) | 등록·갱신·만료 시각 (`yyyyMMddHHmmss`) |
| `user_nickname` | varchar(100) | 별칭 |
| `nickname_usage` | varchar(1) | `Y`면 별칭 사용, 아니면 이름/회사명을 표시 |
| `contact_method` | varchar(1) | 연락 수단 (`1` 전체, `2` 전화, `3` 이메일) |
| `spare_col` | varchar(40) | 약관 동의 기록 `terms:<약관 판>@<동의 시각 UTC yyyyMMddHHmmss>` (2026-10-13~, 동의 이력 테이블이 없어 축약). 그 전 가입 행은 비어 있음 |

인덱스: `user_id` 유일, 기업 `bus_reg_id` 유일, 사용 별칭 유일 (이메일 유일 제약은 2026-11-20, 휴대폰 유일 제약은 2026-11-24 에 없앴다), `user_class` 조회 인덱스. 역할·상태·탈퇴·`user_tel` 컬럼은 2026-10-13에 정의서 기준으로 삭제했다 (decisions.md 2026-10-13).

### 저장 규칙

- 비밀번호는 bcrypt 해시만 저장한다.
- 개인 로그인은 `user_id`, 기업 로그인은 `bus_reg_id`로 한 행을 조회한다.
- 개인은 `nickname_usage='Y'`일 때 `user_nickname`, 아니면 `user_id`를 표시한다. 기업은 `company_name`을 표시한다.
- 기업 정보는 해당 기업 사용자의 같은 행에 저장한다. `organizations`와 `organization_members`는 사용하지 않는다.
- 개인 가입은 약관·본인인증 단계 없이 사용자 입력값을 저장한다. 동의 이력은 현재 수집하지 않으므로 운영 공개 전 별도 동의 절차가 필요하다.
- 현재 제공된 컬럼 길이대로 이름·전화·이메일 등은 일반 문자열로 저장된다. 컬럼 암호화가 필요하면 길이와 저장 형식을 포함해 스키마를 다시 정해야 한다.
- CI/DI를 저장하지 않으므로 본인인증 기준의 재가입 차단은 없다.
- 소셜 로그인은 일시 비활성(코드 주석 처리)이며 소셜 계정 테이블을 두지 않는다. 재활성화 시 저장 방식을 다시 정한다.

## 매물 — 레거시 스펙 초안 (`prd.md` 전, 재검토 예정)

> 구현: `V202609291000__create_product_listing_tables.sql`. 사용자가 제공한 레거시 테이블 정의(TRD_PROD_MASTER, TRD_REG_INFO)를 그대로 옮긴 것. PRD 확정 전 초안이라 카테고리 마스터·이미지 구조(고정 컬럼 vs 별도 테이블)·상태값 체계(자유텍스트 vs enum)는 다시 바뀔 수 있다.

### trd_ctgr_code (TRD_CTGR_CODE — 카테고리 코드)

> 구현: `V202610131520__create_ctgr_code.sql`. 엑셀 `CATG_CD_DATA` 239행을 시드로 넣는다. 결정: decisions.md 2026-10-13 카테고리 코드 체계.

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| category_code | varchar(12) | PK | 대·중·소 전체 경로 (`P01-Q01-R001`) |
| category_name | varchar(50) | not null | |
| category_depth | varchar(20) | not null | 개인/사무용·기업용·일반 |
| category_class | varchar(2) | not null | 대/중/소 |
| parent_code | varchar(20) | null | 부모의 조각 코드(`Q01`), 대분류는 null. 조각이라 PK 를 가리키지 못해 외래키 없음 |
| is_display | char(1) | not null default 'Y' | |
| sort_order | integer | null | |
| reg_date | varchar(14) | not null | yyyyMMddHHmmss |
| spare_col | varchar(10) | null | |

### trd_ctgr_master (TRD_CTGR_MASTER — 카테고리 마스터)

> 구현: `V202610281000__create_ctgr_master.sql`. `trd_ctgr_code` 239행을 조각 코드로 옮겨 채운다. 상품마스터의 대·중·소 조각을 확인(부모 관계)하고 이름 경로를 만든다. 카테고리 패널은 계속 `trd_ctgr_code`. 결정: decisions.md 2026-10-28.

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| category_code | varchar(12) | PK | 조각 코드(`R001`). 정의서 4 — 나중에 코드 체계가 바뀔 수 있어 12 (사용자 결정) |
| category_name | varchar(50) | not null | |
| category_depth | varchar(2) | not null | 분류레벨 대/중/소 (`trd_ctgr_code.category_class` 값) |
| parent_code | varchar(20) | null | 부모 조각, 대분류는 null (정의서 NOT NULL, 사용자 결정) |
| is_display | char(1) | not null default 'Y' | |
| sort_order | integer | null | |
| reg_date | varchar(14) | not null | yyyyMMddHHmmss |
| spare_col | varchar(10) | null | |

### trd_prod_master (TRD_PROD_MASTER — 상품마스터)

> 개발용 샘플 50건(`KP-2026-000001~050`)은 `db/seed/R__seed_dev_prod_master.sql`. 로컬 `FLYWAY_LOCATIONS` 에 `db/seed` 가 있을 때만 들어간다 (decisions.md 2026-10-19).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| prod_id | varchar(20) | PK | 레거시 비즈니스 키를 그대로 PK로 씀 (uuid 서로게이트 없음, 2026-09-29 지시). 자동생성: `KP-연도-일련번호6자리`(예 `KP-2026-000001`), 일련번호는 한국 날짜 기준 해마다 1부터 (2026-10-08). 그 전에 만든 행은 옛 형식(카테고리 8자+4자리) 그대로 |
| prod_name | varchar(50) | null | 정의서 nullable. 직접 입력 등록은 필수(서버 검사) |
| prod_part_no | varchar(20) | | 파트넘버 (2026-10-28 `prod_mpn` 에서 이름 변경). API 이름은 `prodNo` |
| prod_brand | varchar(40) | null | 정의서 40·nullable. 직접 입력 등록은 필수(서버 검사) |
| prod_class_no | varchar(20) | | 물품분류번호 |
| major_category, middle_category, minor_category | varchar(40) | | 카테고리 조각(`P01`·`Q01`·`R001`). 등록·수정 API 가 `trd_ctgr_master` 부모 관계로 검사. API 의 `categoryCode` 는 세 조각을 `-` 로 이은 경로 (2026-10-28, 옛 `category_code` 를 나눠 채움) |
| prod_spec_info | varchar(100) | | 제조사 제공 자유 기재 |
| prod_useful_life | integer | | 보증년수 — 값은 개월 수, 목록 3·6·…·60 (사용자 결정 2026-10-28) |
| warranty_method | varchar(20) | | 정품보증방법 |
| alter_prod_name | varchar(40) | | 대체상품명 |
| prod_data_sheet | varchar(100) | | 경로정보 (정의서 40, 저장 키 길이로 100) |
| prod_image | varchar(100) | | 경로정보 (2026-10-28 `prod_photo_1` 에서 이름 변경, 정의서 40 → 100). 상품 처음 등록 시 그 매물의 첫 사진 키를 그대로 씀 (파일 공유). API 이름은 `prodPhoto1` |
| reg_date | varchar(14) | null | 등록일시 (정의서 nullable, 서버는 항상 채움) |
| spare_col | varchar(100) | | 예비 컬럼 |

같은 상품 = 이름·제조사·분류번호가 모두 같음(사양은 안 봄. 제조일은 2026-11-04 에 기준에서 뺐다 — 제조일이 달라 따로 있던 옛 마스터가 여럿이면 prod_id 가 작은 것을 쓴다). 직접 입력 등록은 같은 상품이 있으면 재사용, 없으면 새로 만든다. 동시 생성은 `pg_advisory_xact_lock(hashtext('prod-master'))` 로 줄 세운다(unique 대신, 2026-10-28).

### trd_prod_reg (TRD_PROD_REG — 상품등록 정보)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | uuid | PK(복합) | 레거시 "사용자ID". 로그인 아이디 문자열이 아니라 trd_user_info.uid(varchar(11), 2026-11-20 부터). 조직(seller_org_id)은 넣지 않음 — decisions.md 미정 항목을 이 커밋에서 확정 |
| reg_date | varchar(14) | PK(복합), not null | 등록일시(일시분초). 같은 사용자가 같은 초에 두 번 등록하면 409 — 서버가 사용자별 잠금으로 막아(2026-10-27) 매물 주소의 (user_id, reg_date) 두 값으로도 매물 하나 |
| prod_id | varchar(20) | PK(복합) | 정의서 PK 세 값 중 하나 (2026-10-27). 매물 수정에서 상품을 바꾸면 이 값과 그 매물을 가리키는 거래 행의 prod_id 가 같이 바뀐다 |
| trade_type | varchar(20) | not null | 거래종류 (등록) |
| prod_state | varchar(20) | not null | 상품상태 (레거시: "신품대비 00%" 자유 텍스트) |
| sales_unit_price | integer | not null | 등록단가 |
| sales_quantity | integer | not null | 등록수량 |
| min_order_quantity | integer | default 1 | 정의서대로 NOT NULL 아님 (서버는 늘 채운다) |
| order_unit | integer | default 1 | 같음 |
| prov_date | varchar(10) | not null | 제공가능일(납기일) yyyyMMdd (2026-11-20 부터 숫자만, 그 전 행은 yyyy-MM-dd — 변환 마이그레이션은 db/ PR). 등록·수정에서 필수 (2026-10-27, 그 전 빈 행은 등록일로 채움). **레거시 스펙엔 물리명이 REG_DATE 로 등록일시와 중복 기재되어 있어 분리함** |
| stock_quantity | integer ? | | 재고수량. 비우면 등록수량(sales_quantity)으로 채운다(레거시 기본값 "판매수량") |
| prod_description | varchar(200) | | |
| prod_data_sheet | varchar(100) | | |
| prod_photo_1~3 | varchar(100) | | 경로정보 |
| prod_image_4 | varchar(100) | | 경로정보. 레거시 물리명이 다른 사진 컬럼과 다름(PROD_IMAGE_4) — 그대로 유지 |
| warranty_period | integer ? | | 보증기한(일) |
| warranty_coverage | varchar(10) | | 불량지원방법 (대체/환불) |
| replace_prod | varchar(100) | | 대체품 — 직접 입력한 글 (2026-10-13부터. 전엔 파일 경로. 옛 값은 그대로 두고 글로 보임) |
| test_report | varchar(100) | | 경로정보 |
| certificate_of_authenticity | varchar(100) | | 정품인증서 경로정보. 정의서 물리명 CERTIFICATE OF AUTHENTICITY 를 밑줄로 (2026-10-27, 전엔 prod_coa) |
| dt_update | varchar(14) | | 최종갱신일시 |
| dt_expire | varchar(14) | | 거래완료일시 |
| spare_col | varchar(100) | | |

경로정보 컬럼(사진·데이터시트·대체품·테스트리포트·정품인증서)은 URL이 아니라 **저장소 키** — `POST /api/v1/uploads`가 돌려준 `public|private/listings/<종류>/yyyy/MM/<uuid>.<ext>` (최대 80자). 파일은 `GET /api/v1/files/{key}`로 연다 (security.md "파일 업로드", decisions.md 2026-10-02).

인덱스: trd_prod_master 는 PK 만 (unique(이름, 제조사)는 2026-10-28 에 없앰), `(prod_id)`·`(reg_date)` on trd_prod_reg (목록 조회용). 외래키는 없다 (2026-10-27 — 정의서 FOREIGN KEY 표는 의미상 관계, 정합은 서버가 지킨다).
제약: `trd_prod_master`·`trd_prod_reg` 엔티티는 PK를 직접 채우므로(uuid `@GeneratedValue` 없음) `Persistable` 구현 필수 — 없으면 Spring Data가 항상 `merge`(UPDATE)를 타서 중복 키를 조용히 덮어쓴다(코드리뷰로 발견, 2026-09-29 수정). 매물 목록 커서는 `reg_date` 단독이 아니라 `reg_date_userId` 복합값 — 같은 초에 다른 사용자가 등록하면 reg_date만으로는 페이지 경계에서 소실될 수 있어서.

검색(`GET /api/v1/listings`, 2026-10-02): 상품명·상품번호·제조사(`trd_prod_master`)에 낱말별 `lower(...) like`, 거래상태는 `trd_prod_reg.dt_expire` 유무, 가격·재고·납기일은 `trd_prod_reg` 컬럼. 검색용 인덱스는 없다 — 느린 게 측정되면 pg_trgm 등 검토. 카테고리 필터는 상품마스터의 대·중·소 조각을 하나씩 비교 (2026-10-28).

## 거래: `trd_trade_info`, `trd_trade_history`

> 구현: `V202610151000__create_trade_tables.sql`. 사용자가 준 정의서(TRD_TRADE_INFO, TRD_TRADE_HISTORY)를 옮기고 아래 "정의서와 다른 점"만 바꿨다 (사용자 결정, 2026-10-15). 스펙: `docs/superpowers/specs/2026-10-15-purchase-design.md`.
> 코드 값은 지금은 한글 문자열이다. 나중에 공통코드 테이블과 숫자 코드로 바꾼다 (사용자 지시) — 변환은 백엔드 enum 한 곳.

### trd_trade_info (TRD_TRADE_INFO — 거래정보)

견적 요청 1건 또는 구매요청 1건 = 1행. 매물에서 가져올 수 있는 칸은 요청 때 서버가 복사한다(스냅샷 — 나중에 매물이 바뀌어도 그대로).

코드 값 (2026-10-20, `V202610201010` — 정의서 값으로 맞춤). TYPE 은 만들 때 정해지고 안 바뀐다, STATS 는 진행에 따라 앞으로만:

| trade_type | trade_stats 흐름 |
|---|---|
| `구매검토` | `장바구니`/`비교용` — **비교용만** 구매자·매물당 하나(`ux_trd_trade_info_one_compare`, V202611021000). 장바구니는 같은 매물도 담을 때마다 새 줄(새 거래, 2026-11-02 — 전엔 `ux_trd_trade_info_one_cart` 가 장바구니도 매물당 하나로 막았다). `trd_cart_info` 행과 짝(위). 빼기·매물 삭제는 두 행 삭제, 구매·견적은 장바구니 행을 같은 거래ID 로 바꿔 쓴다(2026-10-29). 내 구매목록·판매자 화면에 안 나온다. 단가는 담을 때 등록단가, 수량·납품희망일·요청사항은 담을 때 입력(장바구니) 또는 최소주문량·제공가능일(비교)이고, 화면엔 지금 매물 값을 보인다. |
| `견적조정` | `견적요청` → `견적수락` 또는 `견적거절` (판매자 수락·거절. 거절 뒤 구매자 재요청은 같은 행이 `견적요청`으로 돌아간다). 수락된 견적에서 [구매]하면 같은 행이 `구매요청` → `구매확정`으로 이어진다(TYPE 은 그대로, 사용자 결정 2026-10-21). 구매자·매물당 견적 단계(`견적요청`·`견적수락`·`견적거절`) 행은 하나(`ux_trd_trade_info_one_quote`, V202610211200) |
| `거래` | `구매요청` → `구매확정` |

취소는 값 없이 행을 지운다(견적 취소·거래 취소). 정의서 TYPE `요청중`은 쓰지 않는다. `견적수락`·`견적거절`은 정의서 밖 값 (사용자 결정 2026-10-21 — 처음엔 `견적회신` 하나였다가 사용자가 헷갈려 나눔, V202610211100). 구매자·매물당 견적 행은 하나(`ux_trd_trade_info_one_quote`).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | varchar(11) | PK(복합) | 구매자. 정의서 varchar(20) → uuid |
| trade_id | varchar(20) | PK(복합) | `yyMMddHH`(한국 시간) + 순번 3자리, 11자 (예 `26092917001`). 순번은 그 시간대 전체에서 001부터. 겹치지 않는 건 생성기(시간대 잠금)가 보장 — DB unique 는 2026-10-27 에 뺐다 |
| trade_type | varchar(20) | not null | 거래종류: 위 표 |
| seller_id | uuid | | 판매자. (seller_id, prod_reg_date, prod_id) = 매물 PK 세 값. 정의서 물리명 `USER_ID`가 구매자와 겹쳐 이름 변경 |
| prod_reg_date | varchar(14) | not null | 매물 등록일시 (정의서 PROD_REG_DATE, 2026-10-27 전엔 reg_date) |
| reg_date | varchar(14) | | 거래 등록일시 yyyyMMddHHmmss (한국) — 행을 만든 시각, 상태가 바뀌어도 그대로. 2026-10-27 전 행은 거래ID 앞 8자리 + `0000` |
| prod_id | varchar(50) | | 복사 (정의서 50). 매물 수정에서 상품이 바뀌면 그 매물의 거래 행도 새 값으로 (세 값으로 매물을 찾으므로) |
| prod_state | varchar(20) | | 복사 |
| sales_unit_price | integer | | 복사 (등록단가) |
| stock_quantity | integer | | 복사 (요청 시점, 줄이기 전) |
| min_order_quantity | integer | | 복사 |
| order_unit | integer | | 복사 |
| prov_date | varchar(10) | not null | 복사 (제공가능일, 2026-10-27 부터 매물에서 필수) |
| order_unit_price | integer | not null | 거래: = 등록단가 (구매자가 못 바꿈). 견적조정: 희망단가 (1 ~ 등록단가) |
| order_quantity | integer | not null | 구매자 입력, 기본 최소주문량 |
| req_deli_date | varchar(10) | not null | 납품희망일 yyyyMMdd (2026-11-20 부터 숫자만 — 입력은 2026-10-10·2026.10.10 도 받아 바꿔 저장). 구매·견적 모두 구매자 입력(필수), 화면 기본값은 제공가능일. 장바구니 행은 제공가능일 (2026-10-27, 그 전 빈 행은 제공가능일로 채움) |
| remarks | varchar(100) | | 요청사항 (견적은 비고) |
| trade_stats | varchar(10) | not null | 거래상태: 위 표 |
| spare_col | varchar(100) | | |

인덱스: `ix_trd_trade_info_listing (seller_id, prod_reg_date, prod_id)` (판매자 목록·매물별 요청 건수). `ix_trd_trade_info_trade_id (trade_id)` — 거래ID 로만 찾는 조회용 일반 인덱스(중복 금지 아님, 정의서 밖, 2026-10-27 사용자 승인). 부분 unique `ux_trd_trade_info_one_quote`(견적)·`ux_trd_trade_info_one_compare`(비교용) 도 `(user_id, seller_id, prod_reg_date, prod_id)`. 외래키 없음 — 매물 삭제 때 남은 거래 행이 있으면 서버가 409 `LISTING_HAS_TRADES`. 구매자 목록은 PK 앞부분 `user_id`.

### trd_cart_info (TRD_CART_INFO — 장바구니 정보)

> **정의서와 다른 점 (사용자 결정 2026-11-04)**: 정의서 CART_INFO 의 `MUFC_DATE`(제조일시)가 없다. 원본인 상품 제조일(`trd_prod_master.prod_mufc_date`)을 지우면서 같이 지웠다(`V202611050900`, decisions.md "제조일 삭제"). 정의서 파일은 사용자 쪽에서 고친다 — 정의서 헤더 그대로의 엑셀을 임시 테이블에 불러오면 "제조일시"가 모르는 컬럼으로 거절된다.

> 구현: `V202610291000__create_cart_info.sql`. 장바구니·비교 한 건 = `trd_trade_info` 1행(`구매검토`, 거래상태 `장바구니`|`비교용`) + 이 테이블 1행(같은 거래ID). 외래키 없음. 결정: decisions.md 2026-10-29.

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| user_id | uuid | PK(복합), not null | 구매자. 정의서 varchar(20) → uuid(`trd_user_info.uid`) |
| trade_id | varchar(20) | PK(복합), not null | 같은 거래ID 의 `trd_trade_info` 행이 있다 |
| ser_no | integer | PK(복합), not null | 그 구매자 행 중 최대 + 1 |
| cart_type | varchar(10) | | `장바구니` / `비교용` (정의서 설명 "방바구니/비교용바구니"는 오타) |
| seller_id | uuid | | 판매자 |
| prod_date | varchar(14) | not null | 상품등록일시 = 매물 `reg_date` (정의서 물리명 REG_DATE 가 셋이라 이름을 나눔) |
| prod_name | varchar(50) | not null | 담을 때 상품마스터에서 복사 |
| prod_no | varchar(20) | not null | 상품고유ID(`prod_id`). 매물은 `seller_id` + `prod_date` + `prod_no` 로 찾는다. 매물 상품이 바뀌면 따라간다 |
| manufacturer | varchar(50) | | 제조사(`prod_brand`) |
| prod_spec_info | varchar(100) | not null | 사양. 비면 `''` |
| prod_state | varchar(20) | not null | |
| prov_date | varchar(10) | not null | 제공가능일 |
| order_unit_price | integer | not null | 담을 때 등록단가 |
| order_quantity | integer | not null | 장바구니: 담을 때 입력, 비교: 최소주문량 |
| req_deli_date | varchar(10) | not null | 장바구니: 담을 때 입력(기본 제공가능일), 비교: 제공가능일 |
| remarks | varchar(100) | | 요청사항 |
| reg_date | varchar(14) | not null | 담은 시각 |

장바구니 → 구매·견적: 이 테이블 행을 지우고 같은 `trd_trade_info` 행이 `거래`/`구매요청` 또는 `견적조정`/`견적요청` 으로 바뀐다(같은 거래ID). 같은 매물의 견적 행이 이미 있으면 그 행을 덮어쓰고 장바구니 두 행만 지운다. 비교 행은 구매·견적과 무관하게 남는다. 비교는 [비교]를 누를 때마다 내 `비교용` 행(두 테이블)을 지우고 이번 선택(같은 소분류 2~4개)으로 새로 담는다. `ux_trd_trade_info_one_cart` 는 `(user_id, seller_id, prod_reg_date, prod_id, trade_stats) where trade_type='구매검토'` — 한 매물이 장바구니와 비교에 각각 1줄.

### trd_trade_history (TRD_TRADE_HISTORY — 거래이력)

거래가 완료된(구매확정) 거래만 1줄. 취소는 쌓지 않는다 (거래정보 행도 지워진다, 2026-10-20).

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | uuid | PK(복합) | 구매자 (정의서 USER_ID, 2026-10-27 전엔 buyer_id) |
| trade_id | varchar(20) | PK(복합) | |
| trade_date | varchar(14) | PK(복합) | 확정일시 yyyyMMddHHmmss |
| prod_id | varchar(50) | not null | 구매 때 상품ID (정의서 50) |
| trade_type | varchar(10) | not null | `거래` (2026-10-20 전엔 `구매확정`) |
| seller_id | uuid | not null | 정의서 물리명이 논리명과 뒤바뀜(판매자=BUYER_ID) → 바로잡음 |
| trade_unit_price | integer | | |
| trade_quantity | integer | | |
| trade_amount | integer | | 단가 × 수량 (int 범위를 넘는 주문은 요청 때 거절) |
| spare_col | varchar(100) | | |

인덱스: `ix_trd_trade_history_seller` (판매 이력). 구매 이력은 PK 앞자리 `user_id`. 외래키 없음 (2026-10-27). 지금 흐름은 거래 1건 = 이력 1줄이지만 PK 는 정의서대로 둔다(나중 견적·분할 확정).

## 문의 게시판: `trd_inquiry`, `trd_inquiry_reply`

> 구현: `V202611181000__create_inquiry_tables.sql`. 사내 테스트용 익명 게시판 — 정의서 밖 보조 테이블이라 이름·컬럼은 사용자 승인(2026-11-18). 작성자(uid·IP)를 저장하지 않는다. 외래키 없음(2026-10-27 방침) — 글 존재는 서버가 확인한다. **운영 공개 전 제거 대상**(decisions.md 2026-11-18, 스펙 `docs/superpowers/specs/2026-11-18-inquiry-board-design.md`).

| 테이블 | 컬럼 | 타입 | 제약 |
|---|---|---|---|
| `trd_inquiry` | id | uuid | PK |
| | title | varchar(100) | not null |
| | content | varchar(2000) | not null |
| | author_uid | uuid | null. 작성자(`trd_user_info.uid`, 외래키 없음). 익명 시절 글은 없음. 응답에 내지 않는다 (`V202611191000`) |
| | created_at, updated_at | timestamptz | not null |
| `trd_inquiry_reply` | id | uuid | PK |
| | inquiry_id | uuid | not null. 글의 id (외래키 없음) |
| | content | varchar(1000) | not null |
| | author_uid | uuid | null. 위와 같다 |
| | created_at, updated_at | timestamptz | not null |

인덱스: `ix_trd_inquiry_created (created_at desc, id desc)` 목록 커서용, `ix_trd_inquiry_reply_inquiry (inquiry_id, created_at)`. 임시 테이블 화면(`/dev/tables`) 화이트리스트에는 넣지 않았다.

**다음에 정할 것**: PRD 작성 시 이미지 다건 구조(별도 테이블) 전환, prod_state enum화, 조직(seller_org_id) 도입 여부, quantity·가격 검증 규칙(`security.md`).
