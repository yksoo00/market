# 열 머리 클릭 정렬 — 2단계: 내 거래이력 + 가로 스크롤 개선 (2026-11-03)

## 설계
1단계(`2026-11-03-column-sort-listings.md`)의 결정 그대로: 열 머리를 누르면 오름 → 내림 → 기본(최신순), 정렬 칩과 같은 `sort` 값, 제 기본안(빈 값 맨 뒤·같은 값은 최신순·상품명 가나다순·별명 기준 상대).

### 거래이력 (2단계)
- 열: 확정일시·구분(전체 탭만)·상품명·상대·단가·수량·금액. sort 값: `latest`(확정일시 내림, 기본)·`oldest`(확정일시 오름)·`sideAsc|Desc`·`nameAsc|Desc`·`partyAsc|Desc`·`unitPriceAsc|Desc`·`quantityAsc|Desc`·`amountAsc|Desc`(기존).
- 서버: 상품명·상대 이름은 이력 테이블 밖 값이라 DB `Sort` 로 못 한다 → `TradeHistoryRepository.findKeys` 가 정렬용 값(판매자·상품·수량·단가·금액)까지 가진 키를 읽고 `TradeActivityService.keyOrder` 가 자바에서 정렬한다(페이지 번호 방식이 어차피 키를 전부 읽는다). 상품명은 `ListingService.productNames`, 상대는 `UserDirectory.nicknamesOf`(화면에 보이는 별명) 로 한 번에 조회. 글자 순서는 `Collator`(한국어). 값이 비면 오름·내림 모두 맨 뒤, 같은 값은 최신(확정일시·거래ID 내림차순)으로 끝맞춤.
- `TradeFilterRules.SORTS` 는 활동내역과 같이 쓴다 — 활동내역 쪽 정렬(3단계)이 오기 전까지 프론트는 칩 선택지 값만 보낸다(`parseTradeFilter` 가 `HISTORY_CHIP_SORTS` 만 읽음).

### 가로 스크롤 (사용자 지시 2026-11-03)
1. 넓은 표(검색·내 판매·거래이력·활동내역·비교)의 가로 스크롤바가 표 맨 아래에 있어 내려갔다 올라와야 했다 → `StickyXScroll`: 진짜 스크롤바는 숨기고 같은 폭의 막대를 `sticky bottom-0` 으로 달아 서로 맞춘다. 표를 보는 동안 막대가 화면 아래에 따라다닌다.
2. 정렬을 누르면 표가 다시 만들어져 가로 위치가 처음으로 돌아갔다 → 정렬 직전 `rememberXScroll(key)` 로 위치를 기억해 새 표가 만들어질 때 복원하고, 이동은 `router.push(…, { scroll: false })` 로 세로 스크롤도 맨 위로 튀지 않게 한다.

### 영향 검토
- API: 새 엔드포인트 없음, `sort` 허용 값만 늘어남(기존 값 호환). 스키마 변경 없음.
- 표 틀(`overflow-x-auto` → `StickyXScroll`)이 5곳 바뀐다 — 안쪽 `sticky left-0` 열은 그대로 동작(스크롤 영역이 안쪽 몸통). 모바일 카드는 영향 없음.

## 작업
1. 백엔드: `findKeys` 확장·`keyOrder`, `TradeFilterRules.SORTS`. `TradeActivityApiTest`(열마다 오름·내림·끝맞춤·빈 값).
2. 프론트: `HISTORY_SORTS`·`HISTORY_SORT_COLUMNS`·칩 `labelOf`, `HistoryList` 열 머리, `StickyXScroll` 와 5곳 적용. 단위 테스트, E2E(`column-sort.spec.ts` 가로 스크롤).
3. docs → `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, PR → `/code-review`.
