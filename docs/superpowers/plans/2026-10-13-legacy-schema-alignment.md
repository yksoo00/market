# 레거시 정의서 스키마 맞추기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상품마스터·판매물품·유저 테이블을 정의서 물리명·컬럼으로 바꾸고, 카테고리 테이블(시드+외래키)을 만든다.

**Architecture:** Flyway 마이그레이션 3개(이름 변경 → 유저 컬럼 삭제 → 카테고리)와 그에 묶인 엔티티 매핑·검증 변경. API 필드명은 그대로 두고 `@Table`·`@Column`만 바꾼다. 개발 DB 볼륨을 초기화한 뒤 처음부터 적용한다.

**Tech Stack:** Spring Boot 4.1 / JPA / Flyway / Postgres 16, Next.js(zod), JUnit + Testcontainers, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-legacy-schema-alignment-design.md`

## Global Constraints

- 브랜치 `db/legacy-schema` (main 에서). 테이블명은 정의서 그대로 — `trd_prod_master`, `trd_prod_reg`, `trd_user_info`, `trd_ctgr_code`. 그 외 테이블은 손대지 않는다.
- 이미 적용된 마이그레이션 파일은 수정하지 않는다. 새 파일만: `V202610131500__rename_legacy_tables.sql`, `V202610131510__drop_user_columns.sql`, `V202610131520__create_ctgr_code.sql` (스펙의 "파일 하나"를 태스크별 커밋을 위해 셋으로 나눔 — 같은 배포에 함께 나간다).
- 카테고리 코드 varchar(12) (`P01-Q01-R001`), 부모 코드는 조각·null 허용. 경로 칸은 100 유지.
- API·요청 필드명(`prodNo`, `deliveryDate`, `certificateOfAuthen`, `id` 등) 변경 금지.
- 검증은 두 층: 카테고리 12자 — zod `requiredText(12, …)`, Bean `@Size(max = 12)`, security.md "카테고리코드 | 12자 이하".
- 커밋 메시지·주석 한국어. 커밋 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 커밋 전 해당 범위 검사: 백엔드 `./gradlew check`, 프론트 `pnpm typecheck && pnpm lint && pnpm test`.

## Review Focus

- 테스트·bruno·e2e 가 쓰는 카테고리 코드 `ELEC0001`·`서버` → 시드에 있는 `P01-Q01-R001` 로 바꾸지 않으면 외래키 위반으로 등록이 500. → Task 3 에서 전부 교체, 없는 코드 400 테스트.
- 탈퇴(`deleted_at`) 조건이 사라지면 유니크 인덱스가 전체 기준 — 같은 아이디 재가입 불가. → Task 2 테스트 "같은 아이디 두 번 가입은 409".
- JWT 에서 `role` 클레임이 빠지면 이미 발급된 옛 토큰 파싱이 실패하면 안 된다(클레임 무시). → Task 2 테스트 "role 클레임이 있는 옛 토큰도 인증된다".
- 카테고리 수정(PATCH `categoryCode`)도 없는 코드면 400 이어야 한다(등록만 막으면 수정으로 우회). → Task 3 테스트.
- 가입 요청에서 `tel`/`contactTel` 을 지운 뒤에도 옛 클라이언트가 보내면 무시되고 가입은 성공. → Task 2 테스트.

---

### Task 1: 테이블·컬럼 이름 변경

**Files:**
- Create: `backend/src/main/resources/db/migration/V202610131500__rename_legacy_tables.sql`
- Modify: `listing/domain/Product.java`(`@Table`, `prodNo` → `@Column(name = "prod_mpn")`), `listing/domain/Listing.java`(`@Table`, `deliveryDate` → `prov_date`, `certificateOfAuthen` → `prod_coa`), `user/domain/User.java`(`@Table`, `id` → `@Column(name = "uid")`)
- Modify (테스트의 직접 SQL): `ListingApiTest`, `ListingMineApiTest`, `ListingSearchApiTest`, `ListingRepositoryTest`, `ProductRepositoryTest`, `SchemaConstraintsTest`, `AuthApiTest`, `OAuthApiTest`, `UploadApiTest`, `FileApiTest` 등 `grep -rln "users\|listings\|products\|prod_no\|delivery_date\|certificate_of_authen" backend/src/test`
- Modify: `docs/data-model.md`(매물·유저 절의 표 이름·컬럼)

- [ ] **Step 1:** `SchemaConstraintsTest` 에 테스트 추가 — `@DisplayName("정의서 물리명: trd_prod_master·trd_prod_reg·trd_user_info, prod_mpn·prod_scan_code·prov_date·prod_coa·uid 컬럼이 있다")`: `information_schema.columns` 조회로 각 (table, column) 존재 단언, 옛 이름(`products`, `listings`, `users`)은 `information_schema.tables` 에 없음 단언.
- [ ] **Step 2:** `./gradlew test --tests '*SchemaConstraintsTest'` → FAIL (테이블 없음).
- [ ] **Step 3:** 마이그레이션 작성: `alter table products rename to trd_prod_master; alter table listings rename to trd_prod_reg; alter table users rename to trd_user_info;` 컬럼 rename `prod_no→prod_mpn`, `delivery_date→prov_date`, `certificate_of_authen→prod_coa`, `id→uid`; `alter table trd_prod_master add column prod_scan_code varchar(20);` 인덱스·제약 이름(`ux_products_*`, `ix_listings_*`, `ux_users_*`)도 새 테이블명 접두로 rename. 엔티티 매핑 변경, 테스트 SQL 의 테이블·컬럼명 교체.
- [ ] **Step 4:** `./gradlew check` → PASS.
- [ ] **Step 5:** 커밋 `db: 상품마스터·판매물품·유저 테이블을 정의서 물리명으로` (본문: 9/29 결정 뒤집음, 볼륨 초기화 전제라 배포 1회).

### Task 2: 유저의 정의서 밖 컬럼 삭제 (역할·상태·탈퇴·비번 강제 변경·user_tel)

**Files:**
- Create: `V202610131510__drop_user_columns.sql` — `drop column user_tel, role, status, must_change_password, deleted_at`; 체크 `ck_users_withdrawn_deleted` 삭제; 부분 유니크 인덱스를 `deleted_at` 조건 없이 다시 생성(`user_id`, `lower(user_email)`, `user_phone`, 기업 `bus_reg_id`, 개인·사용 Y 닉네임); `ix_users_class_status` → `user_class` 단일 인덱스.
- Delete: `user/domain/UserRole.java`, `user/domain/UserStatus.java`, `user/service/AdminSeeder.java` (+ 관련 설정 `ADMIN_LOGIN_ID`/`ADMIN_PASSWORD` 를 `.env.example`·`application.yml` 에서 제거)
- Modify: `User.java`(필드·빌더에서 role·status·userTel·mustChangePassword·deletedAt 제거), `common/auth/AuthenticatedUser.java` → `record AuthenticatedUser(UUID id)`, `JwtProvider.createAccessToken(UUID userId)` (role 클레임 안 넣음, 파싱 시 무시), `MeResponse(UUID id, UserKind kind, String nickname)`, `UserRepository`(`deletedAt` 조건·`existsByRole…` 제거), `AuthService`·`OAuthLoginService`(정지 계정 차단 제거), `ErrorCode.ACCOUNT_SUSPENDED` 제거, `SignupService`(`userTel` 제거), 가입 요청 DTO 에서 `tel`·`contactTel` 제거
- Modify (프론트): `lib/validation/signup.ts`·`business.ts` 의 `tel`/`contactTel`, 가입 폼 컴포넌트의 해당 칸, `messages/` 해당 문구, `messages/auth.ts` 의 `ACCOUNT_SUSPENDED`, `types/` 의 `MeResponse.role`·`mustChangePassword`
- Test: `AuthApiTest`(`$AdminSeed` 등 역할·정지 테스트 삭제), `OAuthApiTest`, `SignupApiTest`, `SchemaConstraintsTest`, 프론트 `business.test.ts` 등

- [ ] **Step 1:** 실패 테스트 — `SchemaConstraintsTest` "trd_user_info 에 role·status·deleted_at·must_change_password·user_tel 이 없다"; `AuthApiTest` "role 클레임이 있는 옛 토큰도 인증된다"(옛 형식 토큰을 테스트에서 직접 만들어 `/api/v1/auth/me` 200); `SignupApiTest` "같은 아이디 두 번 가입은 409", "tel·contactTel 을 보내도 무시하고 가입 성공".
- [ ] **Step 2:** `./gradlew test` → 새 테스트 FAIL.
- [ ] **Step 3:** 마이그레이션·코드 변경, 역할·정지·관리자 시드 테스트 삭제.
- [ ] **Step 4:** `./gradlew check` PASS, 프론트 `pnpm typecheck && pnpm lint && pnpm test` PASS.
- [ ] **Step 5:** 문서 — `decisions.md` 에 "2026-10-13 유저는 정의서 컬럼만: 역할·상태·탈퇴 없음"(이유: 사용자 결정, 대안: 역할 유지, 재검토: 관리자 기능이 필요해질 때 정의서와 함께), 색인 "계정" 행 갱신; `CLAUDE.md` 데이터 규칙 "권한은 역할 기반…" 을 "권한(역할)은 지금 없음 — 관리자 기능이 필요해지면 정의서와 함께 다시 정한다 (decisions.md 2026-10-13)" 로; `security.md` 인증·정지 관련 문구.
- [ ] **Step 6:** 커밋 `db: 유저 테이블에서 정의서에 없는 컬럼 삭제 (역할·상태·탈퇴·user_tel)`.

### Task 3: 카테고리 테이블·시드·외래키, 카테고리 12자·존재 검사

**Files:**
- Create: `V202610131520__create_ctgr_code.sql` — `create table trd_ctgr_code(...)`(스펙 표 그대로), 엑셀 `CATG_CD_DATA` 전 행 `insert`, `alter table trd_prod_master alter column category_code type varchar(12)`, `trd_prod_reg` 에 category_code 컬럼이 없음을 확인(있으면 정의서에 없으므로 drop), 외래키 `fk_trd_prod_master_category` → `trd_ctgr_code(category_code)`.
- Create: `listing/domain/Category.java`(읽기용 엔티티, PK `categoryCode`), `listing/repository/CategoryRepository extends JpaRepository<Category, String>`
- Modify: `ListingCreateRequest`·`ListingUpdateRequest` `categoryCode` `@Size(max = 12)`; `ListingService` 등록·수정에서 상품 찾기 전에 `if (!categories.existsById(code)) throw new ValidationException(Map.of("categoryCode", "없는 카테고리 코드입니다."))`
- Modify (프론트): `lib/validation/listing.ts` `requiredText(12, …)`, `messages/listing.ts` 카테고리 길이 문구, 등록 폼 카테고리 칸 `maxLength={12}`·placeholder 예 `P01-Q01-R001`, `rowEdit.ts` 에 카테고리 검사가 있으면 12
- Modify: 테스트·bruno·e2e 의 카테고리 값 `ELEC0001`·`서버` → `P01-Q01-R001`; `docs/security.md` 카테고리 10→12·존재 검사; `docs/decisions.md` 미정 "카테고리 코드 체계" → 결정(전체 경로 12자 PK)으로 옮김; `docs/data-model.md` 카테고리 절

**시드 SQL 만들기 (일회성, 저장소 밖 스크립트):** 엑셀은 원본을 건드리지 않고 `%TEMP%` 복사본을 읽는다(`System.IO.Compression` 로 `xl/worksheets/sheet2.xml` + `sharedStrings.xml`). 헤더 2줄(논리명·물리명) 다음부터 열 순서 `CATEGORY_CODE, CATEGORY_NAME, CATEGORY_DEPTH, CATEGORY_CLASS, PARENT_CODE, IS_DISPLAY, SORT_ORDER, REG_DATE`. 빈 `PARENT_CODE`·`SORT_ORDER` 는 `null`, 문자열의 `'` 는 `''`. 생성 후 행 수를 시트 행 수와 대조하고 코드 길이가 12 이하인지 확인.

- [ ] **Step 1:** 실패 테스트 — `ListingApiTest`: "없는 카테고리 코드로 등록하면 400 fields.categoryCode", "없는 카테고리 코드로 수정해도 400 fields.categoryCode", "카테고리 13자는 400"; `SchemaConstraintsTest`: "trd_ctgr_code 에 시드가 있고 P01-Q01-R001 의 부모는 Q01", "trd_prod_master.category_code 외래키 위반은 거부"; 프론트 `listing.test.ts` 카테고리 12자 통과·13자 오류.
- [ ] **Step 2:** 테스트 실행 → FAIL.
- [ ] **Step 3:** 시드 생성·마이그레이션·엔티티·검사·프론트 검증·테스트 데이터 교체.
- [ ] **Step 4:** `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test` PASS.
- [ ] **Step 5:** 커밋 `db: 카테고리 코드 테이블(엑셀 시드)과 상품마스터 외래키, 카테고리 12자`.

### Task 4: 개발 DB 초기화·확인·PR

- [ ] **Step 1:** 사용자에게 볼륨 삭제를 한 번 더 확인받는다(postgres·redis 데이터 전부, 되돌릴 수 없음). 승인 후 `docker compose down -v` → `docker compose up -d` → `docker compose up -d --build api-dev`.
- [ ] **Step 2:** api-dev 로그에서 Flyway 가 3개 새 마이그레이션까지 성공했는지 확인. 가입 → 로그인 → `P01-Q01-R001` 로 매물 등록 → 상세가 bruno 또는 화면에서 된다.
- [ ] **Step 3:** 푸시·PR (본문: 무엇·왜·확인 방법, 볼륨 초기화 필요, 같이 배포). `/code-review` 실행·반영. 인증·권한·스키마 변경이라 `/security-review` 실행·반영.
- [ ] **Step 4:** 결과 보고 (CI 통과 확인 후).
