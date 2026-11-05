# 엑셀 판매상품 다량 등록 (2026-11-05)

> **구현 방식:** 이 저장소 규칙(CLAUDE.md "중간 크기 기능")대로 계획 승인 뒤 직접(native) 구현한다. 작업마다 리뷰하지 않고 PR 에서 `/code-review` 한 번. 단계는 `- [ ]` 로 추적.

**Goal:** 홈·앱 메뉴의 "판매상품 다량 등록"을 누르면 드래그 앤 드롭 모달이 열리고, 엑셀 양식을 올리면 줄마다 검사한 결과를 보여 주며, 칸을 고친 뒤 체크한 줄만(또는 전체) 한 번에 등록한다.

**Architecture:** 서버는 stateless. 업로드 → 서버가 파싱·검사한 결과만 돌려주고, 수정·체크는 브라우저가 들고 있다. 확정 때 브라우저가 줄 값을 다시 보내면 서버가 전부 다시 검사한 뒤 한 트랜잭션으로 저장한다. 상품 마스터 찾기·생성은 기존 `ProductService.findOrCreate` 규칙을 쓴다.

**Tech Stack:** Spring Boot 4.1 / 이미 있는 Apache POI(`poi-ooxml` 6.0.0), Next.js 16 + react-hook-form 이 아니라 모달 안 표 상태(reducer) + zod. **새 라이브러리 없음, DB 스키마 변경 없음.**

**Spec:** 이 파일의 "설계" 절 (grilling 2026-11-05 에서 사용자와 정함).

## 설계

### 정해진 것 (사용자 확인)

- 범위는 **판매 다량 등록만**. 엑셀 대량구매는 별도 설계·PR.
- 서버가 정한 **양식 내려받기**. 헤더는 등록 폼 한글 라벨. 첫 시트만 읽는다.
- 상한 **200줄**, 파일 **10MB**(security.md 기존). 원본 엑셀은 **저장하지 않는다**(메모리에서 파싱 후 버림).
- 엑셀 칸: 상품 찾기용 — 상품명*, 제조사*, 분류번호, 상품번호, 카테고리 코드, (`prod_id` 알면 직접). 매물 — 상품상태*, 단가*, 수량*, 최소주문수량, 주문단위, 제공가능일*, 설명. 거래종류는 "등록" 고정. 보증·대체품·서류·사진은 안 받는다.
- **상품 찾기 순서**
  1. `prod_id` 가 있으면 그 마스터(없는 id 면 줄 오류).
  2. 이름·제조사·분류번호가 **정규화 일치**(앞뒤·중복 공백 정리, 대소문자 무시)하면 그 마스터.
  3. 못 찾으면 이름으로 기존 `LIKE` 부분일치 후보(최대 5개)를 줄에 붙인다. 후보를 고르면 그 줄의 `prod_id` 가 채워진다.
  4. 후보도 없으면 **신규 마스터**. 줄에 배지를 달고 **체크 기본 해제**. 신규가 되려면 상품명·제조사·카테고리 코드가 모두 있어야 하고, 아니면 줄 오류.
- 한 파일에서 같은 상품(해석된 마스터, 신규는 이름·제조사·분류번호)이 둘 이상이면 **둘째 줄부터 실패**("파일 안 중복").
- **사진**: 엑셀로는 못 올린다. 마스터 사진이 있으면 그걸 대표로 쓰고, 없으면(신규 마스터 포함) 사진 없이 등록한다. 줄에 안내 "사진 없음 — 등록 후 수정에서 추가"를 표시한다. 대표 사진 필수 규칙은 직접 등록(`ListingService.create`)에서만 유지.
- **화면**: 드래그 앤 드롭 모달 하나. 1 드롭존(끌어 놓기+클릭, [양식 다운로드]) → 2 검사 결과(위 "등록 가능 N", 아래 "실패 M"+사유, 모든 칸 제자리 수정) → 3 [선택 확정]·[전체 확정] → 4 결과. 줄은 목록 사이를 옮겨 다니지 않고 제자리에서 오류만 표시한다(요약 숫자는 실시간). 오류 있는 줄은 체크가 막힌다.
- 칸을 벗어나면(blur) 그 줄만 서버가 다시 검사. 상품 칸을 고치면 마스터를 다시 찾는다. 닫을 때 수정한 내용이 있으면 확인창.
- **확정**: 체크한 줄을 보내면 서버가 전부 다시 검사하고, 한 줄이라도 걸리면 **전부 롤백** + 걸린 줄 사유만 돌려준다(모달·입력 유지). 성공하면 등록된 줄은 사라지고 안 체크한 줄(실패·신규)은 남는다.
- 로그인한 본인 이름으로만 등록(본문 userId 없음). 개인·기업 구분 없음(기존 등록과 같다).

### 내가 정한 가정 (승인 때 확인)

1. **등록 시각(`reg_date`)**: `ListingService.create` 는 같은 사용자의 같은 초 등록을 409 로 막고, 매물 주소가 `(userId, regDate)` 다. 한 번에 여러 줄을 넣으면 전부 같은 초라 충돌한다. 그래서 확정 때 **시작 시각 + 줄 순서대로 1초씩** 올려 부여한다(앞서 같은 초 행이 이미 있으면 다음 초). 200줄이면 최대 약 3분 뒤 시각이 찍힌다. 대안(줄마다 sleep, 주소 체계 변경)은 더 나쁘다.
2. **엑셀은 `.xlsx` 만** 받는다. 기존 임시 화면(`DevTableService`)도 XSSF 만 쓰고, 양식도 `.xlsx` 이다. 프론트 `upload.ts` 의 `excel` 종류는 `.xls` 도 받지만 이 모달은 `.xlsx` 만 통과시킨다.
3. 검사 응답에 개인정보는 없다(상품·가격뿐). 로그에는 줄 번호·사유 코드만 남기고 셀 값은 남기지 않는다.

### API (모두 로그인 필요, `/api/v1/listings/bulk`)

- `GET /template` → `.xlsx` 바이트(헤더 + 예시 1줄 + 상품상태 드롭다운 검증). 바이트라 `{ ok, data }` 로 감싸지 않는다(기존 파일 응답과 같은 방식).
- `POST /parse` (multipart `file`) → `{ ok, data: { rows: BulkRowDto[], results: BulkRowResult[] } }`. 헤더가 양식과 다르면 400 `VALIDATION`(`fields.file`). 데이터 줄이 201개 이상이면 400. 완전히 빈 줄은 건너뛴다(줄 번호는 엑셀 행 번호 그대로).
- `POST /check` `{ rows: BulkRowDto[1~200] }` → `{ results: BulkRowResult[] }`. 줄 하나만 보내도 된다(칸 수정 후 재검사).
- `POST /commit` `{ rows: BulkRowDto[1~200] }` → 성공 `{ created: n }`. 하나라도 걸리면 409 `LISTING_BULK_INVALID` + `{ results }`(걸린 줄 사유). 아무것도 저장되지 않는다.

`BulkRowDto`(전부 문자열 — 엑셀 칸이 숫자 아닌 글자여도 400 대신 줄 오류로 보이게): `rowNo`(int), `prodId`, `prodName`, `prodBrand`, `prodClassNo`, `prodNo`, `categoryCode`, `prodState`, `salesUnitPrice`, `salesQuantity`, `minOrderQuantity`, `orderUnit`, `deliveryDate`, `description`.

`BulkRowResult`: `rowNo`, `status`(`MATCHED` | `NEW_MASTER` | `FAILED`), `prodId`(MATCHED 일 때), `matchedName`, `candidates`(최대 5: `prodId`, `prodName`, `prodBrand`, `prodClassNo`), `notices`(사진 없음 등 오류 아닌 안내), `fields`(필드명 → 사유 문구; 필드명은 `BulkRowDto` 와 같다).

규칙 수치는 `ListingCreateRequest` 의 어노테이션·상수와 **같은 값**을 쓴다(길이·범위·상품상태 패턴·`DELIVERY_DATE_PATTERN`, 최소주문≤수량, 카테고리 존재). 복사하지 않고 상수를 참조하거나, 줄을 `ListingCreateRequest` 로 바꿔 `Validator` 로 돌려 같은 검사를 쓴다(작업 2에서 택1, 후자 우선).

### 화면

- `frontend/src/components/listing/BulkListingDialog.tsx`(새), 표 상태 `lib/bulkListing.ts`(reducer, 순수 함수), 입력 규칙 `lib/validation/bulkListing.ts`(zod; security.md 수치와 동일), 호출 `lib/api` 에 4개.
- `QuickMenu`·`AppLauncher` 의 `sellBulk` 가 지금의 파일 선택창 대신 이 모달을 연다. 앱 메뉴(포털)에서 열 때 모달 안내는 기존 `NoticeDialog` 방식과 같다.
- 새 `page.tsx` 없음 → `tileScreens` 등록 없음. 모달은 창 가운데 전체 모달 방식(2026-11-02) 그대로, 안에서 스크롤. 3분할 오른쪽 아래 칸(640×330)에서 잘리지 않는지 확인. 모바일(390px)은 끌어 놓기 없이 [파일 선택]만, 표는 줄 카드로.
- 로딩(검사 중)·빈(데이터 줄 0개 → "양식에 입력한 줄이 없어요")·오류(재시도) 상태 포함. 문구는 `messages/listing.ts` 에 모은다. 새 오류 코드 `LISTING_BULK_INVALID` 는 `ErrorCode` 와 프론트 errors 키에 같은 PR.
- 디자인: `design.md` 에 모달 모양 추가(드롭존 점선 `line`, 실패 줄 `down`, 신규 배지, 안내 `ink-2`).

### 영향 검토

- 직접 등록(`ListingService.create`)은 **안 바꾼다**. 대량 쪽은 새 서비스 `ListingBulkService` 가 같은 `ProductService.findOrCreate`·`ListingRepository` 를 쓴다. 규칙이 갈라지지 않게 검사는 `ListingCreateRequest` 검증을 재사용한다.
- 마스터 생성 잠금(`lockCreation`)과 매물 등록 잠금(`lockRegistration`) 순서: 직접 등록과 같은 순서(마스터 → 사용자 잠금)로 얻어 교착이 없다.
- 사진 없는 매물이 새로 생긴다: 목록·상세·비교·장바구니 화면이 `prodPhoto1 == null` 을 견디는지 작업 6에서 확인(이미 있는 `photo` 필터는 null 허용).
- 매물이 늘면 느려질 곳: 검사 시 줄마다 마스터 조회 → 200줄 × 2~3쿼리. 측정 전 최적화(일괄 조회) 안 한다. 느리면 따로 상의.
- 홈 아이콘 `buyBulk`(엑셀 대량구매)는 그대로 "준비 중" 안내.

## Global Constraints

- 문구는 `frontend/src/messages/` 에. 컴포넌트에 하드코딩 금지.
- 입력 검증 두 층(프론트 zod + 백엔드 Bean Validation), 같은 수치(security.md "입력 검증").
- 응답 `{ ok, data }` / `{ ok:false, code, message, fields }`, 경로 `/api/v1/...`, 현재 사용자는 `@AuthenticationPrincipal` 만.
- Java 21 record DTO, 생성자 주입, Lombok `@Getter` 등 최소. 한글 `@DisplayName`.
- 인코딩 UTF-8(BOM 없음). 한글 파일은 필요한 줄만 국소 수정.
- 새 API 마다 `bruno/listings/` 요청 파일. 정상·권한 없음·잘못된 입력 테스트 각 1개 이상.
- 저장소는 공개: 실제 IP·호스트 등은 문서·커밋에 쓰지 않는다.

## Review Focus

1. **엑셀 날짜 셀**: 제공가능일이 문자열이 아니라 날짜 셀로 들어옴 → `YYYY-MM-DD` 로 변환해 통과. (작업 1)
2. **숫자 셀**: `1000.0`, 천 단위 쉼표 문자열 `"1,000"`, 공백만 있는 칸 → 정수로 해석하거나 "숫자로 입력" 칸 오류. (작업 1·2)
3. **헤더가 뒤바뀌거나 빠진 파일**, 다른 시트에 값이 있는 파일 → 첫 시트·헤더 이름 기준, 못 읽으면 400. (작업 1)
4. **같은 사용자 탭 두 개가 동시에 확정**: 사용자 잠금으로 줄 세워 `reg_date` 가 겹치지 않는다. (작업 3)
5. **확정 직전 다른 사람이 같은 상품 마스터를 새로 만듦**: 신규 줄이 그 마스터에 붙거나 한 마스터만 생긴다(`findOrCreate` 잠금). (작업 3)
6. 201줄, 0줄, 10MB 초과, `.xlsx` 로 위장한 일반 파일 → 400. (작업 1·4)

---

## 작업

### 작업 1. 양식·파서 (백엔드)

**Files:**
- Create: `backend/src/main/java/com/company/market/listing/dto/BulkRowDto.java`, `.../service/ListingBulkTemplate.java`, `.../service/ListingBulkParser.java`
- Test: `backend/src/test/java/com/company/market/listing/service/ListingBulkParserTest.java`

**Interfaces:**
- Produces: `ListingBulkTemplate.build(): byte[]`, `ListingBulkParser.parse(InputStream): List<BulkRowDto>`(빈 줄 제외, 201개 이상·헤더 불일치는 `ValidationException`), `ListingBulkParser.HEADERS: List<String>`(칸 순서와 한글 이름 단일 원본).

- [ ] **Step 1: 실패하는 테스트** — `파서는 양식 헤더대로 읽는다`, `날짜 셀은 YYYY-MM-DD 문자열이 된다`, `숫자 셀 1000.0 은 "1000" 이 된다`, `완전히 빈 줄은 건너뛰고 rowNo 는 엑셀 행 번호다`, `헤더가 다르면 ValidationException(fields.file)`, `데이터 201줄이면 거절`, `양식 build() 결과를 parse 하면 예시 줄 1개가 나온다`.
- [ ] **Step 2: 실행해 실패 확인** — `./gradlew test --tests "*ListingBulkParserTest"` → 클래스 없음.
- [ ] **Step 3: 구현** — POI `XSSFWorkbook`(`DevTableService` 와 같은 방식), `DataFormatter` 로 문자열화, 날짜 셀은 `DateUtil.isCellDateFormatted` 로 따로. 양식에는 상품상태 드롭다운 검증과 필수 칸(*) 표시.
- [ ] **Step 4: 통과 확인** — 같은 명령.
- [ ] **Step 5: 커밋** — `feat(backend): 다량 등록 엑셀 양식·파서`

### 작업 2. 줄 검사·마스터 매칭 (백엔드)

**Files:**
- Create: `.../dto/BulkRowResult.java`, `.../service/ListingBulkService.java`(`check`)
- Modify: `ProductRepository.java`(정규화 일치 조회 1개 추가), `ErrorCode.java`(`LISTING_BULK_INVALID`)
- Test: `.../service/ListingBulkServiceTest.java`(Testcontainers)

**Interfaces:**
- Consumes: `ProductService.find`, `ProductService.search`, `CategoryService.resolveMinor`.
- Produces: `ListingBulkService.check(UUID userId, List<BulkRowDto> rows): List<BulkRowResult>`. 파일 안 중복은 이 목록 안에서 판정(둘째 줄부터 `fields` 에 `prodName` 사유 "파일 안에서 같은 상품이 이미 있어요").

- [ ] **Step 1: 실패하는 테스트** — 이름·제조사·분류번호 일치(대소문자·공백 달라도) → `MATCHED`+`prodId`; 일치 없고 부분일치 있음 → `FAILED`가 아니라 `NEW_MASTER`+`candidates`(상품명·제조사·카테고리 있을 때); 카테고리 코드 없음 → `FAILED` `fields.categoryCode`; `prodId` 가 없는 id → `fields.prodId`; 상품상태가 목록 밖 → `fields.prodState`; 수량 0·단가 음수·최소주문>수량·납기일 형식; 같은 상품 두 줄 → 둘째만 실패; 사진 없는 마스터 → `notices` 에 안내, 상태는 `MATCHED`.
- [ ] **Step 2: 실행해 실패 확인.**
- [ ] **Step 3: 구현** — 줄을 `ListingCreateRequest` 로 바꿔 `Validator` 로 검사(작업 규칙: 같은 수치), 나머지 조건(최소주문≤수량, 카테고리 존재)은 `ListingService.create` 와 같은 문구. 정규화는 입력 쪽에서 공백 정리, DB 쪽은 `lower()` 비교. 후보는 `products.search`(기존 LIKE) 상위 5개.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: 커밋** — `feat(backend): 다량 등록 줄 검사·마스터 매칭`

### 작업 3. 확정 (백엔드)

**Files:**
- Modify: `ListingBulkService.java`(`commit`)
- Test: `ListingBulkServiceTest.java`

**Interfaces:**
- Produces: `ListingBulkService.commit(UUID userId, List<BulkRowDto> rows): int`(등록 건수). 검사에서 `FAILED` 가 하나라도 있으면 `ApiException(LISTING_BULK_INVALID)` 로 결과 목록을 실어 던진다 — 저장 없음.

- [ ] **Step 1: 실패하는 테스트** — `전부 통과하면 모두 저장되고 등록 시각이 1초씩 다르다`; `한 줄이 틀리면 하나도 저장되지 않고 사유가 돌아온다(롤백)`; `신규 마스터 줄은 마스터가 생긴다`; `사진 있는 마스터는 매물 사진이 마스터 사진`; `사진 없는 마스터는 매물 사진이 null`; `같은 초에 이미 있는 매물이 있으면 다음 초로 밀린다`; `다른 사용자 이름으로는 등록되지 않는다(userId 는 인증 정보)`.
- [ ] **Step 2: 실행해 실패 확인.**
- [ ] **Step 3: 구현** — `@Transactional`, `listings.lockRegistration(userId)` 한 번, `check` 재실행, 줄 순서대로 `findOrCreate`(신규)·`Listing.builder()` 저장. 재고 = 판매수량(기존 규칙), 거래종류 "등록", 최소주문·주문단위 기본 1.
- [ ] **Step 4: 통과 확인.**
- [ ] **Step 5: 커밋** — `feat(backend): 다량 등록 확정(한 트랜잭션)`

### 작업 4. 컨트롤러·문서 (백엔드)

**Files:**
- Create: `.../listing/controller/ListingBulkController.java`
- Test: `.../listing/controller/ListingBulkApiTest.java`
- Create: `bruno/listings/bulk-template.bru`, `bulk-parse.bru`, `bulk-check.bru`, `bulk-commit.bru`
- Modify: `docs/security.md`(다량 등록 표: 200줄·10MB·xlsx·원본 미보관·인증), 프론트 쪽 errors 키는 작업 6.

- [ ] **Step 1: 실패하는 테스트** — 정상(`template` 200+xlsx, `parse`→`check`→`commit` 흐름), 로그인 없음 401(4개 모두), 잘못된 입력(`.xlsx` 아님·헤더 불일치·201줄 → 400, `commit` 오류 줄 → 409 `LISTING_BULK_INVALID`), 응답에 이메일·전화 등 개인정보 없음.
- [ ] **Step 2: 실패 확인** → **Step 3: 구현**(컨트롤러는 얇게, `@AuthenticationPrincipal` 만) → **Step 4: 통과** (`./gradlew test --tests "*ListingBulk*"`).
- [ ] **Step 5: 커밋** — `feat(backend): 다량 등록 API 와 Bruno 요청`

### 작업 5. 프론트 로직

**Files:**
- Create: `frontend/src/types/listingBulk.ts`, `frontend/src/lib/validation/bulkListing.ts`, `frontend/src/lib/bulkListing.ts`
- Modify: `frontend/src/lib/api`(4개 호출, 기존 파일 이름 확인 후)
- Test: `frontend/src/lib/validation/bulkListing.test.ts`, `frontend/src/lib/bulkListing.test.ts`

**Interfaces:**
- Produces: `bulkRowSchema`(zod, 칸별 오류), `bulkReducer(state, action)`(액션: `loaded`, `edited{rowNo, field, value}`, `rechecked{results}`, `toggled{rowNo}`, `pickedCandidate{rowNo, prodId}`, `committedOk`, `commitFailed{results}`), 선택자 `summary(state): { ok, failed, selected, newMasters }`, `canCommit(state): boolean`.

- [ ] **Step 1: 실패하는 테스트** — 오류 있는 줄은 `toggled` 가 무시된다; 신규 마스터 줄은 로드 시 체크 해제; 칸을 고치면 그 줄만 `dirty`, 재검사 결과가 오면 갱신되고 체크는 유지(오류가 생기면 해제); 후보 선택 시 `prodId` 채워지고 상태 갱신 대기; `committedOk` 는 등록된 줄을 지우고 체크 안 한 줄은 남긴다; 요약 숫자; 선택 0건이면 `canCommit` false. 입력 규칙 테스트는 security.md 수치 경계값(수량 1/100000, 단가 0/10억, 납기일 형식, 상품상태 목록).
- [ ] **Step 2: 실행해 실패 확인** — `pnpm exec vitest run src/lib/bulkListing.test.ts src/lib/validation/bulkListing.test.ts`
- [ ] **Step 3: 구현** → **Step 4: 통과 + `pnpm typecheck && pnpm lint`**
- [ ] **Step 5: 커밋** — `feat(frontend): 다량 등록 표 상태·입력 규칙`

### 작업 6. 모달·연결·문서 (프론트)

**Files:**
- Create: `frontend/src/components/listing/BulkListingDialog.tsx`
- Modify: `frontend/src/components/home/QuickMenu.tsx`, `frontend/src/components/common/AppLauncher.tsx`(`sellBulk` 연결), `frontend/src/messages/listing.ts`(문구·오류 키), `frontend/src/lib/validation/upload.ts`(`.xlsx` 전용 종류가 필요하면만; 먼저 기존 `excel` 로 되는지 확인)
- Modify: `docs/design.md`(모달 모양, 홈 아이콘 줄의 "엑셀 선택창 바로" 문구), `docs/decisions.md`(2026-11-05 엑셀 다량 등록 — 위 "정해진 것"·"가정" 요약, 색인 한 줄), `CLAUDE.md` 의 문서 표는 안 바꿈.
- 확인(코드 변경 없을 수도): 목록·상세·비교·장바구니가 `prodPhoto1 == null` 을 견디는지.

- [ ] **Step 1~3: 모달 구현** — 드롭존(끌어 놓기 + 클릭), 올리자마자 확장자·크기 검사(`checkUpload`), 상태 4단계, 칸 수정(blur 시 `/check` 한 줄), 후보 선택, 신규 배지, 요약·[선택 확정]/[전체 확정](신규 N건 안내 문구), 실패 시 모달·입력 유지, 닫기 확인.
- [ ] **Step 4: 화면 확인** — 데스크톱·390px, 3분할 오른쪽 아래 칸(960×500, 640×330)에서 잘림 없음. 결과 보고에 확인한 배치를 적는다. 사진 null 렌더 확인.
- [ ] **Step 5: 검사** — `pnpm typecheck && pnpm lint && pnpm test`
- [ ] **Step 6: 커밋** — `feat(frontend): 엑셀 판매상품 다량 등록 모달`, 문서는 `docs:` 별도 커밋.

### 작업 7. E2E·마무리

- [ ] `frontend/e2e/bulk-listing.spec.ts`: 로그인 → 홈 [판매상품 다량 등록] → 양식 올림(테스트가 만든 xlsx: 정상 2줄 + 오류 1줄 + 신규 1줄) → 오류 줄 칸 수정 → 신규 줄 체크 → [선택 확정] → 내 판매글에서 확인. 백엔드·compose 먼저 실행 후 이 spec 1번(시간 초과는 재실행 1번).
- [ ] `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `git grep` 으로 실제 IP·호스트 없음 확인.
- [ ] 브랜치 `feat/bulk-listing` 푸시 → PR(본문: 무엇을·왜·확인 방법, 위 "가정" 3개 명시) → `/code-review` 1회 → 반영 → 보고. 머지는 사용자가 한다.
