# 매물 검색 API 연결 설계

> 2026-10-02. 브레인스토밍에서 사용자와 합의한 내용. 10-01 검색 결과 화면(`2026-10-01-search-results-design.md`)의 mock을 실제 API로 바꾼다. 화면 규칙(URL 파라미터·필터 의미·검증 수치·표 모양)은 그 스펙을 그대로 따른다.

## 목적

검색 결과가 실제 DB 매물을 보여주고, 행을 누르면 매물 상세(`/listings/{userId}/{regDate}`)가 실제 데이터로 열리게 한다. 지금은 검색 결과가 가짜 15건이라 상세가 "찾을 수 없음"이 된다.

## 범위

- 포함: 기존 `GET /api/v1/listings`에 검색어·필터·전체 개수 추가, 비로그인 rate limit, 프론트 검색 결과를 API 조회로 교체(로딩·오류·더 보기), mock·프론트 필터 함수 삭제, 카테고리 select 숨김, 문서·Bruno·테스트.
- 제외: 카테고리 필터(아래 결정), 정렬 선택, 페이지 번호 이동, 홈 실시간 목록 연결, 검색 성능 인덱스(pg_trgm 등 — 느린 게 측정되면).

## 결정

- **카테고리 필터는 이번에 뺀다 (사용자 결정).** 화면 카테고리는 한글 이름 12개(`lib/mock/home.ts`)인데 DB `category_code`는 자유 코드(`ELEC0001` 등)이고 `prod_id`가 "코드 8자리 + 일련번호"라 이름을 그대로 저장할 수 없다. 카테고리 마스터는 `decisions.md` 미정 항목. 골라도 결과가 안 바뀌는 select는 고장으로 보이므로 결과 화면 `FilterBar`와 홈 `SearchBox`의 카테고리 select를 숨긴다. URL `category`는 해석만 하고 API로 보내지 않는다. 마스터가 정해지면 다시 붙인다. `decisions.md`에 기록.
- **새 경로 없이 기존 목록 API에 쿼리 파라미터.** 리소스 목록에 필터를 거는 규칙(`backend.md`)이고, 이미 공개 조회(`permitAll`)라 보안 설정이 바뀌지 않는다. 응답 한 줄은 요약(`ListingSummaryResponse`)에서 검색 결과 형식으로 바꾼다 — 프론트에서 이 목록을 쓰는 곳이 아직 없다.
- **커서 페이지네이션 + [더 보기] (사용자 확인).** `backend.md` "offset 금지", 기존 목록과 같은 커서. 보는 중에 새 매물이 등록돼도 중복·누락이 없다. 페이지 번호로 바로 가기는 안 되고, "검색결과 N건"은 `total`로 따로 센다.
- **검색 결과도 클라이언트 조회.** 매물 상세(decisions.md 2026-10-02)와 같은 방식. 페이지(서버 컴포넌트)는 URL만 해석하고 결과 영역이 `lib/api`로 조회한다. 검색 결과 페이지는 검색엔진 노출 대상이 아니다.
- **브랜치는 `feat/listing-detail` 위에 쌓는다.** 상세 작업의 날짜·거래상태 계산(`toIsoDate`, `warrantyUntil`, `tradeStatus`)을 같이 쓴다. PR은 상세 PR 머지 후.

## API: `GET /api/v1/listings`

### 쿼리 파라미터

| 이름 | 값 | 없을 때 | 검증 (어기면 400 `VALIDATION`, 필드명 그대로) |
|---|---|---|---|
| `q` | 문자열 | 조건 없음 | 100자 이하 (앞뒤 공백 제거 후) |
| `field` | `all` \| `name` \| `brand` | `all` | 그 외 값 |
| `status` | `available` \| `completed` \| `all` | `all` (기존 목록 동작 유지. 화면은 항상 보냄) | 그 외 값 |
| `minStock` | 정수 | 조건 없음 | 0 ~ 100,000 |
| `minPrice`, `maxPrice` | 정수 | 조건 없음 | 0 ~ 1,000,000,000, 둘 다 있으면 최소 ≤ 최대 (어기면 `maxPrice`에 오류) |
| `deliveryBy` | `YYYY-MM-DD` | 조건 없음 | 실제 날짜 |
| `cursor` | `regDate_userId` | 첫 페이지 | 깨진 값은 첫 페이지 (기존 동작) |

### 조건 의미 (10-01 스펙과 같음)

- 검색어: 공백으로 나눈 낱말마다, 대소문자 무시로 검색 범위 문자열에 들어 있어야 한다(모든 낱말, 순서 무관). 범위: `all` = 상품명 + 상품번호 + 제조사, `name` = 상품명 + 상품번호, `brand` = 제조사. 낱말 안의 `%`·`_`·`\`는 이스케이프해 글자 그대로 찾는다.
- 거래상태: `available` = `dt_expire` 없음, `completed` = 있음, `all` = 거르지 않음.
- 재고: `stock_quantity >= minStock`. 가격: `minPrice <= sales_unit_price <= maxPrice`(한쪽만 있으면 한쪽만).
- 납품일: `delivery_date <= deliveryBy`. `delivery_date`가 없는 매물은 납품일 조건이 있으면 제외.
- 정렬: `reg_date desc, user_id desc`(기존 커서와 같음). 한 페이지 20건.

### 응답

`{ ok: true, data: { items, nextCursor, total } }`

- `items`: `ListingSearchItemResponse[]` — 프론트 `ListingSearchItem`(`types/listing.ts`)과 1:1. `hasDataSheet` = 매물 또는 상품 데이터시트 있음, `hasPhoto` = 매물 사진 또는 상품 사진 있음(상세의 대체값 규칙과 같음). `hasReplaceProd`·`hasTestReport`·`hasCertificate` = 해당 키 있음. `mufcDate`·`warrantyUntil`·`tradeStatus`는 상세 응답과 같은 계산. `category`는 코드 그대로(화면 표에 카테고리 열 없음).
- `nextCursor`: 다음 페이지가 없으면 null.
- `total`: 같은 조건의 전체 개수(커서와 무관).

### 구현

- `ListingSearchCondition` record에 Bean Validation, 컨트롤러는 `@Valid @ModelAttribute`로 받는다. 최소 ≤ 최대는 서비스에서 `ValidationException(Map.of("maxPrice", …))`(등록 API의 `minOrderQuantity` 검사와 같은 방식).
- 리포지토리: 조건이 있을 때만 붙는 JPQL을 문자열로 조립하고 값은 전부 파라미터 바인딩(SQL 인젝션 방지, security.md). `Listing`과 `Product`는 `prodId`로 조인. 목록 쿼리와 같은 WHERE로 `count` 쿼리. JPA 기본 기능만 — 의존성 추가 없음.
- 날짜·거래상태 계산은 상세 작업의 private 함수를 listing 패키지 안의 공용 위치로 옮겨 두 응답이 같이 쓴다.
- Rate limit: 비로그인 요청은 IP 기준 분당 60 (`security.md` "검색 API (비로그인)", 이미 정해진 수치). 키 `listing:search:ip:<remoteAddr>`. 로그인 사용자는 제한 없음(문서에 없음).

## 프론트

| 파일 | 변경 |
|---|---|
| `lib/search.ts` | `filterListings` 삭제. `searchApiParams(query: SearchQuery, cursor?: string): string` 추가 — 카테고리 제외, 기본값(`field=all`)은 생략, `status`는 항상 포함 |
| `lib/search.test.ts` | `filterListings` 테스트 삭제, `searchApiParams` 테스트 추가 |
| `lib/mock/search.ts` | 삭제 |
| `lib/api/listings.ts` | `search(query, cursor?)` → `ApiResult<{ items: ListingSearchItem[]; nextCursor: string \| null; total: number }>` |
| `components/search/SearchResults.tsx` (새, client) | 첫 페이지 조회, 로딩 스켈레톤(행 높이 유지), 오류 + [다시 시도], [더 보기](받은 결과 뒤에 붙임). 검색 조건이 바뀌면 `key`로 다시 마운트 |
| `components/search/ResultList.tsx` | 화면 그리기만. "검색결과 N건"은 `total` prop |
| `app/search/page.tsx` | mock·필터 호출 대신 `SearchResults` |
| `components/search/FilterBar.tsx`, `components/home/SearchBox.tsx` | 카테고리 select 숨김 (주석: 마스터 정해지면 복원, decisions.md) |
| `messages/search.ts` | 로딩 실패·429·더 보기 문구 |

## 상태·오류

| 상황 | 화면 |
|---|---|
| 로딩 | 결과 표 자리에 행 높이를 유지한 스켈레톤 (design.md "상태") |
| 0건 | 기존 빈 상태 그대로 |
| 400 `VALIDATION` | URL을 손으로 고친 경우뿐(프론트가 잘못된 값을 미리 버림) → "불러오지 못했어요" + [다시 시도] |
| 429 | "잠시 후 다시 시도해 주세요." + [다시 시도] |
| 네트워크·5xx | "불러오지 못했어요" + [다시 시도] |
| [더 보기] 실패 | 이미 보이는 결과는 그대로, 버튼 옆 오류 한 줄 |

## 테스트

- 백엔드 `ListingApiTest`(Testcontainers, repository로 데이터 직접 생성):
  - 여러 낱말 모두 포함·순서 무관·대소문자 무시
  - `field`별 범위 (`brand`로 상품명 낱말 검색 시 0건)
  - `%`·`_`가 와일드카드로 동작하지 않음
  - 거래상태 3종, 가격 범위(한쪽만·양쪽), 재고, 납품일(납기일 없는 매물 제외)
  - 필터 + 커서: 다음 페이지에 중복·누락 없음
  - `total`이 페이지와 무관한 전체 개수
  - 범위 밖 값·최소 > 최대·잘못된 `field`/`status`/날짜 → 400과 해당 필드
  - 비로그인 61번째 요청 429, 로그인 사용자는 제한 없음
  - 파라미터 없는 기존 호출이 계속 200(전체, 최신순)
- 프론트 Vitest: `searchApiParams`(카테고리 제외, 기본값 생략, `status` 포함, 커서 포함, 검색어 인코딩).
- 수동: 실제 DB 매물로 검색어·필터, 행 클릭 → 상세, [더 보기](21건 이상 데이터).

## 문서

- `security.md` "입력 검증"에 검색어 100자.
- `decisions.md`: 카테고리 필터 보류 항목 + 색인. 10-01 검색 결과 항목의 "백엔드 검색 API는 다음 PR"에 이 스펙 링크.
- `design.md`: 홈 검색창·필터 바에서 카테고리 select 숨김 반영.
- `data-model.md`: 매물 절에 검색 조건이 쓰는 컬럼.
- `bruno/listings/list.bru`: 파라미터·응답 갱신.

## 브랜치

`feat/search-api` (`feat/listing-detail` 위). 스키마 변경 없음, 의존성 추가 없음. 머지 전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `/code-review`, 입력 검증·rate limit이 바뀌므로 `/security-review`.
