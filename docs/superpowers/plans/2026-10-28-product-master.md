# PR 2 상품마스터·카테고리 마스터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `trd_prod_master` 를 정의서대로 바꾸고 `trd_ctgr_master` 를 새로 만들며, 등록 폼에 새 상품 칸 4개를 받고, 직접 입력 재사용을 이름·제조사·분류번호·제조일 네 값으로 바꾼다.

**Architecture:** Flyway 마이그레이션 2개(카테고리 마스터 생성·시드, 상품마스터 컬럼 변경·조각 백필). 상품마스터는 카테고리를 대·중·소 조각 세 칸으로 갖고, 화면·API 의 `categoryCode`(경로 `P01-Q01-R001`)는 세 조각을 `-` 로 이어 만든다 — API 모양은 그대로. 카테고리 확인·이름 경로는 `trd_ctgr_master` 의 부모 관계로, 패널 목록(`GET /categories`)은 지금처럼 `trd_ctgr_code`.

**Tech Stack:** Spring Boot 4.1, JPA, Flyway, PostgreSQL 16, Testcontainers / Next.js 16, zod, react-hook-form, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-27-definition-realign-design.md` "PR 2" 절. 정의서 `KPIT-BRK-테이블정의서.xlsx` CTGR_MASTER·PROD_MASTER 시트(10/27 14:08 판, 10/28 다시 확인 — 바뀐 것 없음).

## Global Constraints

- 브랜치 `db/product-master`, worktree `C:\market-master`. 마이그레이션과 코드가 같은 브랜치(설계서 "PR 나누기").
- 테이블은 정의서 + 설계서 "정의서와 다른 점"대로. 정의서 밖 제약·인덱스를 더하지 않는다 — 이 PR 은 인덱스 추가 없음.
- `trd_ctgr_code` 는 바꾸지 않는다. `GET /categories` 는 계속 `trd_ctgr_code`.
- 자바 필드·JSON 이름은 유지하고 컬럼 매핑만 바꾼다 (PR 1 `certificateOfAuthen` 과 같은 방식): `prodNo` ↔ `prod_part_no`, `prodPhoto1` ↔ `prod_image`. API 의 `categoryCode` 도 그대로(경로 코드).
- 새 칸 이름(자바·JSON): `prodClassNo`, `prodUsefulLife`, `warrantyMethod`, `alterProdName`.
- 입력 수치(프론트 zod·백엔드 Bean Validation 같은 값, `docs/security.md` 가 원본): 제조사 1~40자(직접 입력 필수), 물품분류번호 ≤20, 보증년수는 **개월 수**를 목록에서 고름: 3·6·9·…·60 (3개월 단위, 20개), 안 고르면 null (사용자 2026-10-28 "3 6 9 12 ~", 개월 단위 — 설계서 가정 3 대체. 끝값 60 은 내 가정), 정품보증방법 ≤20, 대체상품명 ≤40.
- 오류 문구는 `frontend/src/messages/listing.ts` 에. 카테고리 오류는 기존 문구 `"없는 카테고리 코드입니다."` 그대로.
- UTF-8, 한글 파일은 국소 수정. 공개 저장소 — 실제 주소 쓰지 않는다.

## Review Focus

1. 마스터를 고른 등록: 요청에 새 칸 4개를 같이 보내도 무시하고 마스터 값을 쓴다 (클라이언트 값 불신) — Task 3 테스트 `pickedMasterIgnoresRequestProductFields`.
2. 분류번호를 안 보낸 것(null)과 `""` 는 같은 "없음" — 둘 다 같은 마스터를 재사용 — Task 3 `blankClassNoReusesNullClassNo`.
3. 제조사 41자: 프론트·백엔드 둘 다 막는다. 옛 행 41자 이상이면 마이그레이션이 실패하므로 Task 1 이 먼저 확인 — Task 3 `brandOver40Rejected`, Task 4 vitest.
4. 대분류만(`P01`)으로 검색 필터 → 그 아래 전부. 부모가 안 맞는 경로(`P01-Q02-R001`)로 등록 → 400 categoryCode — Task 2 테스트.
5. 수정에서 공유 마스터의 제조일을 바꾸면 이제 422 가 아니라 네 값이 맞는 마스터로 이 매물만 옮긴다(남의 매물은 그대로) — Task 3 `mufcDateEditMovesOnlyThisListing`.

## 판정 (설계서가 직접 말하지 않아 이 계획이 정한 것)

- 수정 화면(ListingEditForm·RowEditor)에는 새 칸 4개를 넣지 않는다 — 설계서는 "등록 폼"만. 수정에서 이름·제조사·제조일이 바뀌어 마스터를 다시 찾을 때 분류번호·새 칸은 지금 마스터 값을 이어받는다.
- 재사용 키가 네 값이 됐으니, 수정에서 네 값(이름·제조사·제조일, 분류번호는 수정 화면에 없음) 중 하나가 바뀌면 지금 이름·제조사 변경과 같은 흐름(`findOrCreate` 로 이 매물만 옮김). 나머지 상품 칸(번호·사양·카테고리) 변경은 지금처럼 이 매물만 쓰는 마스터일 때만 고치고 공유면 422.
- 매물 상세 화면 정보 표에 새 칸 4줄을 보인다(값 없으면 `-`). 설계서는 "상세 응답에 새 칸"까지만 적었다.
- 상품 생성 잠금 키는 하나(`hashtext('prod-master')`) — 같은 네 값 중복과 채번(`KP-연도-일련번호`, 개수 기반) 충돌을 한 번에 막는다. 상품 생성은 드물어 줄 세워도 비용이 작다. 기존 `DataIntegrityViolationException` 재조회는 지운다.

---

### Task 1: 마이그레이션·엔티티·시드

**Files:**
- Create: `backend/src/main/resources/db/migration/V202610281000__create_ctgr_master.sql`
- Create: `backend/src/main/resources/db/migration/V202610281010__prod_master_definition.sql`
- Create: `backend/src/main/java/com/company/market/listing/domain/CategoryMaster.java`
- Create: `backend/src/main/java/com/company/market/listing/repository/CategoryMasterRepository.java`
- Modify: `backend/src/main/java/com/company/market/listing/domain/Product.java`
- Modify: `backend/src/main/java/com/company/market/listing/service/ProductService.java` (빌더 호출만 — 조각 저장)
- Modify: `backend/src/main/resources/db/seed/R__seed_dev_prod_master.sql`
- Modify: 테스트 픽스처 전부 (`grep -rln "categoryCode(\"\|category_code" backend/src/test`)
- Test: `backend/src/test/java/com/company/market/ProductMasterMigrationTest.java` (새), `SchemaConstraintsTest.java`

**Interfaces:**
- Produces: `Product` 필드 `majorCategory`, `middleCategory`, `minorCategory`, `prodClassNo`, `prodUsefulLife`(Integer), `warrantyMethod`, `alterProdName`; 빌더도 같은 이름(`categoryCode` 빌더 인자는 없어짐). `Product.getCategoryCode()` = null 아닌 조각을 `-` 로 이은 경로(전부 null 이면 null) — 필드 없는 계산 getter.
- Produces: `CategoryMaster`(`trd_ctgr_master`, `@Id categoryCode`, `categoryName`, `categoryDepth`, `parentCode`, `isDisplay` CHAR 매핑 — `Category` 와 같은 방식), `CategoryMasterRepository extends JpaRepository<CategoryMaster, String>`.

- [ ] **Step 0: 로컬 개발 DB 사전 확인 (읽기 전용)**

`docker compose up -d postgres` 후:
```sql
select count(*) filter (where length(prod_brand) > 40) as long_brand,
       count(*) filter (where category_code !~ '^[^-]+-[^-]+-[^-]+$') as not_minor
from trd_prod_master;
```
Expected: `long_brand = 0`. 0 이 아니면 멈추고 사용자에게 그 행을 보여 준다(설계서). `not_minor` 는 기록만(조각이 모자란 칸은 null 로 옮겨진다).

- [ ] **Step 1: 마이그레이션 테스트 작성** — `DefinitionKeysMigrationTest` 와 같은 틀(별도 스키마 `prodtest`, target `202610271040` 까지 올리고 데이터 넣은 뒤 나머지 적용, `@AfterAll` drop schema).
  넣는 데이터: `trd_prod_master (prod_id 'MIGPM001', category_code 'P01-Q01-R001', prod_name '상품', prod_mpn 'MPN-1', prod_brand '브랜드', prod_photo_1 'listing/photo/a.jpg', prod_scan_code 'SC1', reg_date '20261015100000')`.
  테스트:
  - `categoryCodeSplitIntoFragments`: major/middle/minor = `P01`/`Q01`/`R001`.
  - `renamedColumnsKeepValues`: `prod_part_no = 'MPN-1'`, `prod_image = 'listing/photo/a.jpg'`.
  - `ctgrMasterSeededFromCtgrCode`: `trd_ctgr_master` 239행; `R001` → name `인텔 CPU`, depth `소`, parent `Q01`; `Q01` → depth `중`, parent `P01`; `P01` → depth `대`, parent null; 전부 `is_display`·`reg_date` 가 `trd_ctgr_code` 값과 같다.
- [ ] **Step 2: SchemaConstraintsTest 에 추가** — `trd_ctgr_master` PK = `(category_code)`, `category_code` varchar(12), `parent_code` nullable, 나머지 NOT NULL 은 정의서(name·depth·is_display·reg_date). `trd_prod_master`: unique 인덱스 없음, `category_code`·`prod_scan_code`·`prod_mpn`·`prod_photo_1` 없음, `prod_brand` varchar(40) nullable, `prod_name`·`reg_date` nullable, `prod_image` varchar(100), `prod_data_sheet` varchar(100).
- [ ] **Step 3: 실행 — 실패 확인**
  Run: `./gradlew test --tests "*ProductMasterMigrationTest" --tests "*SchemaConstraintsTest"` → Expected: FAIL (컬럼·테이블 없음).
- [ ] **Step 4: 마이그레이션 작성**
  - `V202610281000`: `create table trd_ctgr_master (category_code varchar(12) not null, category_name varchar(50) not null, category_depth varchar(2) not null, parent_code varchar(20), is_display char(1) not null default 'Y', sort_order integer, reg_date varchar(14) not null, spare_col varchar(10), constraint trd_ctgr_master_pkey primary key (category_code))`. 채우기: `insert ... select substring(category_code from '[^-]+$'), category_name, category_class, parent_code, is_display, sort_order, reg_date, spare_col from trd_ctgr_code`. 주석에 정의서와 다른 점 2개(길이 12, parent nullable)와 이유.
  - `V202610281010`: rename `prod_mpn → prod_part_no`, `prod_photo_1 → prod_image`; add `major_category`·`middle_category`·`minor_category` varchar(40), `prod_class_no` varchar(20), `prod_useful_life` integer, `warranty_method` varchar(20), `alter_prod_name` varchar(40); 백필 `split_part(category_code, '-', n)` 를 `nullif(..., '')`; `drop index ux_trd_prod_master_name_brand`; drop `category_code`, `prod_scan_code`; `prod_brand` type varchar(40) + drop not null; `prod_name`, `reg_date` drop not null. 주석에 정의서와 다른 점(prod_image·data_sheet 100, prod_mufc_date 유지)과 되돌리기.
- [ ] **Step 5: 엔티티·시드·픽스처**
  - `Product`: 위 Interfaces 대로. `@Column(name = "prod_part_no") prodNo`, `@Column(name = "prod_image") prodPhoto1`, `nullable = false` 는 `prodId` 외 전부 뺀다. `applyEdit(String categoryCode, …)` 는 경로를 받아 조각 셋으로 나눠 넣는다(Task 2 가 검증한 값만 들어옴).
  - `ProductService.create`: `draft.categoryCode()` 를 조각으로 나눠 빌더에 (Task 2 에서 리졸버로 바뀜).
  - 시드: 컬럼 목록을 `(prod_id, major_category, middle_category, minor_category, prod_name, prod_part_no, prod_brand, prod_mufc_date, prod_spec_info, prod_data_sheet, prod_image, reg_date)` 로, 값의 경로 코드를 세 값으로 나누고 스캔코드 값을 뺀다(perl 한 줄 치환, 50행). `on conflict do nothing` 유지, 머리 주석의 "(상품명, 제조사) 건너뜀"·스캔코드 문장 고침.
  - 테스트 픽스처: `.categoryCode("A-B-C")` → `.majorCategory("A").middleCategory("B").minorCategory("C")`; SQL `insert into trd_prod_master (... category_code ...)` 도 세 칸으로. `migtest`·`prodtest` 스키마의 옛 버전 insert 는 그대로.
- [ ] **Step 6: 실행 — 통과**
  Run: `./gradlew test --tests "*ProductMasterMigrationTest" --tests "*SchemaConstraintsTest" --tests "*DevSeedTest" --tests "*DefinitionKeysMigrationTest" --tests "*Product*"` → Expected: PASS.
- [ ] **Step 7: 커밋** — `db: 상품마스터 정의서 컬럼·카테고리 마스터`

### Task 2: 카테고리 확인·이름 경로·검색 필터

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/service/CategoryService.java`
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` (`requireCategory`, `categoryPath`)
- Modify: `backend/src/main/java/com/company/market/listing/service/ProductService.java` (`search` 의 카테고리 이름)
- Modify: `backend/src/main/java/com/company/market/listing/repository/ListingSearchRepository.java:126-131`
- Test: `ListingApiTest`, `ListingSearchApiTest`, `ProductCategoryApiTest`

**Interfaces:**
- Consumes: Task 1 `CategoryMasterRepository`, `Product` 조각 필드.
- Produces: `record CategoryFragments(String major, String middle, String minor)` (`listing/domain`), `String code()` = `major-middle-minor`.
  `CategoryService.resolveMinor(String pathCode): CategoryFragments` — 세 조각이 아니거나, `trd_ctgr_master` 에 소(`depth '소'`, parent=중)·중(`'중'`, parent=대)·대(`'대'`, parent null)가 맞지 않으면 `ValidationException(Map.of("categoryCode", "없는 카테고리 코드입니다."))`. 세 코드는 `findAllById` 한 번.
  `CategoryService.namePath(Product p): String` — 조각 이름을 `" > "` 로, 없는 조각은 건너뜀, 다 없으면 null.
  `CategoryService.minorNames(Collection<String> minors): Map<String, String>`.

- [ ] **Step 1: 실패 테스트**
  - ListingApiTest `createStoresCategoryFragments`: 직접 입력 등록 `categoryCode "P01-Q01-R001"` → DB `major/middle/minor = P01/Q01/R001`, 상세 응답 `categoryCode "P01-Q01-R001"`, `categoryPath "PC주요부품 > CPU/프로세서 > 인텔 CPU"`.
  - ListingApiTest `createRejectsMismatchedCategoryPath`: `"P01-Q02-R001"` → 400, `fields.categoryCode = "없는 카테고리 코드입니다."`. `"P01"`(대분류만) → 같은 400.
  - ListingSearchApiTest `categoryFilterByFragments`: `category=P01` → P01 아래 매물 전부, `category=P01-Q01` → Q01 만, `category=P01-Q01-R001` → R001 만, 다른 대분류 매물은 안 나옴.
  - ProductCategoryApiTest: `GET /products` 항목의 `categoryCode` 가 경로, `categoryName` 이 소분류 이름.
- [ ] **Step 2: 실행 — 실패 확인** (`--tests "*ListingApiTest" --tests "*ListingSearchApiTest" --tests "*ProductCategoryApiTest"`). Expected: 새 테스트 FAIL.
- [ ] **Step 3: 구현**
  - `ListingService.requireCategory` → `categories.resolveMinor(...)` 결과를 `ProductDraft`·`applyEdit` 로 넘긴다. `categoryPath(String)` 는 `CategoryService.namePath(product)` 로 바꾸고 `CategoryRepository` 의존이 안 쓰이면 뺀다.
  - 검색 필터: `category` 를 `-` 로 나눠 `p.majorCategory = :c1` [`and p.middleCategory = :c2` [`and p.minorCategory = :c3`]]. 4조각 이상은 결과 없음이 되도록 그대로 비교(빈 결과).
- [ ] **Step 4: 실행 — 통과.** 같은 명령 + `--tests "*Listing*"`. Expected: PASS.
- [ ] **Step 5: 커밋** — `feat(backend): 카테고리 조각을 카테고리 마스터로 확인·표시·검색`

### Task 3: 새 칸·재사용 규칙·잠금 (백엔드)

**Files:**
- Modify: `listing/dto/ListingCreateRequest.java`, `listing/dto/ListingUpdateRequest.java` (제조사 40), `listing/dto/ProductSearchItemResponse.java`, `ListingResponse`(상세)
- Modify: `listing/service/ProductService.java`, `listing/repository/ProductRepository.java`, `listing/service/ListingService.java`
- Test: `ProductServiceTest`, `ProductRepositoryTest`, `ListingApiTest`

**Interfaces:**
- Consumes: Task 2 `CategoryFragments`.
- Produces: `ProductDraft(CategoryFragments category, String prodName, String prodNo, String prodBrand, String prodClassNo, String prodMufcDate, String prodSpecInfo, Integer prodUsefulLife, String warrantyMethod, String alterProdName, String prodDataSheet, String firstPhoto)`.
  `ProductRepository.lockCreation(): Integer` — native `select 1 from (select pg_advisory_xact_lock(hashtext('prod-master'))) l` (`ListingRepository.lockRegistration` 과 같은 모양).
  `ProductRepository.findSame(String name, String brand, String classNo, String mufcDate): Optional<Product>` — `coalesce(p.prodClassNo, '') = :classNo and coalesce(p.prodMufcDate, '') = :mufcDate` (서비스가 null·공백을 `""` 로 넘김; null 바인딩 타입 문제 회피). `findByProdNameAndProdBrand` 는 지운다.
  요청·응답 JSON 새 칸: `prodClassNo`, `prodUsefulLife`, `warrantyMethod`, `alterProdName` (`ProductSearchItemResponse`, 상세 `ListingResponse`).

- [ ] **Step 1: 실패 테스트**
  - ProductServiceTest:
    - `sameFourValuesReuse`: 이름·제조사·분류번호·제조일이 같고 사양이 달라도 같은 `prodId`.
    - `differentClassNoCreatesNew`, `differentMufcDateCreatesNew`: 하나만 달라도 새 `prodId`.
    - `blankClassNoReusesNullClassNo`: 분류번호 null 로 만든 뒤 `""` 로 찾으면 같은 `prodId`.
    - `parallelSameDraftMakesOneMaster`: 같은 draft 를 두 스레드가 `CountDownLatch` 로 동시에 10회 → 매 회 두 결과 `prodId` 같고 행 1개.
    - `newFieldsSaved`: 새 마스터에 분류번호·보증년수·정품보증방법·대체상품명 저장.
  - ListingApiTest:
    - `brandOver40Rejected`: 제조사 41자 → 400 `fields.prodBrand`. 40자 → 201.
    - `usefulLifeFromList`: 4·0·63 → 400 `fields.prodUsefulLife` (`"보증년수는 목록에서 고른 값이어야 합니다."`), 3·60·null → 201.
    - `pickedMasterIgnoresRequestProductFields`: `prodId` 와 함께 `prodClassNo "X"` 등을 보내도 상세 응답은 마스터 값.
    - `detailHasNewProductFields`: 상세 응답에 새 칸 4개.
    - `mufcDateEditMovesOnlyThisListing`: 두 판매자가 같은 마스터를 쓸 때 한쪽이 제조일을 바꾸면 그 매물만 다른 `prodId`, 다른 매물·옛 마스터 값은 그대로 (지금의 422 테스트가 있으면 이걸로 바꾼다).
- [ ] **Step 2: 실행 — 실패 확인** (`--tests "*ProductServiceTest" --tests "*ProductRepositoryTest" --tests "*ListingApiTest"`).
- [ ] **Step 3: 구현**
  - `ListingCreateRequest`: `@Size(max = 40) prodBrand`, `@Size(max = 20) prodClassNo`, `Integer prodUsefulLife` (목록 검사는 서비스 — `ListingService.USEFUL_LIFE_MONTHS` = 3..60 3 단위, `WARRANTY_DAYS` 와 같은 방식), `@Size(max = 20) warrantyMethod`, `@Size(max = 40) alterProdName`. `ListingUpdateRequest` 제조사 `@Size(max = 40)`.
  - `ProductService.findOrCreate`: `lockCreation()` → `findSame` → 없으면 `create`. 빈 문자열 칸은 null 로 저장. try/catch 재조회 삭제, 클래스 주석의 재사용 규칙을 네 값으로.
  - `ListingService.applyProductFields`: 이름·제조사·제조일 중 하나라도 바뀌면 `findOrCreate`(분류번호·새 칸은 지금 마스터 값 이어받음); 번호·사양·카테고리만 바뀌면 기존 공유 검사 흐름. `putIfChanged` 목록에서 `prodMufcDate` 를 뺀다.
- [ ] **Step 4: 실행 — 통과.** `./gradlew test --tests "*Listing*" --tests "*Product*" --tests "*Cart*" --tests "*Quote*" --tests "*Trade*"` → PASS.
- [ ] **Step 5: 커밋** — `feat(backend): 상품마스터 새 칸·네 값 재사용·생성 잠금`

### Task 4: 프론트 등록 폼·상세

**Files:**
- Modify: `frontend/src/lib/validation/listing.ts`, `frontend/src/lib/rowEdit.ts:79` (제조사 40), `frontend/src/lib/listingForm.ts`, `frontend/src/types/listing.ts`, `frontend/src/components/listing/ProductPicker.tsx`, `frontend/src/components/listing/ListingForm.tsx`, `frontend/src/lib/listingDetail.ts`, `frontend/src/messages/listing.ts`
- Test: 같은 이름의 `*.test.ts`

**Interfaces:**
- Consumes: Task 3 JSON 칸 이름.
- Produces: 폼 칸 `prodClassNo`, `prodUsefulLife`, `warrantyMethod`, `alterProdName` (상품 칸 — `ProductPicker.productFields` 에 넣어 마스터 고르면 채우고 잠그고, 직접 입력이면 비워 연다).

- [ ] **Step 1: 실패 테스트**
  - `validation/listing.test.ts`: 제조사 41자 → `v.prodBrand` 오류; 보증년수 `"4"`·`"0"`·`"63"` → `v.prodUsefulLife`, `""`·`"3"`·`"60"` 통과; 분류번호 21자·정품보증방법 21자·대체상품명 41자 → 각 오류.
  - `rowEdit.test.ts`: 제조사 41자 오류.
  - `listingForm.test.ts`: 직접 입력이면 새 칸 4개를 요청에 담고(보증년수는 숫자, 빈 칸은 빼기), 마스터를 골랐으면 안 담는다.
  - `listingDetail.test.ts`: `infoRows` 에 `classNo`·`usefulLife`(`"N개월"`)·`warrantyMethod`·`alterProdName` 줄, 값 없으면 `t.empty`.
- [ ] **Step 2: 실행 — 실패 확인** `pnpm exec vitest run src/lib` → 새 테스트 FAIL.
- [ ] **Step 3: 구현** — 스키마는 `optionalText(20|20|40, …)`, 보증년수는 `USEFUL_LIFE_MONTHS`(3..60, 3 단위) 중 하나 또는 빈 값, 제조사 `requiredText(40, …)`. 문구(messages/listing.ts): 라벨 `물품분류번호`·`보증년수`·`정품보증방법`·`대체상품명`, 오류 `"제조사는 40자 이하로 입력하세요"`, `"물품분류번호는 20자 이하로 입력하세요"`, `"보증년수는 목록에서 고른 값이어야 합니다"`, `"정품보증방법은 20자 이하로 입력하세요"`, `"대체상품명은 40자 이하로 입력하세요"`. 입력칸은 사양 칸 다음에. 글 칸은 기존 `prodNo` 칸과 같은 `FormField`, 보증년수는 기존 보증기간 선택과 같은 모양의 목록(옵션 "N개월" + 선택 안 함). 마스터 고를 때 `ProductPicker.pickMaster` 가 네 칸을 채운다(null 은 `""`, 보증년수는 문자열로).
- [ ] **Step 4: 실행 — 통과** `pnpm exec vitest run src/lib && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: 커밋** — `feat(frontend): 등록 폼 상품 새 칸·제조사 40자·상세 표시`

### Task 5: 문서·bruno·전체 검증

**Files:**
- Modify: `docs/data-model.md`(상품마스터·카테고리 마스터), `docs/security.md`("입력 검증" 제조사 40·새 칸 4개), `docs/decisions.md`(새 항목 + 색인 + 대체 표시), `bruno/` 매물 등록 요청 예시에 새 칸

- [ ] **Step 1: 문서** — decisions.md 새 항목 "2026-10-28 상품마스터 정의서 컬럼·카테고리 마스터": 재사용 키 네 값(9/29 이름+제조사 unique 를 대체), 카테고리 조각 저장 + `trd_ctgr_master`(10/13 상품마스터 → `trd_ctgr_code` FK 를 대체, `trd_ctgr_code` 는 패널용으로 남음), 생성 잠금 하나, 위 "판정" 4개. 옛 항목엔 대체 표시만 덧붙인다.
- [ ] **Step 2: 전체 검사** — `./gradlew check` → BUILD SUCCESSFUL. `pnpm typecheck && pnpm lint && pnpm test` → 통과.
- [ ] **Step 3: E2E** — `flow.spec.ts`(등록 → 검색 → 상세) 1번. 별도 DB 로 (PR 1 과 같은 방식: 임시 DB 만들고 백엔드 다른 포트, 끝나면 지움). 시간 초과는 재실행 1번.
- [ ] **Step 4: 커밋·푸시·PR** — `docs: 상품마스터·카테고리 마스터 문서`, 커밋 전 `git grep` 으로 실제 주소 없음 확인. PR 본문: 무엇을·왜·확인 방법, 정의서와 다른 점 표, 판정 4개. 그 뒤 `/code-review` 1회, 마이그레이션이 있으니 `/security-review`.
