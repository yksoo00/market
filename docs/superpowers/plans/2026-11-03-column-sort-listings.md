# 열 머리 클릭 정렬 — 1단계: 검색·내 판매·내 구매 표 (2026-11-03)

## 설계 (전체 3단계 중 1단계)

사용자 지시(2026-11-03 대화): 정렬 칩 말고 **표의 열 머리를 눌러도 정렬**. 결정(사용자 선택): ① 목록이 있는 **모든 표**(검색·내 판매·내 구매 / 내 거래이력 / 활동내역 요청·구매) ② **모든 열** ③ 누를 때마다 **오름 → 내림 → 기본(최신순)** ④ 기존 [정렬] 칩은 **유지하고 같은 값으로 같이 움직임**. 제 기본안(사용자 승인): 카테고리는 코드(대→중→소) 순서, 상품상태는 글자 순서, 상대(판매자·구매자)는 화면에 보이는 별명 기준, 같은 값끼리는 항상 최신순으로 끝맞춤, 값이 비어 있는 줄은 오름·내림 모두 맨 뒤.

단계: **1단계(이 PR)** 검색·내 판매·내 구매 + 공용 부품 → 2단계 내 거래이력 → 3단계 활동내역 요청·구매. 장바구니(카드)·비교(열 머리를 누르는 구조 아님)는 범위 밖, 모바일 카드는 열 머리가 없어 정렬 칩만.

### 주소·서버
- 주소의 `sort` 하나. 값: `latest`(기본, 등록일 내림) · `regDateAsc` · `열이름Asc|Desc` (열: name·brand·price·stock·state·category·minOrder·orderUnit·delivery). 기존 값(`priceAsc`·`priceDesc`·`deliveryAsc`)은 그대로 유효 → 옛 주소·북마크 안 깨짐.
- 서버: `ListingSearchCondition.SORT_PATTERN` 이 값 모양을 막고, `ListingSearchRepository.orderBy` 가 고정 문자열 표(`SORT_COLUMNS`)에서만 `order by` 를 만든다(값을 쿼리에 끼우지 않음). 비어 있을 수 있는 열은 `nulls last`, 같은 값은 `regDate desc, userId desc`. 최신순이 아니면 `page` 필수(커서는 최신순 전용)는 그대로. 스키마·인덱스 변경 없음(정렬 키를 전부 읽는 기존 PageKeys 방식 — 매물 수만 건 이상이면 재검토, decisions.md 2026-10-29).

### 화면
- 공용 `SortableTh`(열 머리 버튼 + ▲▼, 정렬 안 하는 열은 흐린 ↕, `aria-sort`)와 `lib/columnSort`(`nextSort`·`sortStateOf` — 2·3단계도 같이 씀).
- `ResultList` 의 상품명·제조사·단가·수량·상품상태·카테고리·최소 주문 수량·주문단위·납기일·등록일 열 머리가 눌린다(내 판매 표도 같은 부품). 누르면 `router.push(buildSearchHref({...query, sort, page: 1}))`. 기본(최신순)은 등록일 열의 내림으로 보인다.
- 정렬 칩은 선택지 4개(최신순·낮은가격순·높은가격순·납기빠른순) 그대로. 열 머리로 정한 값(예: 상품명 ▲)은 선택지에 없어도 칩 글자(`labelOf`)로 보이고, 칩에서 고르면 열 머리 표시도 바뀐다.

### 영향 검토
- API: 새 엔드포인트 없음, `sort` 허용 값만 늘어남(기존 값 호환). 프론트 `LISTING_SORTS` 는 서버 패턴과 같게 늘리고, 칩 선택지는 `LISTING_CHIP_SORTS` 로 분리.
- 새 화면·`page.tsx` 없음 → 화면 표·칸 규칙 영향 없음. `router.push` 는 같은 화면 안 쿼리 변경이라 기존 칩과 같은 방식.
- 내 구매 범위·내 판매(mine)도 같은 `findKeys` 를 지나 같이 정렬된다.

## 작업
1. 백엔드: `SORT_PATTERN`, `orderBy`/`SORT_COLUMNS`. `ListingSearchApiTest`: 열마다 오름·내림 순서, 같은 값 끝맞춤, nulls last, 잘못된 값 400.
2. 프론트 lib: `columnSort`(+테스트), `search.ts`(`LISTING_SORTS`·`LISTING_SORT_COLUMNS`·`listingSortColumn`), 문구, `DetailFilter` 의 `labelOf`.
3. 프론트 화면: `SortableTh`, `ResultList` 열 머리.
4. E2E `column-sort.spec.ts`(단가 3단 순환·칩 글자·칩에서 해제), docs(`decisions.md`·`design.md`).
5. `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, PR(`feat/column-sort-listings` → `dev`) → `/code-review`.
