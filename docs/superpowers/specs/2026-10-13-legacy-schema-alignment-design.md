# 레거시 정의서에 스키마 맞추기 (상품마스터·판매물품·유저·카테고리)

> 2026-10-13. 사용자가 준 테이블 정의서(엑셀 `KPIT-BRK-DATA-20261002.xlsm`의 `PROD_MASTER`·`PROD_REG`·`USER_INFO`·`CTGR_CODE` 시트, 대화로 받은 수정본)에 DB를 맞춘다.
> 9/29 결정(물리명 `products`·`listings`·`users`)과 CLAUDE.md "권한은 역할 기반"을 뒤집는다 — 이유는 decisions.md 2026-10-13 항목.

## 목적

물리 테이블·컬럼을 정의서대로 맞춘다. 정의서에 없는 컬럼은 지우고(사용자 지시), 정의서와 다르게 둘 곳은 아래 "정의서와 다른 점"에만 둔다.

## 사용자 결정 (대화 2026-10-13)

- 테이블명은 정의서 물리명. 판매물품은 `TRD_PROD_REG` (엑셀의 `TRD_PROG_REG` 는 오타). Claude가 테이블명을 정하지 않는다.
- 카테고리 코드는 대·중·소 전체 경로(`P01-Q01-R001`) varchar(12). 상품마스터·판매물품 쪽도 12.
- 부모 카테고리는 조각만(`Q01`), NULL 허용(대분류).
- 상품마스터 `PROD_MPN` NOT NULL 은 상품마스터 화면을 만들 때. 지금은 이름만 바꾼다.
- 파일 경로 칸 길이는 100 유지 (정의서 40·14·50 이면 파일 키가 안 들어간다).
- 유저 PK `UID` 는 uuid. 정의서에 없는 `user_tel`·`role`·`status`·`must_change_password`·`deleted_at` 은 지운다.
- 정의서가 없는 테이블(`social_accounts`·`identity_verifications`·`terms_agreements`·`organizations`·`organization_members`)은 그대로 둔다.
- 개발 데이터는 버린다 — Docker 볼륨 초기화 후 마이그레이션을 처음부터 다시 돌린다. 그래서 이름 변경을 배포 2회로 나누지 않는다 (운영 데이터 없음).
- 카테고리 데이터는 엑셀 `CATG_CD_DATA` 시트를 시드로 넣고, 상품마스터 `category_code` 에 외래키를 건다.

## 스키마

### trd_ctgr_code (새로)
| 컬럼 | 타입 | 제약 |
|---|---|---|
| category_code | varchar(12) | PK |
| category_name | varchar(50) | not null |
| category_depth | varchar(20) | not null (개인용/기업용/일반) |
| category_class | varchar(2) | not null (대/중/소) |
| parent_code | varchar(20) | null (조각 코드. 자기 참조 외래키 없음 — 조각이라 PK 를 바로 가리키지 못한다) |
| is_display | char(1) | not null default 'Y' |
| sort_order | integer | |
| reg_date | varchar(14) | not null |
| spare_col | varchar(10) | |

### trd_prod_master (← products)
- `prod_no` → `prod_mpn` (null 허용 유지), `prod_scan_code varchar(20)` 추가.
- `category_code` varchar(10) → varchar(12), 외래키 → `trd_ctgr_code(category_code)`.
- 그 외 컬럼·길이 그대로 (`prod_data_sheet`·`prod_photo_1` 은 100).
- 유니크 인덱스(상품명+제조사)는 정의서에 없지만 임시 등록 폼의 상품 찾기가 쓰므로 상품마스터 화면 전까지 둔다.

### trd_prod_reg (← listings)
- `delivery_date` → `prov_date`, `certificate_of_authen` → `prod_coa`.
- 외래키: `user_id` → `trd_user_info(uid)`, `prod_id` → `trd_prod_master(prod_id)`.
- 경로 칸(`prod_image_4`·`replace_prod`·`test_report`·`prod_coa`)은 100 유지.

### trd_user_info (← users)
- `id` → `uid` (uuid PK).
- 삭제: `user_tel`, `role`, `status`, `must_change_password`, `deleted_at`.
- 유니크: `user_id`, `user_email`(소문자), `user_phone`, `bus_reg_id`(기업), 닉네임(개인·사용 Y) — `deleted_at` 조건이 사라져 전체 기준.

## 마이그레이션

새 파일 하나 (`V2026101315xx__align_legacy_schema.sql`): 테이블·컬럼 rename, 컬럼 drop/add, 타입 변경, `trd_ctgr_code` 생성 + `CATG_CD_DATA` insert, 외래키. 볼륨을 초기화하므로 이전 마이그레이션은 손대지 않는다(이미 적용된 파일 수정 금지 규칙).

## 코드 영향

- 엔티티 `@Table`·`@Column` 매핑: `User`, `Product`, `Listing` (+ `ListingId` 의 `user_id`). API 필드명(`prodNo`·`deliveryDate`·`certificateOfAuthen` 등)은 바꾸지 않는다.
- 직접 SQL: `ListingSearchRepository`, `UserRepository`(`deletedAt` 조건 제거), 테스트의 jdbc 문.
- 역할 제거: `UserRole`·`AuthenticatedUser.role`·JWT `role` 클레임·`MeResponse.role`·`AdminSeeder`(관리자 자동 생성) 삭제. 지금 역할로 막는 API 는 없다(`hasRole` 사용처 없음).
- 상태 제거: `UserStatus`, 로그인·OAuth 의 정지 계정 차단(`ACCOUNT_SUSPENDED`), 탈퇴(`deleted_at`) 판단 삭제. `MeResponse.mustChangePassword` 삭제 (프론트 사용처 없음).
- 임시 등록 폼: 카테고리 코드 최대 12자(zod·Bean Validation·security.md), 없는 코드면 400 `fields.categoryCode` (외래키 위반을 DB 오류로 두지 않는다).
- 문서: data-model.md, decisions.md, security.md, CLAUDE.md "권한은 역할 기반" 문구(사용자 결정으로 역할 컬럼 없음 — 재도입 조건 기록).

## 테스트

- 기존 백엔드 테스트 전체를 새 이름으로 통과 (`./gradlew check`).
- 추가: 없는 카테고리 코드 등록 → 400 `fields.categoryCode`, 시드 카테고리 코드로 등록 성공, 카테고리 12자 경계.
- 삭제: 역할·정지·탈퇴·관리자 시드 관련 테스트.
- 프론트: `pnpm typecheck && pnpm lint && pnpm test` (카테고리 12자 검증 테스트).

## 진행

1. `db/legacy-schema` 브랜치. 이 작업은 스키마와 그에 묶인 매핑·검증만 (화면 변경 없음).
2. Docker 볼륨 초기화는 마이그레이션이 준비된 뒤 사용자 확인을 한 번 더 받고 실행.
3. 인증·권한 변경이라 `/code-review` 와 `/security-review` 둘 다.

## 범위 밖

- 상품마스터·카테고리마스터 화면, 카테고리 조회 API, 등록 폼의 상품마스터 선택.
- 정의서가 없는 테이블.
- 관리자 기능(역할 재도입은 관리자 화면이 필요해질 때 정의서와 함께 다시 정한다).
