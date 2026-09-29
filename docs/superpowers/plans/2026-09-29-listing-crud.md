# Listing CRUD (직접입력) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** listing(매물) 도메인의 기본 CRUD API를 만든다. 등록은 "직접입력" 방식만 구현한다(엑셀·PDF·이미지 자동등록은 보류). 직접입력 등록 시 상품마스터(`products`)에 없는 상품이면 자동으로 생성한다.

**Architecture:** `controller → service → repository` 3계층 (backend.md). 신규 패키지 `com.company.market.listing`. `ProductService`가 "이름+제조사로 찾고 없으면 생성"을 캡슐화하고, `ListingService`가 이를 호출해 매물을 만든다. 두 엔티티 모두 uuid 서로게이트 PK 없이 레거시 비즈니스 키를 그대로 PK로 쓴다(decisions.md 2026-09-29).

**Tech Stack:** Spring Boot 4.1, Java 21, Spring Data JPA, Bean Validation, Redis(RateLimiter), Testcontainers Postgres(테스트).

**Spec:** 이 대화의 사용자 지시(2026-09-29) + `backend/src/main/resources/db/migration/V202609291000__create_product_listing_tables.sql` (이미 작성·검증 완료) + `docs/data-model.md` 2절 + `docs/decisions.md` "2026-09-29 매물 스키마 1차".

## Global Constraints

- API 경로 `/api/v1/...`, 리소스 복수형. 응답 `{ ok, data }` 성공 / `{ ok, code, message, fields? }` 실패. 목록은 `{ items, nextCursor }` 커서 페이지네이션, offset 금지. (backend.md "API")
- 현재 사용자는 `@AuthenticationPrincipal AuthenticatedUser`로만 식별. 요청 본문·경로의 사용자 식별값을 그대로 신뢰해 쓰기 작업을 하지 않는다 — 소유자 검사는 서버가 토큰의 id와 비교. (CLAUDE.md 보안, backend.md "인증")
- 모든 요청 DTO에 Bean Validation. 수치는 `docs/security.md` "입력 검증"이 원본: 가격 0~10억, 수량 1~100,000 (이미 문서화됨, 그대로 재사용). 새 문자열 길이 상한은 이번 마이그레이션의 varchar 길이를 그대로 문서에 옮긴다(새 정책 아님, 이미 정해진 컬럼 길이의 기록).
- 검증 실패는 400 `{ ok:false, code:"VALIDATION", message, fields }`. 필드명은 요청 DTO 필드명 그대로. (backend.md)
- 쓰기 API는 rate limit. "상품 등록 10회/시간"은 이미 `docs/security.md`에 있음 — 그대로 씀. 수정·삭제는 이번에 새로 정해 문서에 추가.
- Lombok은 `@Getter`, `@Builder`, `@RequiredArgsConstructor`만. `@Data`·`@Setter` 금지. 엔티티는 protected 기본 생성자 + private `@Builder` 생성자, 세터 대신 의도 있는 메서드. (backend.md)
- 트랜잭션 경계는 service. 조회 기본은 `@Transactional(readOnly = true)`. (backend.md)
- 새 API마다 `bruno/listings/`에 요청 파일, 테스트는 최소 정상 1·권한없음(또는 검증실패) 1. (backend.md)
- DB 스키마는 이미 확정·검증됨 (`products` PK=`prod_id`, `listings` PK=(`user_id`,`reg_date`), FK `listings.user_id → users.id`, `listings.prod_id → products.prod_id`). 이 계획에서 마이그레이션을 바꾸지 않는다.
- `reg_date`/`dt_update`/`dt_expire` 등은 기존 `users.dt_reg` 관례와 같은 `varchar(14)` `yyyyMMddHHmmss` 문자열(서버가 `Instant`/`LocalDateTime` 대신 이 포맷으로 채움).
- 프론트 UI·zod 검증은 이 계획 범위 밖이다 (현재 frontend엔 매물 화면 자체가 없음, CLAUDE.md 저장소 구조). 이 계획은 백엔드 API까지만.

## Review Focus

- **다른 사용자 명의로 수정·삭제**: PATCH/DELETE 경로의 `{userId}`가 토큰의 사용자와 다르면 403이어야 한다 — Task 5, 6에서 이 케이스를 테스트로 고정.
- **직접입력 흐름에서 `prodId`를 클라이언트가 지정 못함**: 요청 DTO에 `prodId` 필드 자체가 없어야 한다(항상 상품명+제조사로 서버가 찾거나 만듦) — Task 3에서 DTO에 필드가 없는 것으로 보장, 없는 상품명으로 보내면 자동 생성되는 것을 테스트.
- **같은 사용자가 같은 초에 두 번 등록**: PK `(user_id, reg_date)` 충돌이 500으로 새면 안 된다 — Task 3에서 `DataIntegrityViolationException`을 잡아 이해 가능한 오류로 바꾸는 것을 테스트로 고정.
- **사진 0~4장 경계**: `photos`가 빈 리스트거나 4장 초과일 때 인덱스 오류·검증 누락이 없어야 한다 — Task 3에서 0장(상품마스터 사진 없음)과 4장(전부 채워짐) 양쪽을 테스트.
- **커서 값이 깨졌을 때**: `GET /api/v1/listings?cursor=` 에 형식이 다른 문자열이 오면 500이 아니라 빈 목록 또는 400이어야 한다 — Task 4에서 잘못된 커서 케이스를 테스트.

---

## File Structure

```
backend/src/main/java/com/company/market/listing/
├── domain/
│   ├── Product.java
│   ├── Listing.java
│   └── ListingId.java
├── repository/
│   ├── ProductRepository.java
│   └── ListingRepository.java
├── service/
│   ├── ProductService.java
│   └── ListingService.java
├── controller/
│   └── ListingController.java
└── dto/
    ├── ListingCreateRequest.java
    ├── ListingUpdateRequest.java
    ├── ListingResponse.java
    ├── ListingSummaryResponse.java
    └── ListingPageResponse.java

backend/src/test/java/com/company/market/listing/
├── repository/{ProductRepositoryTest,ListingRepositoryTest}.java
├── service/ProductServiceTest.java
└── controller/ListingApiTest.java

docs/security.md   (수정: 입력 검증에 매물 표, rate limit에 수정·삭제 행)
bruno/listings/{create,list,get,update,delete}.bru
```

---

### Task 1: 엔티티 + 리포지토리

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/domain/Product.java`
- Create: `backend/src/main/java/com/company/market/listing/domain/Listing.java`
- Create: `backend/src/main/java/com/company/market/listing/domain/ListingId.java`
- Create: `backend/src/main/java/com/company/market/listing/repository/ProductRepository.java`
- Create: `backend/src/main/java/com/company/market/listing/repository/ListingRepository.java`
- Test: `backend/src/test/java/com/company/market/listing/repository/ProductRepositoryTest.java`
- Test: `backend/src/test/java/com/company/market/listing/repository/ListingRepositoryTest.java`

**Interfaces:**
- Produces:
  - `Product` — `@Entity @Table("products")`, `@Id` 필드 `prodId: String`. 나머지 컬럼(1:1로 마이그레이션과 이름 매핑): `categoryCode, prodName, prodNo, prodBrand, prodMufcDate, prodSpecInfo, prodDataSheet, prodPhoto1, regDate, spareCol` 전부 `String`. `@Builder`로 전체 필드 생성(연산 없음, 컬럼 그대로).
  - `Listing` — `@Entity @Table("listings")`, `@IdClass(ListingId.class)`. `@Id` 필드 2개: `userId: UUID`, `regDate: String`. 나머지: `prodId, tradeType, prodState: String`; `salesUnitPrice, salesQuantity, minOrderQuantity, orderUnit: Integer`(not null); `deliveryDate: String`; `stockQuantity: Integer`(nullable); `prodDescription, prodDataSheet, prodPhoto1, prodPhoto2, prodPhoto3, prodImage4: String`; `warrantyPeriod: Integer`; `warrantyCoverage, replaceProd, testReport, certificateOfAuthen, dtUpdate, dtExpire, spareCol: String`. `@Builder`로 `dtUpdate`/`dtExpire` 제외한 전체 필드 생성자.
  - `Listing.applyUpdate(ListingUpdateRequest req, String nowRegDateFormat)` — Task 5에서 채움. 이번 태스크에서는 시그니처만 선언하지 않는다(빈 클래스에 나중 태스크가 메서드를 추가).
  - `ListingId` — `Serializable`, 필드 `UUID userId; String regDate;`. `@NoArgsConstructor @AllArgsConstructor @EqualsAndHashCode`(Lombok).
  - `ProductRepository extends JpaRepository<Product, String>` — `Optional<Product> findByProdNameAndProdBrand(String prodName, String prodBrand)`, `long countByProdIdStartingWith(String prefix)`.
  - `ListingRepository extends JpaRepository<Listing, ListingId>` — `List<Listing> findTop21ByRegDateLessThanOrderByRegDateDesc(String cursor)`, `List<Listing> findTop21ByOrderByRegDateDesc()` (첫 페이지, cursor 없음).

- [ ] **Step 1: `Product`·`Listing`·`ListingId` 엔티티, `ProductRepository`·`ListingRepository` 작성**

기존 `Organization.java`(protected 기본 생성자 + private `@Builder` 생성자, `@Getter`) 패턴을 따른다. `BaseEntity`는 상속하지 않는다(uuid PK·created_at/updated_at 없음 — decisions.md 2026-09-29).

- [ ] **Step 2: `ProductRepositoryTest` 작성 — 저장·조회, 이름+제조사 조회, prod_id 접두어 카운트**

```java
@Test
@DisplayName("상품명+제조사로 조회된다")
void findsByNameAndBrand() {
    products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
        .prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());

    assertThat(products.findByProdNameAndProdBrand("노트북 A", "삼성")).isPresent();
    assertThat(products.findByProdNameAndProdBrand("노트북 A", "LG")).isEmpty();
}

@Test
@DisplayName("prod_id 접두어로 개수를 센다 (채번용)")
void countsByPrefix() {
    products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001").prodName("A").prodBrand("삼성").regDate("20260929120000").build());
    products.saveAndFlush(Product.builder().prodId("ELEC00010002").categoryCode("ELEC0001").prodName("B").prodBrand("LG").regDate("20260929120001").build());

    assertThat(products.countByProdIdStartingWith("ELEC0001")).isEqualTo(2);
}
```

- [ ] **Step 3: `ListingRepositoryTest` 작성 — 저장 후 조회, 복합키 동작, 커서 조회 순서**

테스트용 `User`를 먼저 `UserRepository`(기존)로 저장해 `userId`를 얻는다(`UserRepositoryTest.personal(...)` 패턴 참고). `Product`도 하나 저장한다.

```java
@Test
@DisplayName("(user_id, reg_date) 복합키로 저장·조회된다")
void savesWithCompositeKey() {
    Listing saved = listings.saveAndFlush(Listing.builder().userId(userId).regDate("20260929120000")
        .prodId(product.getProdId()).tradeType("등록").prodState("new")
        .salesUnitPrice(10000).salesQuantity(1).minOrderQuantity(1).orderUnit(1).build());

    assertThat(listings.findById(new ListingId(userId, "20260929120000"))).isPresent();
}

@Test
@DisplayName("커서 이후 등록일시 내림차순으로 최대 21건 조회된다")
void cursorOrdering() {
    listings.saveAndFlush(baseListing("20260929120000"));
    listings.saveAndFlush(baseListing("20260929120001"));

    List<Listing> page = listings.findTop21ByRegDateLessThanOrderByRegDateDesc("20260929120002");
    assertThat(page).extracting(Listing::getRegDate).containsExactly("20260929120001", "20260929120000");
}
```

`baseListing(String regDate)`는 위 `savesWithCompositeKey`와 같은 필드로 `regDate`만 바꾼 헬퍼(테스트 클래스 내 private 메서드) — 구현자가 작성.

- [ ] **Step 4: 테스트 실행**

Run: `cd backend && ./gradlew test --tests "*listing.repository*"`
Expected: PASS (Docker Desktop 실행 중이어야 함 — decisions.md 2026-09-23)

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/company/market/listing/domain backend/src/main/java/com/company/market/listing/repository backend/src/test/java/com/company/market/listing/repository
git commit -m "feat(backend): listing 도메인 엔티티·리포지토리"
```

---

### Task 2: 상품마스터 자동등록 (`ProductService`)

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/service/ProductService.java`
- Test: `backend/src/test/java/com/company/market/listing/service/ProductServiceTest.java`

**Interfaces:**
- Consumes: `ProductRepository`(Task 1) — `findByProdNameAndProdBrand`, `countByProdIdStartingWith`, `save`(JpaRepository 기본).
- Produces: `ProductService.findOrCreate(ProductDraft draft) -> Product`. `ProductDraft`는 이 서비스 파일 안에 `record ProductDraft(String categoryCode, String prodName, String prodNo, String prodBrand, String prodMufcDate, String prodSpecInfo, String prodDataSheet, String firstPhoto)`로 선언(Task 3의 `ListingCreateRequest`가 이 record로 변환되어 넘어옴 — 변환은 Task 3의 `ListingService`가 함).

- [ ] **Step 1: `ProductServiceTest` — 있으면 재사용, 없으면 채번해서 생성**

```java
@Test
@DisplayName("이름+제조사가 같은 상품이 이미 있으면 새로 만들지 않고 그 행을 돌려준다")
void reusesExisting() {
    Product existing = products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
        .prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());

    Product found = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 A", null, "삼성", null, null, null, null));

    assertThat(found.getProdId()).isEqualTo(existing.getProdId());
    assertThat(products.count()).isEqualTo(1);
}

@Test
@DisplayName("없는 상품이면 categoryCode(8자)+일련번호(4자리)로 채번해 만들고, 대표사진은 넘어온 첫 사진")
void createsWithGeneratedId() {
    Product created = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 B", "MODEL-1", "LG", null, null, null, "photo-1.jpg"));

    assertThat(created.getProdId()).isEqualTo("ELEC00010001");
    assertThat(created.getProdPhoto1()).isEqualTo("photo-1.jpg");
}

@Test
@DisplayName("같은 카테고리에서 두 번째로 새로 만들면 일련번호가 0002")
void incrementsSequenceWithinCategory() {
    service.findOrCreate(new ProductDraft("ELEC0001", "노트북 C", null, "삼성", null, null, null, null));

    Product second = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 D", null, "삼성", null, null, null, null));

    assertThat(second.getProdId()).isEqualTo("ELEC00010002");
}
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd backend && ./gradlew test --tests "*ProductServiceTest*"`
Expected: FAIL (`ProductService`·`ProductDraft` 없음)

- [ ] **Step 3: `ProductService` 구현**

`categoryCode`를 8자로 맞추는 규칙: 8자 이상이면 앞 8자만 쓰고, 8자 미만이면 오른쪽을 `'0'`으로 채워 8자를 만든다(공백 대신 0 — 식별자에 트레일링 스페이스를 남기지 않기 위해, 이번에 정하는 규칙). 일련번호는 `countByProdIdStartingWith(prefix) + 1`을 4자리 0-패딩(`%04d`)으로 붙인다. `@Transactional` 쓰기 메서드(클래스 기본은 `@Transactional(readOnly = true)`).

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd backend && ./gradlew test --tests "*ProductServiceTest*"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/company/market/listing/service/ProductService.java backend/src/test/java/com/company/market/listing/service/ProductServiceTest.java
git commit -m "feat(backend): 상품마스터 없으면 자동 생성하는 ProductService"
```

---

### Task 3: 매물 등록 API (POST) — 직접입력

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingCreateRequest.java`
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingResponse.java`
- Create: `backend/src/main/java/com/company/market/listing/service/ListingService.java`
- Create: `backend/src/main/java/com/company/market/listing/controller/ListingController.java`
- Modify: `backend/src/main/java/com/company/market/common/exception/ErrorCode.java` — `// 매물` 그룹 추가
- Modify: `docs/security.md` — "입력 검증"에 매물 표, "Rate limit"에 수정·삭제 행
- Create: `bruno/listings/create.bru`
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`
- Test: `backend/src/test/java/com/company/market/listing/service/ListingServiceTest.java`

**Interfaces:**
- Consumes: `ProductService.findOrCreate(ProductDraft)`(Task 2), `ListingRepository.save`(Task 1), `AuthenticatedUser(id, role)`(기존, `common/auth`), `RateLimiter.hit(key, limit, window)`(기존, `common/ratelimit`), `ApiResponse.of(data)`(기존), `ApiException(ErrorCode)`(기존).
- Produces:
  - `ListingCreateRequest` record — 필드와 검증(값은 아래 security.md 표와 동일하게):
    `categoryCode`(`@NotBlank @Size(max=10)`), `prodName`(`@NotBlank @Size(max=50)`), `prodNo`(`@Size(max=20)`), `prodBrand`(`@NotBlank @Size(max=50)`), `prodMufcDate`(`@Size(max=14)`), `prodSpecInfo`(`@Size(max=100)`), `productDataSheet`(`@Size(max=100)`) — 이상 6개는 상품마스터용, `prodId`는 필드 자체가 없음(Review Focus 2번).
    `tradeType`(`@NotBlank @Size(max=20)`), `prodState`(`@NotBlank @Size(max=20)`), `salesUnitPrice`(`@NotNull @Min(0) @Max(1_000_000_000)`), `salesQuantity`(`@NotNull @Min(1) @Max(100_000)`), `minOrderQuantity`(`@Min(1)`, nullable), `orderUnit`(`@Min(1)`, nullable), `deliveryDate`(`@Size(max=10)`), `stockQuantity`(`@Min(0)`, nullable), `description`(`@Size(max=200)`), `listingDataSheet`(`@Size(max=100)`), `photos`(`@Size(max=4) List<@Size(max=100) String>`, nullable), `warrantyPeriod`(`@Min(0)`, nullable), `warrantyCoverage`(`@Size(max=10)`), `replaceProd`(`@Size(max=100)`), `testReport`(`@Size(max=100)`), `certificateOfAuthen`(`@Size(max=100)`).
  - `ListingResponse` record: `userId: UUID, regDate: String, prodId: String, prodName: String, prodBrand: String, tradeType: String, prodState: String, salesUnitPrice: Integer, salesQuantity: Integer, minOrderQuantity: Integer, orderUnit: Integer, deliveryDate: String, stockQuantity: Integer, description: String, photos: List<String>, warrantyPeriod: Integer, warrantyCoverage: String, replaceProd: String, testReport: String, certificateOfAuthen: String, dtUpdate: String, dtExpire: String`.
  - `ListingService.create(UUID userId, ListingCreateRequest req) -> ListingResponse` — `@Transactional`.
  - `ListingController` — `POST /api/v1/listings`, `@AuthenticationPrincipal AuthenticatedUser me` + `@Valid @RequestBody ListingCreateRequest req`, 응답 `201`.
  - `ErrorCode.LISTING_DUPLICATE_REG_TIME(HttpStatus.CONFLICT, "같은 시각에 이미 등록된 매물이 있습니다. 다시 시도해 주세요.")` — 복합키 충돌용(Review Focus 3번).

- [ ] **Step 1: `security.md` 수정 — "입력 검증"에 매물 표, "Rate limit"에 수정·삭제 행**

"입력 검증" 절의 계정 표 아래에 "매물 (2026-09-29)" 표를 추가한다. 값은 위 DTO 검증과 정확히 같아야 한다(카테고리코드 10, 상품명 50, 제조사 50, 거래종류 20, 상품상태 20, 납기일 10, 설명 200, 경로류 컬럼 100, 사진 최대 4장). 가격·수량은 기존 "숫자: 가격 0 ~ 10억, 수량 1 ~ 100,000"을 그대로 가리킨다(중복 기재 안 함).
"Rate limit" 표에 `매물 수정 | 20회/시간`, `매물 삭제 | 10회/시간` 행 추가(생성은 기존 "상품 등록 10회/시간" 재사용).

- [ ] **Step 2: `ListingApiTest` 작성 — 정상 등록(신규 상품 자동생성 포함), 검증 실패, 비로그인**

`SignupApiTest`처럼 `@Import(TestInfraConfiguration.class) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`. 로그인은 기존 `/api/v1/auth/signup/personal` → `/api/v1/auth/login`으로 실제 흐르게 하거나, `JwtProvider`로 직접 access 토큰을 만들어 `Authorization` 헤더에 싣는다(기존 테스트에 로그인 흐름 예시가 있으면 그걸 따른다 — 없으면 `JwtProvider.issueAccessToken(userId, role)` 같은 기존 메서드를 찾아 쓴다).

```java
@Test
@DisplayName("직접입력으로 등록하면 없던 상품마스터가 자동 생성되고, 대표사진은 등록한 첫 사진이다")
void createsListingAndAutoCreatesProduct() throws Exception {
    mvc.perform(post("/api/v1/listings").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryCode":"ELEC0001","prodName":"노트북 X","prodBrand":"삼성",
                 "tradeType":"등록","prodState":"new","salesUnitPrice":500000,"salesQuantity":3,
                 "photos":["p1.jpg","p2.jpg"]}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.ok").value(true))
        .andExpect(jsonPath("$.data.prodId").value("ELEC00010001"))
        .andExpect(jsonPath("$.data.photos[0]").value("p1.jpg"));

    assertThat(jdbc.queryForObject("select prod_photo_1 from products where prod_id = 'ELEC00010001'", String.class)).isEqualTo("p1.jpg");
}

@Test
@DisplayName("가격이 10억을 넘으면 400 VALIDATION, fields.salesUnitPrice")
void priceOverLimit() throws Exception {
    mvc.perform(post("/api/v1/listings").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryCode":"ELEC0001","prodName":"노트북 Y","prodBrand":"삼성",
                 "tradeType":"등록","prodState":"new","salesUnitPrice":2000000000,"salesQuantity":1}
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fields.salesUnitPrice").isString());
}

@Test
@DisplayName("로그인 없이 등록하면 401")
void requiresAuth() throws Exception {
    mvc.perform(post("/api/v1/listings").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isUnauthorized());
}

@Test
@DisplayName("사진 없이 등록해도 되고(0장), 4장 전부 채워도 된다")
void photosBoundary() throws Exception {
    mvc.perform(post("/api/v1/listings").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryCode":"ELEC0001","prodName":"노트북 Z1","prodBrand":"삼성",
                 "tradeType":"등록","prodState":"new","salesUnitPrice":1000,"salesQuantity":1}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.photos.length()").value(0));

    mvc.perform(post("/api/v1/listings").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("""
                {"categoryCode":"ELEC0001","prodName":"노트북 Z2","prodBrand":"삼성",
                 "tradeType":"등록","prodState":"new","salesUnitPrice":1000,"salesQuantity":1,
                 "photos":["a.jpg","b.jpg","c.jpg","d.jpg"]}
                """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.data.photos.length()").value(4));
}
```

**별도 파일 — Task 3에 같이 포함: `backend/src/test/java/com/company/market/listing/service/ListingServiceTest.java` (단위 테스트, Mockito — `regDate`는 서비스가 "지금 시각"으로 채번해 통합 테스트로는 PK 충돌을 재현하기 어렵기 때문에 서비스 단위로 검증한다)**

```java
@ExtendWith(MockitoExtension.class)
class ListingServiceTest {

    @Mock ListingRepository listings;
    @Mock ProductService products;
    @InjectMocks ListingService service;

    @Test
    @DisplayName("저장 시 복합키 충돌(DataIntegrityViolationException)이면 LISTING_DUPLICATE_REG_TIME 으로 바뀐다")
    void translatesDuplicateKeyViolation() {
        when(products.findOrCreate(any())).thenReturn(Product.builder().prodId("ELEC00010001").build());
        when(listings.save(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        ListingCreateRequest req = new ListingCreateRequest("ELEC0001", "노트북", null, "삼성", null, null, null,
            "등록", "new", 1000, 1, null, null, null, null, null, null, null, null, null, null, null);

        assertThatThrownBy(() -> service.create(UUID.randomUUID(), req))
            .isInstanceOf(ApiException.class)
            .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LISTING_DUPLICATE_REG_TIME);
    }

}
```

(레코드 생성자 인자 순서는 위 `ListingCreateRequest` 필드 선언 순서 그대로 — 구현자가 Task 3 Step 4에서 확정한 순서를 여기 맞춘다.)

- [ ] **Step 3: 테스트 실행 (실패 확인)**

Run: `cd backend && ./gradlew test --tests "*listing*"`
Expected: FAIL (컨트롤러·서비스 없음)

- [ ] **Step 4: `ListingCreateRequest`·`ListingResponse`·`ListingService`·`ListingController`·`ErrorCode` 구현**

`ListingService.create`: `regDate = 지금 시각을 "yyyyMMddHHmmss"로 포맷`. `photos`는 null이면 빈 리스트로 취급, 순서대로 `prodPhoto1/2/3/prodImage4`에 채우고 남는 칸은 null(Review Focus 4번 — 인덱스 접근 전 크기 검사). `minOrderQuantity`/`orderUnit`은 요청이 null이면 1. `ProductService.findOrCreate`에 넘길 `firstPhoto`는 `photos.isEmpty() ? null : photos.get(0)`. 저장 시 `DataIntegrityViolationException`(복합키 충돌)을 잡아 `ApiException(ErrorCode.LISTING_DUPLICATE_REG_TIME)`으로 바꾼다(Review Focus 3번, `ListingServiceTest`가 이 변환을 검증).

- [ ] **Step 5: 테스트 실행 (통과 확인)**

Run: `cd backend && ./gradlew test --tests "*listing*"`
Expected: PASS

- [ ] **Step 6: `bruno/listings/create.bru` 작성**

기존 `bruno/auth/signup-personal.bru` 형식을 따른다(로그인 쿠키·Authorization 헤더는 `bruno/environments/local.bru` 기존 변수 사용).

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/company/market/listing/dto backend/src/main/java/com/company/market/listing/service/ListingService.java backend/src/main/java/com/company/market/listing/controller backend/src/main/java/com/company/market/common/exception/ErrorCode.java backend/src/test/java/com/company/market/listing docs/security.md bruno/listings/create.bru
git commit -m "feat(backend): 매물 직접입력 등록 API, 상품마스터 자동생성"
```

---

### Task 4: 매물 조회 API (목록 커서 + 상세)

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingSummaryResponse.java`
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingPageResponse.java`
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` — `get`, `list` 추가
- Modify: `backend/src/main/java/com/company/market/listing/controller/ListingController.java` — `GET` 2개 추가
- Create: `bruno/listings/{list,get}.bru`
- Modify: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`

**Interfaces:**
- Consumes: Task 1의 `ListingRepository.findTop21ByRegDateLessThanOrderByRegDateDesc` / `findTop21ByOrderByRegDateDesc`, Task 3의 `ListingResponse`.
- Produces:
  - `ListingSummaryResponse` record: `userId: UUID, regDate: String, prodId: String, prodName: String, prodBrand: String, salesUnitPrice: Integer, salesQuantity: Integer, prodState: String, thumbnail: String`.
  - `ListingPageResponse` record: `items: List<ListingSummaryResponse>, nextCursor: String`(더 없으면 null).
  - `ListingService.list(String cursor) -> ListingPageResponse` — 페이지 크기 20(상수 `PAGE_SIZE = 20`), 21건을 가져와 21번째가 있으면 그 항목의 `regDate`를 `nextCursor`로.
  - `ListingService.get(UUID userId, String regDate) -> ListingResponse` — 없으면 `ApiException(ErrorCode.LISTING_NOT_FOUND)`.
  - `ErrorCode.LISTING_NOT_FOUND(HttpStatus.NOT_FOUND, "매물을 찾을 수 없습니다.")`.
  - `ListingController.list(@RequestParam(required=false) String cursor) -> ApiResponse<ListingPageResponse>` — `GET /api/v1/listings`.
  - `ListingController.get(@PathVariable UUID userId, @PathVariable String regDate) -> ApiResponse<ListingResponse>` — `GET /api/v1/listings/{userId}/{regDate}`. 인증 불필요(공개 조회).

- [ ] **Step 1: 테스트 작성 — 목록 커서, 상세 조회 성공/404, 잘못된 커서**

```java
@Test
@DisplayName("목록은 등록일시 내림차순, 21번째부터는 nextCursor로 다음 페이지")
void listIsCursorPaginated() throws Exception {
    // 21개 등록 (반복 호출 또는 리포지토리로 직접 시드)
    ...
    mvc.perform(get("/api/v1/listings"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.items.length()").value(20))
        .andExpect(jsonPath("$.data.nextCursor").isString());
}

@Test
@DisplayName("존재하지 않는 매물 조회는 404 LISTING_NOT_FOUND")
void getMissingIsNotFound() throws Exception {
    mvc.perform(get("/api/v1/listings/" + UUID.randomUUID() + "/20260101000000"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("LISTING_NOT_FOUND"));
}

@Test
@DisplayName("형식이 깨진 커서는 500이 아니라 빈 목록으로 처리된다")
void malformedCursorDoesNotCrash() throws Exception {
    mvc.perform(get("/api/v1/listings").param("cursor", "not-a-date"))
        .andExpect(status().isOk());
}
```

`malformedCursorDoesNotCrash`가 통과하려면 `regDate < :cursor` 비교가 문자열 비교라 어떤 문자열이 와도 SQL 자체는 안 깨진다는 점을 이용한다(그냥 결과가 다를 뿐 500이 나지 않음) — 별도 형식 검사 코드 불필요, 리포지토리 쿼리가 문자열 비교인 것으로 충분.

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: FAIL

- [ ] **Step 3: `ListingSummaryResponse`·`ListingPageResponse`·`ListingService.get/list`·컨트롤러 메서드 구현**

`thumbnail`은 `prodPhoto1, prodPhoto2, prodPhoto3, prodImage4` 중 첫 null 아닌 값.

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: PASS

- [ ] **Step 5: `bruno/listings/list.bru`·`get.bru` 작성**

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/company/market/listing backend/src/test/java/com/company/market/listing/controller bruno/listings/list.bru bruno/listings/get.bru
git commit -m "feat(backend): 매물 목록(커서)·상세 조회 API"
```

---

### Task 5: 매물 수정 API (PATCH, 소유자만)

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/ListingUpdateRequest.java`
- Modify: `backend/src/main/java/com/company/market/listing/domain/Listing.java` — `applyUpdate` 메서드
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` — `update` 추가
- Modify: `backend/src/main/java/com/company/market/listing/controller/ListingController.java` — `PATCH` 추가
- Create: `bruno/listings/update.bru`
- Modify: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`

**Interfaces:**
- Consumes: Task 1의 `Listing`, Task 3의 `ErrorCode`(FORBIDDEN은 기존 것 재사용).
- Produces:
  - `ListingUpdateRequest` record — Task 3의 `ListingCreateRequest`에서 상품마스터용 6개 필드(categoryCode, prodName, prodNo, prodBrand, prodMufcDate, prodSpecInfo, productDataSheet)를 뺀 나머지 전부, 전부 nullable(제공된 필드만 반영 — PATCH 부분수정). `@Min`/`@Max`/`@Size`는 Task 3과 동일 값(null이면 Bean Validation이 통과시킴 — 표준 동작).
  - `Listing.applyUpdate(ListingUpdateRequest req, String dtUpdate)` — null이 아닌 필드만 자신의 필드에 반영하고 `this.dtUpdate = dtUpdate`. (세터 금지 규칙 — 엔티티 안에서 직접 대입은 가능)
  - `ListingService.update(UUID pathUserId, String regDate, UUID requesterId, ListingUpdateRequest req) -> ListingResponse` — 없으면 `LISTING_NOT_FOUND`, `requesterId != pathUserId`면 `FORBIDDEN`.
  - `ListingController.update(...) -> ApiResponse<ListingResponse>` — `PATCH /api/v1/listings/{userId}/{regDate}`, rate limit `listing:update:{userId}` 20/시간.

- [ ] **Step 1: 테스트 작성 — 본인 수정 성공, 남의 매물 수정 403, 없는 매물 404**

```java
@Test
@DisplayName("본인 매물의 가격·수량을 수정하면 반영된다")
void ownerCanUpdate() throws Exception {
    createListing(...); // 헬퍼로 하나 만들어 둔 뒤
    mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":600000}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.data.salesUnitPrice").value(600000));
}

@Test
@DisplayName("다른 사용자의 매물을 수정하려 하면 403")
void othersCannotUpdate() throws Exception {
    // otherToken 으로 위 매물을 수정 시도
    mvc.perform(patch("/api/v1/listings/" + userId + "/" + regDate).header("Authorization", "Bearer " + otherToken)
            .contentType(MediaType.APPLICATION_JSON).content("{\"salesUnitPrice\":1}"))
        .andExpect(status().isForbidden());
}
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: FAIL

- [ ] **Step 3: `ListingUpdateRequest`·`Listing.applyUpdate`·`ListingService.update`·컨트롤러 구현**

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: PASS

- [ ] **Step 5: `bruno/listings/update.bru` 작성**

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/company/market/listing backend/src/test/java/com/company/market/listing/controller bruno/listings/update.bru
git commit -m "feat(backend): 매물 수정 API, 소유자만 허용"
```

---

### Task 6: 매물 삭제 API (DELETE, 소유자만)

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` — `delete` 추가
- Modify: `backend/src/main/java/com/company/market/listing/controller/ListingController.java` — `DELETE` 추가
- Create: `bruno/listings/delete.bru`
- Modify: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`

**Interfaces:**
- Consumes: Task 1의 `ListingRepository.deleteById`(JpaRepository 기본), Task 4의 `LISTING_NOT_FOUND`, 기존 `ErrorCode.FORBIDDEN`.
- Produces: `ListingService.delete(UUID pathUserId, String regDate, UUID requesterId): void` — 소유자 검사는 Task 5의 `update`와 같은 규칙. `ListingController.delete(...) -> ResponseEntity<Void>` — `DELETE /api/v1/listings/{userId}/{regDate}`, 성공 시 `204`, rate limit `listing:delete:{userId}` 10/시간.

- [ ] **Step 1: 테스트 작성 — 본인 삭제 성공(재조회 404), 남의 매물 삭제 403, 없는 매물 삭제 404**

```java
@Test
@DisplayName("본인 매물을 삭제하면 204, 다시 조회하면 404")
void ownerCanDelete() throws Exception {
    createListing(...);
    mvc.perform(delete("/api/v1/listings/" + userId + "/" + regDate).header("Authorization", "Bearer " + token))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate)).andExpect(status().isNotFound());
}

@Test
@DisplayName("다른 사용자의 매물을 삭제하려 하면 403이고 실제로 지워지지 않는다")
void othersCannotDelete() throws Exception {
    createListing(...);
    mvc.perform(delete("/api/v1/listings/" + userId + "/" + regDate).header("Authorization", "Bearer " + otherToken))
        .andExpect(status().isForbidden());
    mvc.perform(get("/api/v1/listings/" + userId + "/" + regDate)).andExpect(status().isOk());
}
```

- [ ] **Step 2: 테스트 실행 (실패 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: FAIL

- [ ] **Step 3: `ListingService.delete`·컨트롤러 구현**

- [ ] **Step 4: 테스트 실행 (통과 확인)**

Run: `cd backend && ./gradlew test --tests "*ListingApiTest*"`
Expected: PASS

- [ ] **Step 5: `bruno/listings/delete.bru` 작성**

- [ ] **Step 6: 전체 회귀 확인**

Run: `cd backend && ./gradlew check`
Expected: PASS (컴파일 + 전체 테스트 + 정적 분석)

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/company/market/listing backend/src/test/java/com/company/market/listing/controller bruno/listings/delete.bru
git commit -m "feat(backend): 매물 삭제 API, 소유자만 허용"
```
