# 데이터 모델

> 현재 계정 데이터는 `users` 한 테이블에 둔다. 다른 계정 테이블은 사용하지 않는다.
> 매물 스키마(`products`, `listings`)는 사용자가 제공한 레거시 스펙을 그대로 옮긴 초안이다. PRD 확정 전이라 카테고리 마스터·이미지 구조·상태값 체계는 다시 바뀔 수 있다. 거래 스키마는 아직 없다 (채팅은 기능에서 제외, decisions.md 2026-10-01).

## 계정: `users`

단일 계정 테이블은 `V202609281200__replace_user_account_model.sql`에서 생성한다. 마이그레이션은 기존 계정 테이블과 데이터를 제거하므로 개발 DB를 초기화한 뒤 적용한다.

| 컬럼 | 타입 | 용도 |
|---|---|---|
| `id` | uuid | 내부 사용자 ID, PK |
| `user_id` | varchar(20) | 개인 로그인 ID. 기업 행은 사업자번호를 같이 둔다 |
| `password` | varchar(200) | bcrypt 비밀번호 해시 |
| `user_class` | varchar(10) | `personal` 또는 `business` |
| `user_name` | varchar(50) | 개인 이름 또는 기업 담당자 이름 |
| `user_phone`, `user_tel` | varchar(20) | 휴대전화·전화번호 |
| `user_email` | varchar(100) | 이메일 |
| `user_address` | varchar(200) | 사용자 주소 |
| `bus_reg_id` | varchar(20) | 기업 사업자등록번호 |
| `company_type` | varchar(10) | `corporate` 또는 `individual` (`corporation` UI 값은 저장 시 `corporate`로 변환) |
| `company_name` | varchar(50) | 회사명 |
| `company_open_date` | varchar(10) | 개업일 |
| `company_tel` | varchar(20) | 회사 전화번호 |
| `company_address` | varchar(200) | 회사 주소 |
| `dt_reg`, `dt_update`, `dt_expire` | varchar(14) | 등록·갱신·만료 시각 (`yyyyMMddHHmmss`) |
| `user_nickname` | varchar(100) | 별칭 |
| `nickname_usage` | varchar(1) | `Y`면 별칭 사용, 아니면 이름/회사명을 표시 |
| `contact_method` | varchar(1) | 연락 수단 (`1` 전체, `2` 전화, `3` 이메일) |
| `spare_col` | varchar(40) | 예비 컬럼. 현재 가입 흐름에서는 사용하지 않음 |
| `role`, `status`, `must_change_password`, `deleted_at` | 운영 컬럼 | 권한·계정상태·초기 비밀번호 변경·탈퇴 처리를 위해 추가 |

인덱스: 활성 `user_id` 유일, 기업 `bus_reg_id` 유일, 활성 이메일·전화번호·사용 별칭 유일, `(user_class, status)` 조회 인덱스.

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

### products (TRD_PROD_MASTER — 상품마스터)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| prod_id | varchar(20) | PK | 레거시 비즈니스 키를 그대로 PK로 씀 (uuid 서로게이트 없음, 2026-09-29 지시). 자동생성: `KP-연도-일련번호6자리`(예 `KP-2026-000001`), 일련번호는 한국 날짜 기준 해마다 1부터 (2026-10-08). 그 전에 만든 행은 옛 형식(카테고리 8자+4자리) 그대로 |
| category_code | varchar(10) | not null | 카테고리마스터 참조 값이나, 카테고리마스터 테이블은 아직 없음 |
| prod_name | varchar(50) | not null | |
| prod_no | varchar(20) | | 제조사 번호(코드) |
| prod_brand | varchar(50) | not null | |
| prod_mufc_date | varchar(14) | | 제조일시 |
| prod_spec_info | varchar(100) | | 제조사 제공 자유 기재 |
| prod_data_sheet | varchar(100) | | 경로정보 |
| prod_photo_1 | varchar(100) | | 경로정보. 상품 처음 등록 시 그 매물의 첫 사진 키를 그대로 씀 (파일 공유) |
| reg_date | varchar(14) | not null | 등록일시 |
| spare_col | varchar(100) | | 예비 컬럼 |

### listings (TRD_REG_INFO — 상품등록 정보)

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| user_id | uuid | PK(복합), FK→users | 레거시 "사용자ID". 로그인 아이디 문자열이 아니라 users.id(uuid). 조직(seller_org_id)은 넣지 않음 — decisions.md 미정 항목을 이 커밋에서 확정 |
| reg_date | varchar(14) | PK(복합), not null | 등록일시(일시분초). user_id 와 복합 PK — 같은 사용자가 같은 초에 두 번 등록하면 409(코드리뷰로 조용한 덮어쓰기 버그를 고침, 2026-09-29) |
| prod_id | varchar(20) | not null, FK→products(prod_id) | |
| trade_type | varchar(20) | not null | 거래종류 (등록) |
| prod_state | varchar(20) | not null | 상품상태 (레거시: "신품대비 00%" 자유 텍스트) |
| sales_unit_price | integer | not null | 등록단가 |
| sales_quantity | integer | not null | 등록수량 |
| min_order_quantity | integer | not null, default 1 | |
| order_unit | integer | not null, default 1 | |
| delivery_date | varchar(10) | | 납기일(제공가능일). **레거시 스펙엔 물리명이 REG_DATE 로 등록일시와 중복 기재되어 있어 분리함** |
| stock_quantity | integer ? | | 재고수량. 비우면 등록수량(sales_quantity)으로 채운다(레거시 기본값 "판매수량") |
| prod_description | varchar(200) | | |
| prod_data_sheet | varchar(100) | | |
| prod_photo_1~3 | varchar(100) | | 경로정보 |
| prod_image_4 | varchar(100) | | 경로정보. 레거시 물리명이 다른 사진 컬럼과 다름(PROD_IMAGE_4) — 그대로 유지 |
| warranty_period | integer ? | | 보증기한(일) |
| warranty_coverage | varchar(10) | | 불량지원방법 (대체/환불) |
| replace_prod | varchar(100) | | 대체품 경로정보 |
| test_report | varchar(100) | | 경로정보 |
| certificate_of_authen | varchar(100) | | 정품인증서 경로정보 |
| dt_update | varchar(14) | | 최종갱신일시 |
| dt_expire | varchar(14) | | 거래완료일시 |
| spare_col | varchar(100) | | |

경로정보 컬럼(사진·데이터시트·대체품·테스트리포트·정품인증서)은 URL이 아니라 **저장소 키** — `POST /api/v1/uploads`가 돌려준 `public|private/listings/<종류>/yyyy/MM/<uuid>.<ext>` (최대 80자). 파일은 `GET /api/v1/files/{key}`로 연다 (security.md "파일 업로드", decisions.md 2026-10-02).

인덱스: `U (prod_name, prod_brand)` on products (동시 등록 경합 시 재사용 판단의 근거 — 코드리뷰 지적으로 추가, 2026-09-29), `(prod_id)`·`(reg_date)` on listings (FK·목록 조회용).
제약: `products`·`listings` 엔티티는 PK를 직접 채우므로(uuid `@GeneratedValue` 없음) `Persistable` 구현 필수 — 없으면 Spring Data가 항상 `merge`(UPDATE)를 타서 중복 키를 조용히 덮어쓴다(코드리뷰로 발견, 2026-09-29 수정). 매물 목록 커서는 `reg_date` 단독이 아니라 `reg_date_userId` 복합값 — 같은 초에 다른 사용자가 등록하면 reg_date만으로는 페이지 경계에서 소실될 수 있어서.

검색(`GET /api/v1/listings`, 2026-10-02): 상품명·상품번호·제조사(`products`)에 낱말별 `lower(...) like`, 거래상태는 `listings.dt_expire` 유무, 가격·재고·납기일은 `listings` 컬럼. 검색용 인덱스는 없다 — 느린 게 측정되면 pg_trgm 등 검토. 카테고리 필터는 마스터가 정해질 때까지 없음.

**다음에 정할 것**: PRD 작성 시 카테고리 마스터 테이블 여부, 이미지 다건 구조(별도 테이블) 전환, prod_state enum화, 조직(seller_org_id) 도입 여부, quantity·가격 검증 규칙(`security.md`).
