# 검색 결과 화면 설계 (프론트, mock 1차)

> 2026-10-01. 브레인스토밍에서 사용자와 합의한 내용. 백엔드 검색 API는 다음 PR.

## 목적

홈 검색창에서 검색하면 `/search`로 이동해 매물 목록을 표로 보여주고, 결과 화면에서만 필터(거래상태·재고수량·가격·납품일·카테고리)를 건다. 여러 매물을 체크해 한 번에 구매·견적 요청을 누를 수 있는 자리를 만든다 (동작은 거래 흐름이 정해질 때까지 "준비 중").

## 범위

- 포함: `/search` 페이지, 검색창(검색 구분 select), 필터 바, 결과 표(데스크톱)·행 카드(모바일), 체크 선택 + 일괄 구매·견적 버튼, 빈 상태, mock 데이터, URL 파라미터 해석·필터 순수 함수와 테스트.
- 제외 (다음 작업): 백엔드 검색 API와 연결, 로딩·오류 상태(mock은 동기라 발생하지 않음 — API 연결 PR에서 추가), 상세 화면(`/listings/{userId}/{regDate}`, 지금은 링크만이라 404), 페이지네이션(mock 15건이라 전체 표시 — API 연결 시 커서 "더 보기"), 정렬, 실제 구매·견적 흐름, 데이터시트·사진 파일 열기(파일 저장소 미정).

## 결정

- **URL이 상태의 원본.** 뒤로가기·새로고침·공유 시 조건 유지. 홈에서 넘어온 `q`·`category`가 결과 화면에 미리 채워진다.
- **거래상태는 `tradeStatus: "available" | "completed"`로 받는다.** 백엔드는 `listings.dt_expire`(레거시 "거래완료일시")가 비면 `available`, 있으면 `completed`로 내려줄 예정. 거래 흐름(미정)이 정해져 중간 상태가 필요해지면 상태 컬럼 추가를 검토 — 프론트는 이 값만 보므로 저장 방식이 바뀌어도 영향 없음. `decisions.md`에 기록.
- **검색 구분:** 검색창 왼쪽 select = 상품명 / 제조사. '상품명'은 상품명과 상품번호(`prodNo`) 둘 다 부분 일치. 카테고리는 필터 바에서 고른다. 대소문자 무시, 앞뒤 공백 제거.
- **필터는 '적용'을 눌러야 URL에 반영.** 입력 중엔 반영하지 않는다. '초기화'는 `q`·`field`만 남기고 필터 파라미터를 지운다.
- **구매·견적:** 행 체크박스 + 헤더 전체 선택. 1개 이상 선택 시 [견적 요청][구매] 활성. 누르면 목록 위 안내 한 줄 "준비 중" (홈 파일 안내와 같은 모양, 닫기 ×).

## URL 파라미터

| 이름 | 값 | 기본 | 잘못된 값 |
|---|---|---|---|
| `q` | 문자열 | 빈 값(전체) | — |
| `field` | `name` \| `brand` | `name` | 기본값 |
| `category` | 카테고리 문자열 | 빈 값(전체) | — |
| `status` | `available` \| `completed` \| `all` | `available` | 기본값 |
| `minStock` | 0 ~ 100,000 정수 | 없음 | 무시 |
| `minPrice`, `maxPrice` | 0 ~ 1,000,000,000 정수 | 없음 | 무시 |
| `deliveryBy` | `YYYY-MM-DD` | 없음 | 무시 |

URL을 손으로 고친 잘못된 값은 오류를 띄우지 않고 무시(기본값)한다. 입력 폼에서 들어오는 값은 아래 검증을 거친다.

## 필터 의미

- 재고: `stockQuantity >= minStock`
- 가격: `minPrice <= salesUnitPrice <= maxPrice` (한쪽만 있으면 한쪽만)
- 납품일: `deliveryDate <= deliveryBy` (그날까지 납품 가능). `deliveryDate`가 없는 매물은 납품일 필터를 걸면 제외
- 거래상태: `all`이면 거르지 않음
- 카테고리: 정확히 일치

## 필터 입력 검증 (zod, `lib/validation/searchFilter.ts`)

수치는 `docs/security.md` "입력 검증"과 같다.

- 재고: 0 ~ 100,000 정수
- 가격: 0 ~ 10억 정수, 최소 ≤ 최대 (어기면 최대 가격 필드에 오류)
- 납품일: 유효한 날짜
- 빈 칸은 허용 (조건 없음)
- 오류는 필드 아래 빨간 문구 + 테두리 `down`, 오류가 있으면 '적용' 비활성. 문구는 `messages/search.ts`.

## 데이터

`types/listing.ts`에 추가 (백엔드 검색 API를 만들 때 DTO를 이와 1:1로 맞춘다):

```ts
export type TradeStatus = "available" | "completed";

export interface ListingSearchItem {
  userId: string;
  regDate: string;         // yyyyMMddHHmmss, userId와 함께 매물 식별자
  prodNo: string | null;   // 상품번호(제조사 번호)
  prodName: string;
  prodBrand: string;
  category: string;
  description: string | null; // 부품상세내역
  hasDataSheet: boolean;
  hasPhoto: boolean;
  prodState: string;       // 상품상태 자유 텍스트 (예: 양호, 신품대비 90%)
  stockQuantity: number;
  salesUnitPrice: number;
  deliveryDate: string | null; // YYYY-MM-DD
  tradeStatus: TradeStatus;
}
```

mock 15건 정도를 `lib/mock/search.ts`에 둔다 (부품·서버·GPU·네트워크 등 섞고, 거래완료·납품일 없음·사진 없음 포함). 카테고리 목록은 `lib/mock/home.ts`의 `categories`를 재사용.

## 화면

### 데스크톱 (컨테이너 ≥ 768, `@md:`)

본문 최대 폭 1200, 옆 여백 24, 페이지 스크롤 허용 (홈 "스크롤 없음" 원칙은 홈 한정).

1. **검색창** 높이 48. 홈 검색창과 같은 모양(2px `primary`, radius 8). 왼쪽 select(상품명/제조사, `primary-soft`) · 돋보기 · 입력(값 미리 채움) · 검색 버튼. 인기 검색 줄 없음. 제출 시 `q`·`field`만 바꾸고 필터는 유지.
2. **필터 바** 흰 배경, 1px `line`, radius 6, 안쪽 12. 한 줄(좁으면 줄바꿈): 카테고리 select · 거래상태 3칸 토글(거래 가능 / 거래 완료 / 전체) · 재고 [ ]개 이상 · 가격 [ ]~[ ]원 · 납품일 [date]까지 · [초기화](텍스트) [적용](`primary` 34).
3. **결과 머리줄** "검색결과 N건" (선택 시 " · M개 선택") · 오른쪽 [견적 요청](outline `primary`) [구매](`primary` 채움). 선택 0개면 비활성(40% 투명). 아래 안내 한 줄 자리.
4. **결과 표** 흰 카드(1px `line`, radius 6). `<table>`. 열: 체크 · 상품번호(mono) · 상품명 · 제조사 · 부품상세(1줄 말줄임) · 데이터시트 · 사진 · 상태 · 수량(mono, 오른쪽) · 단가(mono, 오른쪽, `formatPrice`). 머리 행 12/500 `ink-2`, 본문 13, 행 높이 44, 구분선 `line-2`, 호버 배경 `bg`. 데이터시트·사진은 있으면 선 아이콘(`ink-2`), 없으면 `–`(`ink-3`). 거래완료 행은 글자 `ink-3` + 상태 칸에 '거래완료' 뱃지(`line-2`/`ink-2`).

### 모바일 (< 768)

옆 여백 16. 검색창 44 (검색 구분 select는 모바일에서도 보임, 폭 72) → [필터] 버튼(적용 중 개수 표시) 누르면 필터가 세로로 펼쳐짐 → 결과 머리줄("검색결과 N건", 전체 선택) → 행 카드 목록(구분선 `line-2`): 체크 · 1줄 상품명 14/500 · 2줄 제조사 · 상품번호(mono) · 3줄 상태 · 수량 · 단가(mono) · 데이터시트·사진 아이콘. 1개 이상 선택하면 하단 탭바 위에 [견적 요청][구매] 고정 바. 하단 탭바 표시(활성 탭 없음).

### 행 동작

행(체크박스 제외 영역) 클릭 → `/listings/{userId}/{regDate}`. 상품명은 실제 `<Link>`(키보드·스크린리더 접근), 행 나머지는 같은 곳으로 이동하는 클릭 처리. 체크박스는 이동하지 않음.

### 빈 상태

"조건에 맞는 매물이 없어요" + [필터 초기화] 링크 (필터가 없으면 링크 대신 "다른 검색어로 찾아보세요").

## 구성

- `app/search/page.tsx` — 서버 컴포넌트. `searchParams` → `parseSearchParams` → `filterListings(mock)` → 조립.
- `components/search/SearchForm.tsx` — GET 폼, `q`·`field` + 현재 필터를 hidden으로 유지.
- `components/search/FilterBar.tsx` — client. react-hook-form + zod, '적용' 시 `router.push`. 모바일 펼침.
- `components/search/ResultList.tsx` — client. 선택 상태, 결과 머리줄·안내, 데스크톱 표 + 모바일 카드, 모바일 고정 바.
- `lib/search.ts` — `parseSearchParams`, `filterListings`, `buildSearchHref`(필터 → URL). 순수 함수.
- `lib/validation/searchFilter.ts`, `lib/mock/search.ts`, `messages/search.ts`.

## 테스트

Vitest: `lib/search.test.ts`(파라미터 해석 기본값·잘못된 값 무시, 각 필터 조건, 검색 구분, 대소문자·공백, URL 생성 왕복), `lib/validation/searchFilter.test.ts`(범위 경계, 최소>최대, 빈 칸). 화면은 `pnpm dev`로 390px·1280px 수동 확인.

## 문서 갱신

`design.md`에 검색 결과 화면 규격, `decisions.md`에 거래상태 판단 항목과 색인 갱신.
