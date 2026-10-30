# 내 거래이력 검색·필터 계획

이 파일은 설계 + 작업 (CLAUDE.md "중간 크기 기능" — 새 테이블·인증 변경 없음). 승인은 이 파일 한 번, 구현은 직접, PR 에서 `/code-review` 한 번. 브랜치 `feat/history-filter` (main 에서). DB 스키마 변경 없음.

## 설계

### 확정된 것 (사용자 2026-10-30)

- 화면 정의 (사용자 재확인 2026-10-30): 내 거래이력 = 구매확정된 완료 건만 모이는 곳, 내 활동내역 = 진행 중인 건만. 이 계획은 이 기준을 바꾸지 않는다 — 필터는 그 안에서만 건다.
- 검색 = **상품명** 부분 일치만. 필터 = 가능한 건 전부: **기간(확정일)**, **금액 범위**, **정렬**. 기존 구매/판매/전체 탭은 그대로.

### 계획이 정한 것 (검토 때 확인)

1. 파라미터 (`GET /api/v1/trades/history` 에 추가, 전부 선택):
   - `q` 상품명, 앞뒤 공백 제거 후 100자 이하 (security.md `q` 와 같은 수치). `% _ \` 는 글자로 이스케이프.
   - `from`·`to` 확정일 `yyyy-MM-dd`, 양끝 포함. `from > to` 면 400.
   - `minAmount`·`maxAmount` 0 ~ 2,147,483,647 (금액 컬럼이 int). `min > max` 면 400.
   - `sort` = `latest`(기본) | `oldest` | `amountDesc` | `amountAsc`. 같은 값이면 확정일시·거래ID 내림차순으로 끝을 맞춘다.
   - 틀린 값은 400 `VALIDATION` + `fields.<파라미터>`.
2. 상품명 검색은 이력 줄에 상품명이 없어서(`prod_id` 만) 상품마스터에서 이름이 맞는 `prod_id` 를 먼저 구해 `prod_id in (...)` 로 건다. 거래 → 매물 방향의 `ListingService` 에 `productIdsByName(q)` 추가 (매물 서비스를 통해서만, 상품 리포지토리 직접 접근 금지). 맞는 상품이 상한 500개를 넘으면 앞 500개만 쓴다 (`PURCHASED_KEYS_MAX` 와 같은 이유). 맞는 상품이 없으면 쿼리 없이 빈 결과.
3. 페이지 번호 방식(`page`)이면 `findKeys` 가 필터·정렬을 받아 정렬 순서대로 전체 키를 돌려준다. 정렬이 바뀌면 "앞 줄 키부터 키셋" 방식이 정렬마다 달라지므로, 키 목록에서 그 페이지 키 20개를 바로 잘라 `findAllById` 로 읽고 키 순서대로 놓는다 (offset 아님 — 키는 이미 전부 읽었다). 정렬은 `@Query` + `Sort` 인자.
4. 커서 방식(`page` 없음)은 지금 그대로 최신순만. 필터는 받지만 `sort` 가 `latest` 아니면 `page` 가 필요하다고 400 (프론트는 항상 `page` 를 쓴다). 새로 키셋을 정렬별로 만들지 않는다.
5. 프론트: 검색 화면 `FilterBar` 의 `상세` 팝업 모양을 따른다 (사용자 지시 2026-10-30: 칩 여러 개 없이 **상세 필터 하나만**). 목록 위 한 줄에 검색창(상품명) + [상세] 버튼(걸린 개수 표시). [상세]를 누르면 팝업에 기간 2칸·금액 2칸·정렬 선택, [적용] 한 번에 반영·[초기화]. 값은 주소(`?q=&from=&to=&min=&max=&sort=`)가 원본, 적용하면 `router.push`(page 는 1로). 주소로 들어와도 입력 칸이 채워진다.
   - 템플릿화: 검색창 + [상세] 팝업 껍데기 + 주소 ↔ 필터 변환 + 오류 표시는 화면 중립 부품(`components/common/DetailFilter*`)으로 만들고, 거래이력은 칸 정의(키·라벨·입력 종류·검증)만 넘긴다. 다음 PR 에서 활동내역 요청·구매 탭이 정의만 추가해 쓴다. 사용자가 보일 필터를 고르는 기능은 안 만든다.
   - 검증은 두 층: 프론트 zod(`lib/validation/historyFilter.ts`, 백엔드와 같은 수치) — blur 시 필드 아래 오류 문구, 오류 있으면 [적용] 비활성. 서버가 돌려준 `fields` 도 해당 칸에 표시.
   - 필터가 걸려 있으면 "조건에 맞는 거래가 없어요 + [필터 초기화]" 빈 상태 (필터 없는 빈 상태와 문구 분리).
   - 탭을 바꿔도 필터는 유지 (`tabPageHref` 에 필터 같이 실음). 필터가 하나라도 있으면 줄 위에 건수(`total`) 표시.
   - 팝업은 3분할 오른쪽 아래 칸(640×330)에서 잘리지 않아야 한다 — 체크리스트 5번. 검색 `FilterBar` 의 기존 팝업 처리를 먼저 읽고 같은 방식으로.
   - 검색 화면의 `FilterBar` 는 건드리지 않는다 (요청 밖). 껍데기를 공유할 수 있으면 읽기만 하고, 검색 전용 타입에 묶여 있으면 새로 만든다.
6. 새 의존성 없음. 날짜 입력은 `<input type="date">`.

## 작업

각 작업: 실패하는 테스트 먼저 → 구현 → 바꾼 영역 테스트. 커밋 작게.

### 작업 1 — 백엔드
- `ProductRepository`/`ListingService`: 상품명 부분 일치 `prod_id` 목록 (이스케이프, 500 상한).
- `TradeHistoryRepository`: `findKeys`·`findPage` 에 기간·금액·상품 id 조건, `findKeys` 에 `Sort`. 키로 잘라 읽기(`findAllById`).
- `TradeActivityService.history`: 파라미터 검증(위 1), 위 2~4 반영. `TradeController` 파라미터 추가.
- 테스트(`TradeActivityApiTest`): 상품명 부분 일치(대소문자·`%` 글자), 기간 경계 포함, 금액 범위, 정렬 4종 + 같은 금액 안정 순서, 필터 + 구매/판매 탭 조합, 페이지 번호가 필터된 건수 기준, 맞는 상품 없음 → 빈 결과, 잘못된 값 400 (날짜 형식·from>to·min>max·음수·q 101자·sort), 남의 이력은 필터해도 안 보임, 커서 방식 + 비기본 정렬 400.
- `bruno/trades/history.bru` 파라미터 추가.

### 작업 2 — 프론트
- `types/trade.ts`·`lib/api/trades.ts` `history(side, page, filter)`.
- `lib/historyFilter.ts`: 주소 ↔ 필터 객체 파싱(틀린 값은 버림)·주소 만들기. `lib/validation/historyFilter.ts` zod. `lib/myTabs.ts` 의 `tabPageHref` 는 그대로 쓰고 필터를 params 로 넘긴다.
- `components/common/DetailFilter*` (검색창 + [상세] 팝업 껍데기, 칸 정의 기반), `components/my/` 에 거래이력 칸 정의. `HistoryList` 에 필터 전달·건수·필터 빈 상태. `app/my/history/page.tsx` 에서 필터 파싱, 필터 바뀌면 `key` 로 다시 마운트.
- `messages/my.ts` 문구 (라벨·오류·빈 상태·정렬 이름).
- 테스트: `historyFilter.test.ts`(파싱·주소·검증 수치 경계), 새 화면은 아니므로 화면 표 등록 없음. 넓은 화면에서 `[홈 | 내 거래이력]`·3분할 아래 칸(640×330)에서 필터 줄이 안 잘리는지 직접 확인.

### 작업 3 — 문서·검증
- `docs/security.md` 입력 검증 표에 거래이력 파라미터 수치, `docs/design.md` 검색창 + 상세 필터 팝업, `docs/data-model.md` 변경 없음 확인.
- `./gradlew test --tests "*TradeActivityApiTest"` 후 PR 직전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, E2E 는 거래이력 흐름 spec 에 필터 한 단계 추가해 그 spec 만 1번.

## 영향 검토

- API: 선택 파라미터만 추가 → 기존 호출 그대로 호환 (롤링 무중단). 응답 모양 변경 없음.
- 데이터 흐름: 거래 → 매물(상품마스터) 방향만 사용, 순환 없음. 내 id 는 인증 정보에서만, 필터는 항상 본인 이력 조건 안에서 적용.
- 성능: 키 전부 읽기는 PR 5 와 같은 비용. 상품명 `like` 는 상품마스터 풀스캔이지만 마스터가 작다 (느려지면 다시 본다).
- 개인정보: 응답 변경 없음 (닉네임만).
- 위험: `:x is null` 로 선택 조건을 거는 JPQL 에서 Integer/문자열 null 타입 추론이 Postgres 에서 깨질 수 있음 → 작업 1 첫 테스트로 확인, 깨지면 조건별 분기로.
