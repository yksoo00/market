# 상품등록 직접 입력 화면 설계 (프론트 + 백엔드 검증 보강)

> 2026-10-02. 브레인스토밍에서 사용자와 합의한 내용. 파일 업로드(PR #26) 머지 후 작업. 카테고리 마스터는 코드 체계가 미정이라 이번에 빼고 임시 텍스트 칸으로 둔다.

## 목적

홈 "판매상품 등록 → 직접 입력"(`/listings/new`)에서 판매자가 매물 하나를 사진·데이터시트와 함께 등록한다. 백엔드 등록 API(`POST /api/v1/listings`)와 업로드 API(`POST /api/v1/uploads`)는 이미 있다.

## 범위

- 포함: `/listings/new` 화면, 로그인 확인, 폼(구역 3개), 사진·데이터시트 즉시 업로드, 프론트 검증(zod), 폼 값 → 요청 변환, 백엔드 검증 보강(상품상태·제조일·납기일), 문서·테스트.
- 제외 (다음 작업):
  - 카테고리 3단 선택 — 코드 체계 미정(아래 "카테고리"). 그동안 임시 텍스트 칸.
  - 매물 수정 화면 — 폼은 재사용할 수 있게 만들되 화면은 만들지 않는다.
  - 상품 데이터시트(`productDataSheet`) — 상품마스터 작업 때 결정 (사용자 지시).
  - 보증기한·불량지원·테스트리포트·정품인증서·대체품 — 기존 설계대로 등록 후 추가등록(PATCH) 화면 몫.
  - 사진 순서 바꾸기, EXIF 제거(security.md 2단계).

## 결정

- **카테고리는 임시 텍스트 칸.** 백엔드가 `categoryCode`를 필수로 받아 칸 없이는 등록이 안 된다. 카테고리 마스터(대·중·소)는 사용자가 정의·데이터를 줬지만 소분류 코드가 대분류마다 다시 시작해 단독 PK로는 겹친다. 코드 체계(① 경로 코드 + 이동 대신 새 코드·`IS_DISPLAY=N` / ② 소분류 코드 전체 고유·불변 / ③ 별도 ID)를 사용자가 정할 때까지 미룬다 — `decisions.md` "미정"에 기록. 마스터가 생기면 이 칸만 3단 선택으로 바꾼다. 그동안 개발 DB 카테고리 값은 정리 대상.
- **거래종류는 화면에 없고 항상 `"판매"`.** 이 폼은 판매 등록 전용. 값 목록이 정해지면 바꾼다 (사용자: "일단 A, 나중에 수정").
- **상품상태는 신품/중고 + %.** 저장 값은 `신품` 또는 `신품대비 N%`(N = 1~99 정수). 레거시 형식("신품대비 00%")과 맞고 값이 일정해 나중에 필터를 붙이기 쉽다. 백엔드도 같은 형식만 받는다.
- **날짜 형식**: 제조일 `yyyyMMdd`(8자리, `prod_mufc_date`), 납기일 `YYYY-MM-DD`(`delivery_date`). 매물 상세 설계(`2026-10-02-listing-detail-design.md`)가 이 형식을 읽는다.
- **날짜 범위 (새 규칙)**: 제조일은 오늘 이전(오늘 포함), 납기일은 오늘 이후(오늘 포함). "오늘"은 한국 시간(Asia/Seoul) 기준 — 서버 `Clock`은 UTC라 한국 오전 9시 전에 하루 어긋나지 않게.
- **로그인 필수.** 비로그인이면 `/login?next=/listings/new`. 실제 권한은 서버 401.
- **성공하면 상세 화면 `/listings/{userId}/{regDate}`로 이동.** 상세 화면은 다른 작업(`feat/listing-detail`)이라 그 PR 머지 전엔 404.

## 화면

`design.md` "폼 페이지" 규격을 따르고 칸이 많아 최대 폭 720. 구역은 카드 대신 구분선 + 제목(15/700). 칸 폭 기준(`@container`): `@md` 이상이면 짧은 칸 2열, 미만(모바일·좁은 타일 칸)이면 1열. 타일 화면 표에는 이미 `sellNew`(sell 그룹)로 있다.

| 구역 | 칸 (* 필수) |
|---|---|
| 상품 정보 | 카테고리(임시)* · 상품명* · 제조사* · 상품번호(모델명) · 제조일 · 사양 요약(`prodSpecInfo`) |
| 판매 조건 | 상품상태* · 단가(원)* · 판매수량* · 재고수량 · 최소주문량 · 주문단위 · 납기일 |
| 설명·파일 | 상품 설명 · 사진(최대 4장) · 데이터시트(PDF 1개) |

- 상품상태: [신품] [중고] 토글(선택 칸 `primary-soft`/`primary-dark`, 검색 필터 토글과 같은 모양). 중고면 옆에 "신품대비 [__] %" 숫자 칸.
- 재고수량은 비우면 판매수량과 같게(백엔드 기본값). 최소주문량·주문단위는 비우면 1. placeholder로 기본값을 보여준다.
- 숫자 칸(단가·수량)은 mono `tabular-nums`. 단가는 입력 중 천 단위 쉼표 없이 숫자만, 아래 보조 문구로 `formatPrice()` 결과를 보여준다.
- 사진: 정사각 칸 4개(데스크톱 한 줄, 좁으면 2열). 빈 칸은 점선 테두리 + "사진 추가". 채워진 칸은 미리보기 + 오른쪽 위 ×, 첫 칸에 "대표" 뱃지(뱃지 규격). 업로드 중이면 칸 위에 스피너.
- 데이터시트: [PDF 선택] 버튼(outline `primary`) → 올리면 파일 이름 + ×.
- 맨 아래 [등록] 44 `primary` 전체 폭. 필수 칸이 비었거나, 오류가 있거나, 업로드 중이거나, 제출 중이면 비활성. 제출 중 스피너.
- 폼 위 안내 줄(오류 `down`): 네트워크·5xx, 429, 필드에 못 붙인 서버 오류.

## 파일 업로드 흐름

1. 파일 선택 즉시 `checkUpload`(기존 `lib/validation/upload.ts`: 사진 jpg·png·webp 5MB, PDF 10MB) → 실패면 그 칸 아래 문구, 업로드 안 함.
2. 통과하면 바로 `POST /api/v1/uploads` (`kind`: 사진 `listing-photo`, 데이터시트 `listing-datasheet`). 받은 키를 폼 값에 넣는다.
3. 미리보기는 `URL.createObjectURL(file)`(업로드 완료 전에도 보임). 칸이 사라지면 `revokeObjectURL`.
4. 사진은 여러 장 한 번에 선택 가능. 남은 칸보다 많으면 앞에서부터 채우고 "사진은 최대 4장까지 올릴 수 있어요" 안내.
5. × 는 폼 값에서만 뺀다. 서버 파일은 고아로 남는다(파일 업로드 설계에서 감수).
6. 실패 문구: 400 `UPLOAD_INVALID_TYPE`, 413 `UPLOAD_TOO_LARGE`, 429 `UPLOAD_QUOTA_EXCEEDED`·`RATE_LIMITED`, 401(로그인 만료 → 로그인 안내), 그 외·네트워크 → 서버 오류 + 다시 시도. 문구는 `messages/upload.ts` `errors`.
7. 업로드 중엔 [등록] 비활성.
8. 키는 24시간 유효. 지나서 제출하면 서버가 `fields.photos`(또는 `listingDataSheet`) "파일을 다시 올려 주세요." → 그 칸에 표시.

## 검증

`lib/validation/listing.ts` (zod). 수치는 `security.md` "입력 검증 > 매물"이 원본이고 백엔드와 같다.

| 칸 | 규칙 |
|---|---|
| 카테고리(임시) | 앞뒤 공백 제거 후 1~10자 |
| 상품명·제조사 | 앞뒤 공백 제거 후 1~50자 |
| 상품번호 | 20자 이하 |
| 사양 요약 | 100자 이하 |
| 설명 | 200자 이하 |
| 단가 | 0 ~ 1,000,000,000 정수 |
| 판매수량 | 1 ~ 100,000 정수 |
| 재고수량 | 비움 또는 0 ~ 100,000 정수 |
| 최소주문량 | 비움 또는 1 ~ 100,000 정수, 판매수량 이하 |
| 주문단위 | 비움 또는 1 ~ 100,000 정수 |
| 상품상태 | 신품, 또는 중고 + 1~99 정수 % |
| 제조일 | 비움 또는 날짜, 오늘 이전 (새 규칙) |
| 납기일 | 비움 또는 날짜, 오늘 이후 (새 규칙) |
| 사진 | 최대 4장 |

반응은 `.claude/rules/frontend.md` "검증 반응" 그대로: blur 검사, 칸 아래 빨간 문구 + 테두리, 고쳐지면 즉시 사라짐, 제출 버튼 비활성, 서버 필드 오류는 `applyServerError`로 해당 칸에(서버 필드명 = 요청 필드명: `photos` → 사진 칸, `listingDataSheet` → 데이터시트 칸, `prodState`·`prodMufcDate`·`deliveryDate` 등), 못 붙이면 폼 위. 네트워크·5xx는 폼 위 안내 + 입력값 유지. 등록 rate limit(10회/시간) 429는 폼 위.

## 요청 변환

`lib/listingForm.ts`의 순수 함수 `toCreateRequest(values)`:
- 문자열은 앞뒤 공백 제거, 빈 선택 칸은 보내지 않음(undefined).
- `tradeType: "판매"`.
- 상품상태: 신품 → `"신품"`, 중고 N → `"신품대비 N%"`.
- 제조일 `YYYY-MM-DD`(date input 값) → `yyyyMMdd`. 납기일은 그대로.
- 숫자는 number로, 빈 재고·최소주문량·주문단위는 생략(백엔드 기본값).
- `photos`: 업로드 완료된 키 배열(순서 = 칸 순서), 없으면 생략. `listingDataSheet`: 키 또는 생략.

## 백엔드 (같은 PR — 두 층 같은 규칙)

- `ListingCreateRequest`·`ListingUpdateRequest`:
  - `prodState`: `@Pattern("^(신품|신품대비 [1-9][0-9]?%)$")` (수정은 null 허용 그대로).
  - `prodMufcDate`: `@Pattern("^\\d{8}$")` + 실제 날짜(예: 20261340 거부).
  - `deliveryDate`: `@Pattern("^\\d{4}-\\d{2}-\\d{2}$")` + 실제 날짜.
- `ListingService`: 제조일 > 오늘 → `fields.prodMufcDate`, 납기일 < 오늘 → `fields.deliveryDate` (400 VALIDATION). 오늘 = `LocalDate.now(clock.withZone(Asia/Seoul))`. 수정(PATCH)은 보낸 칸만 검사.
- 기존 개발 데이터(`prodState: "new"` 등)는 조회에 영향 없음 — 검사는 쓰기 요청에만.
- 기존 테스트·Bruno의 `"prodState":"new"`, `"tradeType":"등록"` 예시는 새 형식(`"신품"`, `"판매"`)으로 고친다.

## 프론트 구성

| 파일 | 역할 |
|---|---|
| `app/listings/new/page.tsx` | 얇은 페이지: `RequireLogin` + `ListingForm` |
| `components/auth/RequireLogin.tsx` | `authApi.me()` 실패 시 `/login?next=<현재 경로>`로 `router.replace`. 확인 전엔 아무것도 안 그림 (`RedirectIfAuthenticated`의 반대) |
| `components/listing/ListingForm.tsx` | 폼 본체. props: `initialValues`, `onSubmit(values) → Promise<ApiResult>` — 수정 화면 재사용 대비. 등록 페이지가 `createListing`을 넘긴다 |
| `components/listing/ProdStateField.tsx` | 신품/중고 토글 + % |
| `components/listing/PhotoUploader.tsx` | 사진 칸 4개, 업로드·미리보기·삭제 |
| `components/listing/DatasheetUploader.tsx` | PDF 1개 |
| `lib/validation/listing.ts` | zod 스키마 + 테스트 |
| `lib/listingForm.ts` | `toCreateRequest`, 빈 폼 기본값 + 테스트 |
| `lib/api/listings.ts` | `createListing(req)` |
| `lib/api/uploads.ts` | `uploadFile(kind, file)` — 기존 `client.ts` `upload()` 사용 |
| `types/listing.ts` | `ListingCreateRequest`, `ListingResponse` (백엔드 DTO 1:1) |
| `messages/listing.ts` | 라벨·안내·오류 문구 |

입력 칸은 기존 `components/auth/FormField`(`FieldShell`, `useFieldStatus`)를 재사용한다. 위치가 `auth/`라 어색하면 `components/common/form/`으로 옮기는 건 이번 범위 밖(언급만).

**겹침 주의**: `types/listing.ts`, `lib/api/listings.ts`, `messages/listing.ts`는 매물 상세 작업(`feat/listing-detail`)도 고친다. 나중에 머지하는 쪽이 합친다.

## 테스트

- Vitest:
  - `listing.ts` 스키마: 각 칸 경계값(0/1/100,000/100,001, 10억/10억+1), 최소주문량 > 판매수량, 상태(신품·중고 1·99·0·100·빈 값), 제조일 내일 거부·오늘 통과, 납기일 어제 거부·오늘 통과, 사진 5장 거부.
  - `listingForm.ts`: 상태 문자열, 제조일 변환, 빈 선택 칸 생략, 공백 제거, `tradeType`.
- 백엔드 `ListingApiTest`: 상품상태 형식(통과 2·거부 3), 제조일 형식·미래 거부·오늘 통과, 납기일 형식·과거 거부·오늘 통과, 없는 날짜(20261340) 거부, PATCH도 같은 규칙. 시간대 경계(UTC 15:00 직후 = 한국 다음 날)는 고정 `Clock`으로 서비스 단위 테스트.
- 수동(`pnpm dev` + `bootRun`): 사진 3장·PDF 포함 등록 → 상세 이동(머지 전이면 404 확인), 업로드 실패 문구, 키 만료(Redis 기록 삭제로 재현), 비로그인 진입, 모바일 폭·좁은 타일 칸.

## 문서

- `security.md` "입력 검증 > 매물": 상품상태 형식, 제조일·납기일 형식과 범위.
- `design.md`: "매물 등록 폼" 규격(폭 720, 구역, 사진 칸, 상태 토글).
- `decisions.md`: 거래종류 "판매" 고정(임시)·상품상태 형식·날짜 범위 항목, "미정"에 카테고리 코드 체계, 색인 갱신.
- `bruno/listings/create.bru` 예시 값.

## 브랜치

`feat/listing-create` 하나, PR 하나. 백엔드 검증 커밋 → 프론트 커밋들 → 문서. 스키마 변경 없음, 의존성 추가 없음. 머지 전 `./gradlew check`, `pnpm typecheck && pnpm lint && pnpm test`, `/code-review`, 입력 검증 변경이라 `/security-review`.
