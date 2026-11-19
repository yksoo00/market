# 제조일(prod_mufc_date·mufc_date) 컬럼 삭제 (2026-11-04)

> 실행 방식: 직접(native) — 작업마다 리뷰하지 않고 PR 마다 `/code-review` 한 번 (CLAUDE.md).

## 설계
사용자 지시: 정의서 `PROD_MASTER` 에 없는 `trd_prod_master.prod_mufc_date` 를 DB 에서 지우고, 그 값을 복사해 쓰던 `trd_cart_info.mufc_date` 도 같이 지운다 ("제조일시가 빠졌으니까 카트도 빼자"). 2026-10-28 "정의서에 없지만 유지 (재사용 키)" 결정을 뒤집는다.

### 결과
- 제조일이라는 기능이 사라진다: 매물 등록·수정 폼의 입력칸·검증, 상세·검색·거래 스냅샷 응답의 `mufcDate`, 장바구니의 제조일시.
- **같은 상품 = 이름·제조사·분류번호** (제조일 뺌). 제조일만 달라 따로 있던 상품은 이제 같은 상품으로 합쳐 찾는다.
- 이미 들어 있는 제조일 값은 컬럼과 함께 사라지고 되돌릴 수 없다 (되돌리는 방법은 빈 컬럼 추가뿐).
- `trd_cart_info` 가 정의서 CART_INFO(`MUFC_DATE` 있음)와 달라진다 → `data-model.md` "정의서와 다른 점"에 사용자 결정으로 적는다. 정의서 파일은 사용자 쪽에서 고친다(우리가 건드리지 않음).
- 임시 테이블 엑셀: 정의서 CART_INFO 헤더 그대로("제조일시" 포함) 불러오면 "모르는 컬럼" 400 — 조용히 버리지 않는다. 샘플 엑셀은 이 컬럼을 뺀 판으로 다시 만든다(저장소 밖).

### 두 번에 나눠 낸다 (무중단 규칙, db.md)
| PR | 브랜치 | 내용 | 시점 |
|---|---|---|---|
| ① 코드 | `feat/remove-mufc-date` | 코드가 두 컬럼을 안 읽고 안 쓴다. 컬럼은 그대로 있음 | PR #128(임시 테이블 별명) 머지 뒤 (`DevTableAliases` 를 같이 고치므로) |
| ② DB | `db/drop-mufc-date` | 컬럼 두 개 삭제 마이그레이션 + `data-model.md` | ① 이 배포된 뒤 |

① 에서 `Product`·`CartInfo` 엔티티에서 두 필드를 지우면 `ddl-auto=validate` 는 DB 에 남은 컬럼을 문제 삼지 않는다(엔티티에 없는 컬럼은 무시) — 그래서 ① 이 먼저여도 안전하고, 옛 서버(컬럼을 읽는 코드)가 도는 동안엔 ② 를 내지 않는다.

### 영향 검토
- API: 요청 `prodMufcDate` 를 빼지만 옛 프론트가 보내도 무시(400 아님 — Boot 기본 설정, 테스트로 고정). 응답 `mufcDate` 는 사라진다 → 프론트 같은 PR 에서 같이 뺀다.
- 데이터 흐름: `ProductService.findOrCreate`·`ListingService`(등록·수정의 상품 바꾸기)·`CartService`(담을 때 제조일 복사)가 바뀐다. 수정에서 "제조일만 바꿔 새 마스터로 옮기기" 경로는 없어진다.
- 시드 `db/seed/R__seed_dev_prod_master.sql` 은 컬럼을 넣으므로 ① 에서 뺀다 (② 뒤 시드가 깨지지 않게). 지난 마이그레이션 파일은 고치지 않는다.
- Bruno: `listings/update.bru`·`get.bru` 설명 줄만. 새 API 없음.

## Review Focus
1. 같은 이름·제조사·분류번호인 마스터가 이미 둘 이상(제조일만 다름)이면 `findSame` 이 `Optional` 단일 결과 예외를 던진다 → 가장 오래된(prod_id 작은) 한 행을 돌려준다.
2. 옛 클라이언트가 `prodMufcDate` 를 보내도 등록·수정이 400 이 아니라 무시된다.
3. 장바구니에 새로 담은 행은 `mufc_date` 가 null, 기존 행 값은 ①에서는 그대로(② 에서 컬럼과 함께 사라짐).
4. ② 뒤에도 장바구니 담기·목록, 매물 등록·검색이 정상이다 (컬럼 부재 쿼리 오류 없음).
5. 정의서 CART_INFO 헤더 그대로의 엑셀 불러오기는 "모르는 컬럼" 으로 거절된다.

## 작업

### 작업 ① 코드 (브랜치 `feat/remove-mufc-date`, `dev` 에서)
- [ ] **테스트 먼저** (실패 확인)
  - `ProductRepositoryTest`: `findSame(name, brand, classNo)` 는 제조일만 다른 두 행이 있어도 예외 없이 prod_id 가 작은 한 행을 돌려준다 (Review Focus 1)
  - `ListingApiTest`: ① 제조일 없이 같은 이름·제조사·분류번호로 두 번 등록하면 같은 `prodId` ② 등록·수정 요청에 `prodMufcDate` 를 넣어도 201/200 (Review Focus 2) ③ 상세·검색 응답에 `mufcDate` 필드 없음
  - 장바구니 담기 테스트(`CartApiTest` 의 기존 담기 케이스): 새 행 `mufc_date` null
- [ ] **백엔드**: `ProductRepository.findSame(String name, String brand, String classNo)` (`Optional<Product>`, 정렬 prodId, 한 행 — 파생 쿼리 대신 `@Query` + `Pageable` 또는 `findFirst`), `Product`(필드·생성자·`applyEdit`·`mufcDateIso` 삭제), `ProductService`(`ProductDraft` 에서 `prodMufcDate` 삭제, `ProductSearchItemResponse`), `ListingService`(`validateDates` 의 제조일 검사·수정에서 제조일 비교·`ListingTradeSnapshot`), DTO 5개(`ListingCreateRequest`·`ListingUpdateRequest`·`ListingResponse`·`ListingSearchItemResponse`·`ListingTradeSnapshot` 의 제조일), `CartService`·`CartInfo`(`mufcDate` 삭제)
- [ ] **임시 테이블**: `DevTableAliases` 에서 `mufc_date` 별명과 `prod_mufc_date` 설명을 지우고, `DevTableAliasTest` 의 "별명 없는 컬럼" 허용에 두 컬럼을 올린다(컬럼이 아직 DB 에 있으므로). ②에서 이 허용을 지운다
- [ ] **시드**: `R__seed_dev_prod_master.sql` 의 `prod_mufc_date` 열과 값 제거
- [ ] **프론트** (파일: `types/listing.ts`, `messages/listing.ts`·`search.ts`, `lib/listingForm.ts`·`listingEdit.ts`·`listingDetail.ts`·`compare.ts`·`rowEdit.ts`, `lib/validation/listing.ts`·`listingEdit.ts`, `components/listing/ListingForm.tsx`·`ListingEditForm.tsx`·`ProductPicker.tsx`, `components/search/ResultList.tsx` 와 각 `*.test.ts`): 입력칸·검증·표시·타입·문구에서 제조일을 지우고 테스트를 맞춘다
- [ ] **문서**: `decisions.md` 에 결정 추가(위 설계), `security.md` 입력 검증 표의 제조일 줄 삭제, `design.md` 매물 수정 설명의 "제조일", Bruno 두 줄
- [ ] **검사**: `./gradlew test --tests "*Listing*" --tests "*Product*" --tests "*Cart*" --tests "*DevTable*"` → `pnpm typecheck && pnpm lint && pnpm test` → PR 직전 `./gradlew check` + 매물 등록 E2E spec 한 번 → PR → `/code-review`

### 작업 ② DB (브랜치 `db/drop-mufc-date`, ① 배포 뒤)
- [ ] **테스트 먼저**: `SchemaConstraintsTest` 에서 `trd_prod_master.prod_mufc_date` 는 없고(`column(...)` 이 비어 있음), `trd_cart_info` 기대 컬럼 목록에서 `mufc_date` 를 뺀다 → 실패 확인
- [ ] **마이그레이션** `V<작성 시각 yyyyMMddHHmm>__drop_mufc_date_columns.sql`: `alter table trd_prod_master drop column prod_mufc_date; alter table trd_cart_info drop column mufc_date;` 맨 위 주석에 되돌리는 방법(`add column … varchar(14)`, 값은 복구 불가), 정의서와 다른 점(CART_INFO `MUFC_DATE` 없음, 사용자 결정 2026-11-04), "① 배포 후에만" 을 적는다. 지난 마이그레이션 파일은 고치지 않는다
- [ ] `CartInfoMigrationTest`(옛 스키마 `carttest` 에서 V202610291000 을 재생)가 이 마이그레이션 때문에 깨지지 않는지 확인 — 깨지면 그 테스트의 대상 버전만 고정
- [ ] `DevTableAliasTest` 의 "별명 없는 컬럼" 허용을 지운다(DB 에서 컬럼이 사라졌으므로)
- [ ] **문서** `data-model.md`: `prod_mufc_date`·`mufc_date` 행 삭제, "같은 상품" 문장(이름·제조사·분류번호), CART_INFO "정의서와 다른 점"
- [ ] **검사**: `./gradlew check` → PR → `/code-review`, `/security-review` 는 마이그레이션이 있으므로 한 번 (CLAUDE.md)
