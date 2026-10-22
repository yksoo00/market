# 장바구니 비교 (설계 + 계획)

> 중간 크기 기능 — 새 테이블·도메인 패키지·인증 변경 없음. 스펙과 계획을 이 파일 하나로 (CLAUDE.md 작업 방식, decisions.md 2026-10-21). 승인은 이 파일 한 번, 구현은 직접, 리뷰는 PR 의 `/code-review` 한 번.

## 설계

### 무엇을 (사용자 지시, 2026-10-22 대화로 정함)

- 장바구니(`/my/cart`)에서 상품을 골라 [비교] → 비교 화면에서 나란히 본다.
- 같은 **소분류**(카테고리 코드 전체 `P01-Q01-R001` 이 같음)끼리만. 지금 상품은 전부 소분류 코드에 붙어 있다(DB 확인: 상품마스터 107개 모두 `category_class = '소'`).
- 한 번에 **2~4개**. 칸(iframe)에서도 읽히는 폭이라 4개.
- 비교 항목은 **상세 화면의 모든 칸**: 대표 사진, 상품명·번호, 사양, 제조사, 상품ID, 납기일, 상품상태, 등록단가, 재고, 카테고리 경로, 거래종류, 제조일, 최소주문량, 주문단위, 등록수량, 보증기한, 불량지원, 등록일, 대체품, 데이터시트·테스트리포트·정품인증서(있음/없음), 사진 수, 제품 개요(설명), 거래상태.
- 추가 ("필요해 보이는 것 전부"):
  - 값이 다른 줄 강조 + [다른 항목만 보기] 토글
  - 가장 좋은 값 표시: 등록단가 최저, 재고 최대, 납기일 가장 빠름, 보증기한 가장 김, 최소주문량 최소. 동점은 모두 표시, 값 없는 상품은 후보에서 뺀다. 거래완료 상품은 후보에서 뺀다
  - 열마다 [견적 요청]·[구매]·[빼기]·상품명 링크(상세). 기존 `QuoteDialog`·`PurchaseDialog`·`cartApi.remove` 재사용

### 어떻게

- **DB·백엔드 변경 없음.** 비교는 화면만이고 `구매검토/비교용` 행을 만들지 않는다 — 비교는 장바구니 안에서 잠깐 보는 것이라 기록할 이유가 없다(장바구니도 같은 이유로 지우는 기록, 2026-10-21). `비교용` 값은 계속 안 쓴다.
- 비교 화면 `/my/cart/compare?items=<userId>_<regDate>,...` (2~4개). URL 이 상태 — 새로고침·칸 복원 그대로.
- 데이터: 기존 `GET /api/v1/listings/{userId}/{regDate}` 를 상품마다 병렬로(최대 4번) + `GET /api/v1/cart` 1번(빼기용 tradeId, 장바구니에 아직 있는지). 새 API 를 만들지 않는 이유: 4개뿐이고 상세 API 가 이미 모든 칸을 준다.
- 화면 표: `{ id: "cartCompare", group: "buy", pattern: /^\/my\/cart\/compare$/ }`. 장바구니(주기능, buy)에서 `openTile(href, false)` → 연관이라 보조 칸. 헤더에서 직접 열 일은 없다.
- 로그인 필요(`RequireLogin`) — 장바구니 화면에서만 들어온다.
- 표 모양: 첫 열 = 항목 이름(sticky left), 상품마다 한 열(최소 폭 11rem, 넘치면 가로 스크롤). 맨 위 줄 = 사진 + 상품명(상세 링크) + 거래완료 배지 + 버튼. 다른 값 줄은 배경 `bg-primary-soft` 계열(design.md 확인), 가장 좋은 값은 값 옆 작은 배지("최저가"·"재고 최대"·"가장 빠름"·"가장 김"·"최소").
- 빼기: 확인 창 없음(장바구니와 같음) → `cartApi.remove` → `notifyCartChanged()` → 그 열을 URL 에서 빼고 `router.replace` (같은 화면 안 쿼리 변경이라 큐를 안 거쳐도 됨). 남은 게 1개 이하면 "비교할 상품이 2개 이상 있어야 해요" + [장바구니로].
- 견적·구매 성공: 기존 완료 안내 그대로, `notifyCartChanged()` 후 장바구니를 다시 읽는다. 장바구니에서 빠진 열은 그대로 보이되 [빼기]만 숨긴다(견적·구매는 장바구니 밖 매물에도 되는 API).
- 다른 칸에서 장바구니가 바뀌면(`onCartChanged`) 장바구니만 다시 읽는다 (매물 값은 다시 안 읽음).

### 막는 경우 (장바구니 화면 [비교])

| 경우 | 동작 |
|---|---|
| 1개 이하 선택 | 버튼 비활성 |
| 5개 이상 | 알림 "한 번에 4개까지 비교할 수 있어요." |
| 소분류가 다름 | 알림 "같은 소분류 상품끼리만 비교할 수 있어요." |
| 거래완료 포함 | 막지 않는다(정보는 볼 수 있음). 비교 화면에서 배지·버튼 숨김 |

### 비교 화면 오류 상태

| 경우 | 동작 |
|---|---|
| `items` 파라미터가 없음·형식 틀림·5개 이상·중복(uuid 대소문자 무시) | "비교할 상품을 장바구니에서 다시 골라 주세요." + [장바구니로] |
| 일부 상품 404(그새 지워짐) | 그 열을 빼고 알림 "지워진 상품은 빼고 보여 줘요." 남은 게 2개 미만이면 위 안내 |
| 1개만(비교 화면에서 빼고 새로고침) | "비교할 상품이 2개 이상 있어야 해요." + [장바구니로] — 빼기 직후와 같은 안내 (리뷰 반영) |
| 읽은 상품의 소분류가 다름(주소를 손으로 고침) | "같은 소분류 상품끼리만 비교할 수 있어요." + [장바구니로] |
| 네트워크·5xx | "비교할 상품을 불러오지 못했어요." + [다시 시도] |
| 로딩 | 표 자리 스켈레톤 |

### 다른 영역 영향

- API·데이터: 없음 (읽기 API 만 더 부름). 메일·재고 없음.
- 장바구니 화면: `ResultList` cart scope 에 [비교] 버튼 하나. 다른 scope 는 그대로.
- 칸 규칙: 화면 표 한 줄. `tileScreens.test.ts` 가 덮음.
- 보안: 상세 API 는 공개 정보 — 남의 장바구니 매물이어도 새는 것 없음. 서류는 있음/없음만(파일을 받지 않음, 보려면 상세로).

### 범위 밖

- 비교 목록 저장(`비교용` 행), 장바구니 밖(검색 결과)에서 비교, 소분류가 다른 상품의 공통 칸 비교, 인쇄·내보내기.

## 작업

브랜치 `feat/cart-compare`, git worktree. 테스트는 바꾼 영역만, `./gradlew check` 는 백엔드 변경이 없어 생략(CI 가 돈다), 프론트 `pnpm typecheck && pnpm lint && pnpm test` 는 매 커밋 전.

### 작업 1: 비교 규칙 (`lib/compare.ts`) — TDD

**Files:** Create `frontend/src/lib/compare.ts`, `frontend/src/lib/compare.test.ts`, `frontend/src/messages/compare.ts`

**Interfaces:**
- `MIN_COMPARE = 2`, `MAX_COMPARE = 4`
- `compareBlock(items: ListingSearchItem[]): null | "tooFew" | "tooMany" | "category"` — 장바구니 [비교] 판단
- `compareHref(items: {userId, regDate}[]): string` → `/my/cart/compare?items=<userId>_<regDate>,...`
- `parseCompareItems(raw: string | null): {userId, regDate}[] | null` — 형식(`isValidListingPath`)·개수 2~4·중복 검사, 틀리면 null
- `compareRows(details: ListingDetail[]): CompareRow[]` — `{ key, label, values: string[], differs: boolean, best: Set<number>, badge?: string }`. 값 문자열은 상세와 같은 포맷(`infoRows` 재사용 + 추가 줄)
- `withoutItem(items, key)` — 빼기 뒤 URL 용

**테스트:** 2~4개 경계, 소분류 다름, 파싱(잘못된 uuid·14자리 아님·중복·5개), differs(같은 값·다른 값), best(최저가 동점 둘, 값 없는 상품 제외, 거래완료 제외, 납기 가장 빠름, 보증 가장 김), 서류 있음/없음 줄.

- [ ] 실패하는 테스트 → `pnpm exec vitest run src/lib/compare.test.ts` FAIL
- [ ] 구현 → PASS, `pnpm typecheck && pnpm lint`
- [ ] 커밋 `feat(frontend): 장바구니 비교 규칙`

### 작업 2: 비교 화면

**Files:** Create `frontend/src/app/my/cart/compare/page.tsx`(`my/cart/page.tsx` 틀), `frontend/src/components/cart/CompareView.tsx`. Modify `frontend/src/lib/tileScreens.ts`, `frontend/src/lib/tileScreens.test.ts`, `frontend/src/messages/compare.ts`

- [ ] `tileScreens.test.ts` 에 `screenOf("/my/cart/compare?items=…")` → `{ id: "cartCompare", group: "buy" }` → FAIL → 표에 한 줄 → PASS
- [ ] `CompareView`: `useSearchParams` → `parseCompareItems` → `Promise.all(listingsApi.get)` + `cartApi.list()`. 위 오류 상태 표 전부. 표·강조·배지·[다른 항목만 보기]·열 버튼(견적·구매·빼기·상세 링크 `openTile(listingHref, false)`). `onCartChanged` 로 장바구니만 다시 읽기
- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 커밋 `feat(frontend): 장바구니 비교 화면`

### 작업 3: 장바구니 [비교] 버튼

**Files:** Modify `frontend/src/components/search/ResultList.tsx` (cart scope `actions` 의 [빼기] 다음에 [비교], outline), `frontend/src/messages/compare.ts`

- [ ] 2개 미만 비활성, `compareBlock` 결과로 알림, 통과하면 `openTile(compareHref(chosen), false)`
- [ ] `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 커밋 `feat(frontend): 장바구니에서 비교 열기`

### 작업 4: E2E·화면 배치·문서·PR

**Files:** Create `frontend/e2e/compare.spec.ts` (`cart.spec.ts` 헬퍼 방식, `register` 에 소분류 인자). Modify `docs/decisions.md`(새 항목 + 색인 "거래" 줄 + 미정의 "비교용"), `docs/data-model.md`(`비교용` 줄에 "비교는 화면만, 행 없음")

- [ ] E2E `장바구니에서 같은 소분류끼리 비교 → 다른 소분류는 막힘 → 비교 화면에서 빼기`: 판매자 매물 3개(인텔 CPU 2개 단가 다르게, 다른 소분류 1개) → 구매자 3개 담기 → 장바구니에서 다른 소분류 섞어 [비교] → 알림 → 인텔 2개 [비교] → 비교 화면 2열·"최저가" 배지·[다른 항목만 보기] → 한 열 [빼기] → "2개 이상" 안내, 헤더 배지 2
- [ ] 메모리의 E2E 요령대로 `compare.spec.ts` 만 1번 (시간 초과면 재실행 1번)
- [ ] 화면 배치 눈으로 (`.claude/rules/frontend.md` 체크리스트): `[홈 | 장바구니 | 비교]` 열림·새로고침 복원, 3분할 오른쪽 아래 칸(960×500·640×330)에서 비교 표 가로 스크롤·구매/견적 모달 안 잘림, 모바일 390px. 결과를 PR 본문에
- [ ] 문서: decisions.md "2026-10-22 장바구니 비교: 화면만, 같은 소분류 2~4개" (결정·이유·감수(상세 API 4번)·재검토 조건(비교 목록 저장 요구, 4개 넘게 요구, 소분류 아닌 상품 생김))
- [ ] `pnpm typecheck && pnpm lint && pnpm test`, `git grep` 실제 IP·포트 없음
- [ ] 푸시 → PR(무엇·왜·확인 방법·다른 영역 영향) → `/code-review` → 반영 → 보고. 메모리 진행 상태 갱신
