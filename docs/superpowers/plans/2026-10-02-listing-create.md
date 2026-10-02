# 상품등록 직접 입력 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/listings/new`에서 판매자가 매물 하나를 사진·데이터시트와 함께 등록한다. 백엔드는 상품상태·제조일·납기일 검증을 프론트와 같은 규칙으로 보강한다.

**Architecture:** 백엔드는 DTO `@Pattern` + `ListingService` 날짜 범위 검사(한국 날짜)만 추가한다. 프론트는 순수 로직(`lib/validation/listing.ts`, `lib/listingForm.ts`)을 먼저 만들고 Vitest로 고정한 뒤, react-hook-form 폼(`components/listing/*`)과 페이지를 얹는다. 파일은 고르는 즉시 기존 `POST /api/v1/uploads`로 올리고 키를 폼 값에 넣는다.

**Tech Stack:** Spring Boot 4.1 (Bean Validation), Next.js 16 / React 19, react-hook-form 7 + zod 4 + `@hookform/resolvers`, Vitest, Tailwind. 의존성 추가 없음.

**Spec:** `docs/superpowers/specs/2026-10-02-listing-create-design.md`

## Global Constraints

- 브랜치 `feat/listing-create` (main에서 새로). 스키마 변경 없음. 의존성 추가 없음.
- 수치(security.md "매물"): 카테고리 1~10자(임시), 상품명·제조사 1~50자, 상품번호 ≤20, 사양 ≤100, 설명 ≤200, 단가 0~1,000,000,000, 판매수량 1~100,000, 재고 0~100,000, 최소주문량 1~100,000 & ≤ 판매수량, 주문단위 1~100,000, 사진 ≤4.
- 상품상태 저장 값: 정확히 `신품` 또는 `신품대비 N%` (N = 1~99 정수, 앞자리 0 없음). 정규식 `^(신품|신품대비 [1-9][0-9]?%)$`.
- 제조일: 요청 `prodMufcDate` = `yyyyMMdd`(8자리), 실제 날짜, 오늘 이전(오늘 포함). 납기일: 요청 `deliveryDate` = `YYYY-MM-DD`, 실제 날짜, 오늘 이후(오늘 포함). "오늘" = Asia/Seoul 날짜 (프론트·백엔드 모두).
- `tradeType`은 항상 `"판매"` (화면에 없음).
- 사진 업로드 `kind` = `listing-photo`, 데이터시트 = `listing-datasheet`. 응답 `data.key`.
- 사용자 문구는 `frontend/src/messages/`에만. 코드 주석·커밋·문서 한국어. 커밋 끝 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 프론트 검증은 항상 `pnpm typecheck && pnpm lint && pnpm test` 셋 다 (lessons.md 2026-09-29).
- 한글 파일은 필요한 줄만 국소 수정.
- `types/listing.ts`, `lib/api/listings.ts`, `messages/listing.ts`는 `feat/listing-detail`도 고친다 — 기존 내용을 지우지 말고 추가만.

## Review Focus

- 한국 시간 오전(UTC 전날)에 오늘 날짜를 납기일·제조일로 넣으면 통과해야 한다 → Task 1 서비스 단위 테스트(고정 Clock `2026-10-01T23:30:00Z`), Task 2 `todayInSeoul` 테스트.
- 숫자 칸에 `1,000`, ` 5`, `1e3`, `05`가 아닌 `-1`, `1.5` → 칸 오류(통과 금지) → Task 2 스키마 테스트.
- 없는 날짜(`2026-02-30`, `20261340`) → 프론트·백엔드 모두 거부 → Task 1·2 테스트.
- 업로드 중 [등록] 클릭 불가, 서버가 `fields.photos`를 돌려주면 사진 칸에 표시 → Task 4 수동 확인 단계.
- 좁은 칸(모바일 390, 타일 1/4 칸)에서 가로 스크롤 없이 1열 → Task 3·4 수동 확인 단계.

---

### Task 1: 백엔드 검증 보강

**Files:**
- Modify: `backend/src/main/java/com/company/market/listing/dto/ListingCreateRequest.java`, `ListingUpdateRequest.java`
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java`
- Test: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java`, `backend/src/test/java/com/company/market/listing/service/ListingServiceTest.java`
- Modify: `bruno/listings/create.bru`, `bruno/listings/update.bru`(prodState·tradeType 예시가 있으면)

**Interfaces:**
- Produces: 400 `VALIDATION` 필드 `prodState`·`prodMufcDate`·`deliveryDate` (Task 3 폼이 그 칸에 표시)

- [ ] **Step 1: 브랜치** — `git checkout -b feat/listing-create main`

- [ ] **Step 2: 기존 예시 값 교체** — `ListingApiTest`의 `"prodState":"new"` → `"prodState":"신품"`, `"tradeType":"등록"` → `"tradeType":"판매"` (15곳). `bruno/listings/create.bru`도 같게. `ListingRepositoryTest`는 엔티티 직접 저장이라 그대로.

- [ ] **Step 3: 실패하는 테스트 작성** (`ListingApiTest`, 기존 `createWithPhoto` 같은 헬퍼 스타일로 JSON 본문 조립)
- `@DisplayName("상품상태는 '신품' 또는 '신품대비 1~99%'만 받는다")` — `신품`, `신품대비 1%`, `신품대비 99%` → 201(사용자 겹침 방지로 매 요청 다른 상품명 + `otherUserCookie()` 등 기존 409 회피 방식 사용); `new`, `신품대비 0%`, `신품대비 100%`, `신품대비 05%` → 400 `fields.prodState`
- `@DisplayName("제조일은 yyyyMMdd 실제 날짜만, 미래면 400")` — `20200101` → 201; `2020-01-01`, `20261340` → 400 `fields.prodMufcDate`; 내일(`LocalDate.now(Asia/Seoul).plusDays(1)` 포맷) → 400 `fields.prodMufcDate`
- `@DisplayName("납기일은 YYYY-MM-DD 실제 날짜만, 과거면 400")` — 오늘(한국) → 201; `20261002`, `2026-02-30` → 400 `fields.deliveryDate`; 어제 → 400 `fields.deliveryDate`
- `@DisplayName("수정(PATCH)도 같은 상품상태·날짜 규칙을 적용한다")` — `{"prodState":"new"}` → 400 `fields.prodState`; `{"deliveryDate":"<어제>"}` → 400 `fields.deliveryDate`; `{"salesUnitPrice":1}` → 200 (보내지 않은 칸은 검사 안 함)

`ListingServiceTest`:
- `@DisplayName("한국 날짜 기준: UTC 23:30(한국 다음 날 08:30)에 한국 오늘을 납기일·제조일로 넣으면 통과")` — `Clock.fixed(Instant.parse("2026-10-01T23:30:00Z"), UTC)`, 요청 `deliveryDate "2026-10-02"`, `prodMufcDate "20261002"` → 예외 없음(저장 mock); `deliveryDate "2026-10-01"` → `ValidationException` 의 `fields`에 `deliveryDate`

- [ ] **Step 4: 실패 확인** — `cd backend && ./gradlew test --tests '*ListingApiTest' --tests '*ListingServiceTest'` → 새 테스트 FAIL

- [ ] **Step 5: 구현**
- DTO: `prodState`에 `@Pattern(regexp = "^(신품|신품대비 [1-9][0-9]?%)$", message = "상품상태는 '신품' 또는 '신품대비 N%'(N은 1~99) 형식이어야 합니다.")` (Create는 `@NotBlank` 유지, Update는 null 허용 그대로이므로 기존 공백 `@Pattern` 대신 이것으로 교체). `prodMufcDate`에 `@Pattern(regexp = "^\\d{8}$", message = "제조일은 yyyyMMdd 형식이어야 합니다.")`(Create만 — Update에는 필드 없음), `deliveryDate`에 `@Pattern(regexp = "^\\d{4}-\\d{2}-\\d{2}$", message = "납기일은 YYYY-MM-DD 형식이어야 합니다.")`(둘 다).
- `ListingService`: `private void validateDates(String prodMufcDate, String deliveryDate)` — null은 건너뜀. `LocalDate.parse(…, DateTimeFormatter.ofPattern("uuuuMMdd").withResolverStyle(STRICT))` / `ISO_LOCAL_DATE` STRICT 실패 → 해당 필드 "날짜가 올바르지 않습니다."; 오늘 = `LocalDate.now(clock.withZone(ZoneId.of("Asia/Seoul")))`; 제조일 > 오늘 → `prodMufcDate` "제조일은 오늘 이전 날짜로 입력하세요."; 납기일 < 오늘 → `deliveryDate` "납기일은 오늘 이후 날짜로 입력하세요.". 실패를 모아 `ValidationException`. `create`는 업로드 키 확인 전에, `update`는 권한 확인 뒤에 호출(update는 `prodMufcDate` 없음 → null).

- [ ] **Step 6: 통과 확인** — 같은 명령 → PASS. 이어서 `./gradlew test --tests '*Listing*'` → PASS

- [ ] **Step 7: 커밋** — `feat(backend): 매물 상품상태·제조일·납기일 검증 (프론트와 같은 규칙)` (본문: 두 층 같은 규칙, 한국 날짜 기준 이유, 예시 값 교체)

---

### Task 2: 프론트 순수 로직 — 스키마·요청 변환·API·문구

**Files:**
- Create: `frontend/src/lib/validation/listing.ts`, `frontend/src/lib/validation/listing.test.ts`
- Create: `frontend/src/lib/listingForm.ts`, `frontend/src/lib/listingForm.test.ts`
- Create: `frontend/src/lib/api/listings.ts` (없으면), `frontend/src/lib/api/uploads.ts`
- Modify: `frontend/src/types/listing.ts` (추가만), `frontend/src/messages/listing.ts` (추가만)

**Interfaces:**
- Consumes: `isValidDate(s)` from `lib/search.ts`, `upload<T>(path, form)`·`post<T>(path, body)` from `lib/api/client.ts`
- Produces:
  - `types/listing.ts`: `interface ListingCreateRequest` (백엔드 DTO 필드 그대로, 선택 필드는 `?`), `interface ListingCreated { userId: string; regDate: string }` (응답에서 이동에 쓰는 두 필드만), `type UploadKind = "listing-photo" | "listing-datasheet"`
  - `lib/validation/listing.ts`:
    - `type ListingFormInput = { categoryCode: string; prodName: string; prodBrand: string; prodNo: string; prodMufcDate: string; prodSpecInfo: string; condition: "new" | "used"; usedPercent: string; salesUnitPrice: string; salesQuantity: string; stockQuantity: string; minOrderQuantity: string; orderUnit: string; deliveryDate: string; description: string; photos: string[]; listingDataSheet: string }` (날짜는 date input 값 `YYYY-MM-DD` 또는 `""`)
    - `listingFormSchema(today: string)` — zod 스키마 팩토리, 출력 타입 `ListingFormOutput` (숫자 칸은 `number | undefined`, 문자열은 trim, 빈 선택 칸은 `undefined`)
    - `emptyListingForm: ListingFormInput` (condition `"new"`, photos `[]`, 나머지 `""`)
  - `lib/listingForm.ts`: `todayInSeoul(now?: Date): string` (`YYYY-MM-DD`), `toCreateRequest(v: ListingFormOutput): ListingCreateRequest`
  - `lib/api/listings.ts`: `createListing(req: ListingCreateRequest): Promise<ApiResult<ListingCreated>>`
  - `lib/api/uploads.ts`: `uploadFile(kind: UploadKind, file: File): Promise<ApiResult<{ key: string }>>`
  - `messages/listing.ts`: `listing.form` (라벨·placeholder·구역 제목·버튼·안내), `listing.validation` (칸별 오류 문구), `listing.errors`에 `RATE_LIMITED` 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`listing.test.ts` (`searchFilter.test.ts`의 `parse`/`errors` 헬퍼 스타일, `const schema = listingFormSchema("2026-10-02")`, 유효 기본값 = `emptyListingForm` + 카테고리·상품명·제조사·단가 `1000`·판매수량 `1`):
- `"필수 칸이 비면 그 칸에 오류"` — categoryCode·prodName·prodBrand·salesUnitPrice·salesQuantity 각각 `""` → 해당 경로 오류
- `"문자열은 앞뒤 공백을 지우고 길이를 센다"` — prodName `"  a  "` → 출력 `"a"`; prodName 51자 → 오류; categoryCode 11자 → 오류; prodNo 21자·prodSpecInfo 101자·description 201자 → 오류
- `"단가 0~10억, 수량 1~100,000 정수"` — 단가 `"0"`·`"1000000000"` 통과, `"1000000001"`·`"1,000"`·`"-1"`·`"1.5"`·`"1e3"`·`" 5"` 오류; 판매수량 `"0"`·`"100001"` 오류
- `"재고·최소주문량·주문단위는 비우면 undefined, 범위 밖이면 오류"` — 빈 값 → `undefined`; 재고 `"0"` 통과; 최소주문량 `"0"` 오류; 주문단위 `"100001"` 오류
- `"최소주문량이 판매수량보다 크면 최소주문량 칸에 오류"` — 판매수량 `"5"`, 최소주문량 `"6"` → `minOrderQuantity` 오류; `"5"` 통과
- `"중고면 % 1~99 정수 필수, 신품이면 % 무시"` — used + `""`·`"0"`·`"100"`·`"05"` → `usedPercent` 오류; used + `"1"`·`"99"` 통과; new + `"abc"` 통과
- `"제조일은 오늘까지, 납기일은 오늘부터, 없는 날짜 거부"` — prodMufcDate `"2026-10-02"` 통과·`"2026-10-03"` 오류; deliveryDate `"2026-10-02"` 통과·`"2026-10-01"` 오류; `"2026-02-30"` 둘 다 오류
- `"사진은 4장까지"` — 5개 → `photos` 오류

`listingForm.test.ts`:
- `"todayInSeoul은 한국 날짜"` — `todayInSeoul(new Date("2026-10-01T23:30:00Z"))` → `"2026-10-02"`; `new Date("2026-10-02T14:59:00Z")` → `"2026-10-02"`
- `"toCreateRequest: 상태 문자열·날짜·거래종류·빈 칸 생략"` — 스키마 출력(신품, 사진 0장, 선택 칸 비움) → `{ tradeType: "판매", prodState: "신품", ... }`에 `stockQuantity`·`minOrderQuantity`·`orderUnit`·`prodMufcDate`·`deliveryDate`·`photos`·`listingDataSheet`·`prodNo` 키 없음; 중고 85 → `prodState: "신품대비 85%"`; 제조일 `"2020-01-31"` → `prodMufcDate: "20200131"`; 납기일 그대로; photos `["k1","k2"]` 순서 유지

- [ ] **Step 2: 실패 확인** — `cd frontend && pnpm test -- listing` → FAIL (모듈 없음)

- [ ] **Step 3: 구현** — 위 Interfaces 그대로. 숫자 칸 정규식 `^\d+$`(searchFilter의 `optionalInt` 방식). `todayInSeoul`은 `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now)`. 최소주문량 비교와 날짜 범위는 `superRefine`(zod 4는 칸 실패 후에도 refine이 돌므로 숫자일 때만 비교 — searchFilter 주석 참고). 오류 문구는 `messages/listing.ts` `validation`에 "무엇이 왜 틀렸고 어떻게 고치나" 형식으로(예: "단가는 0원 이상 10억 원 이하 숫자로 입력하세요").

- [ ] **Step 4: 통과 확인** — `pnpm test -- listing` → PASS, `pnpm typecheck && pnpm lint` → 통과

- [ ] **Step 5: 커밋** — `feat(frontend): 매물 등록 폼 검증·요청 변환·API 함수`

---

### Task 3: 페이지·로그인 확인·폼(텍스트 칸)

**Files:**
- Create: `frontend/src/app/listings/new/page.tsx`
- Create: `frontend/src/components/auth/RequireLogin.tsx`
- Create: `frontend/src/components/listing/ListingForm.tsx`, `frontend/src/components/listing/ProdStateField.tsx`
- Modify: `frontend/src/components/home/QuickMenu.tsx` (`routes.sellManual` 위 TODO 주석에서 sellManual이 실제 경로가 됐음을 반영 — 주석 한 줄만)

**Interfaces:**
- Consumes: Task 2 전부, `FormField`·`FieldShell`·`useFieldStatus`·`statusClass` (`components/auth/FormField.tsx`), `FormError`·`SubmitButton` (`components/auth/FormStatus.tsx`), `applyServerError` (`lib/form.ts`), `authApi.me()`
- Produces:
  - `RequireLogin({ children }: { children: ReactNode })` — `me()` 실패면 `router.replace("/login?next=" + encodeURIComponent(현재 경로+쿼리))`, 확인 전엔 `null`
  - `ListingForm({ initialValues, submitLabel, onSubmit }: { initialValues: ListingFormInput; submitLabel: string; onSubmit: (v: ListingFormOutput) => Promise<ApiResult<ListingCreated>> })` — 성공 시 `router.push(\`/listings/${userId}/${regDate}\`)`
  - `ListingForm` 안에 사진·데이터시트 자리(`<div data-slot="photos" />` 등) — Task 4가 채운다

- [ ] **Step 1: 구현** — UI 컴포넌트라 Vitest 대상 아님(rules/frontend.md: lib·hook만). 규격:
  - 페이지: `<main className="flex-1 min-h-0 overflow-y-auto px-4 @md:px-6 pt-3 @md:pt-5">` + 제목 20/700 + `RequireLogin` > `ListingForm` (`initialValues={emptyListingForm}`, `onSubmit={(v) => createListing(toCreateRequest(v))}`), 최대 폭 720 가운데, 흰 카드 하나(AuthCard 모양) 안에 구역 3개를 구분선(`border-t border-line-2`) + 제목 15/700으로.
  - `useForm({ resolver: zodResolver(listingFormSchema(todayInSeoul())), mode: "onBlur", reValidateMode: "onChange" })` — `PersonalSignupForm` 패턴.
  - 2열: 구역 안 `grid grid-cols-1 @md:grid-cols-2 gap-4`. 상품명·사양 요약·설명은 2열 전체(`@md:col-span-2`).
  - 설명은 `textarea`(4줄, maxLength 200, 아래 `n/200`).
  - 숫자 칸 `inputMode="numeric"`, `font-mono tabular-nums`. 단가 아래 보조 문구 `formatPrice(Number(값))원` (숫자일 때만).
  - 제조일·납기일 `type="date"`, `max={today}` / `min={today}`.
  - `ProdStateField`: [신품][중고] 2칸 토글(`aria-pressed`, PersonalSignupForm 닉네임 토글 클래스), 중고면 "신품대비 [__] %" 숫자 칸(폭 80) — 오류는 `usedPercent` 칸 아래.
  - 서버 필드 매핑: `applyServerError(fail, setError, knownFields, listing.errors)` — knownFields는 폼 칸 이름 전부. 서버 `prodState` → `usedPercent`가 아니라 상태 칸 자체 오류로(`setError("condition", …)`), 나머지는 이름 같음.
  - 제출 버튼 비활성: `!isValid || isSubmitting || uploading`(uploading은 Task 4가 넘김, 지금은 false).

- [ ] **Step 2: 확인** — `pnpm typecheck && pnpm lint && pnpm test` → 통과

- [ ] **Step 3: 수동 확인** — `docker compose up -d`, 백엔드 `./gradlew bootRun`(8080이 사용 중이면 `--args='--server.port=8081'` + 프론트 `NEXT_PUBLIC_API_URL=http://localhost:8081 pnpm dev`):
  - 비로그인으로 `/listings/new` → `/login?next=%2Flistings%2Fnew`, 로그인 후 돌아옴
  - 필수만 채워 등록 → 상세 경로로 이동(상세 화면 미머지면 404 정상)
  - 단가 `1,000` blur → 칸 오류, 고치면 즉시 사라짐; 최소주문량 > 판매수량 오류
  - 브라우저 폭 390에서 1열·가로 스크롤 없음

- [ ] **Step 4: 커밋** — `feat(frontend): 상품등록 직접 입력 화면 (텍스트 칸·상품상태·로그인 확인)`

---

### Task 4: 사진·데이터시트 업로드

**Files:**
- Create: `frontend/src/components/listing/PhotoUploader.tsx`, `frontend/src/components/listing/DatasheetUploader.tsx`
- Modify: `frontend/src/components/listing/ListingForm.tsx` (자리 채우기, `uploading` 상태)
- Modify: `frontend/src/messages/listing.ts` (사진·데이터시트 문구 추가)

**Interfaces:**
- Consumes: `uploadFile` (Task 2), `checkUpload("image"|"pdf", file)`·`acceptOf` (`lib/validation/upload.ts`), `upload.errors` (`messages/upload.ts`)
- Produces:
  - `PhotoUploader({ value, onChange, onUploadingChange, error }: { value: string[]; onChange: (keys: string[]) => void; onUploadingChange: (uploading: boolean) => void; error?: string })`
  - `DatasheetUploader({ value, onChange, onUploadingChange, error }: { value: string; onChange: (key: string) => void; onUploadingChange: (uploading: boolean) => void; error?: string })`

- [ ] **Step 1: 구현** — 규격:
  - 내부 상태: 칸마다 `{ id, previewUrl, key?: string, status: "uploading" | "done" | "error", message? }`. `value`는 `done`인 칸의 키를 칸 순서대로.
  - 선택: `<input type="file" multiple accept={acceptOf("image")}>`. 남은 칸 수만큼 앞에서 자르고 넘치면 안내("사진은 최대 4장까지 올릴 수 있어요"). 파일마다 `checkUpload` 실패면 업로드하지 않고 칸 아래 문구.
  - 업로드: 파일마다 `uploadFile("listing-photo", file)` 병렬. 결과 실패면 `upload.errors[code] ?? listing.errors[code] ?? fail.message` 문구, 칸 표시 `error`(× 로 제거).
  - 미리보기 `URL.createObjectURL`, 칸 제거·언마운트 시 `revokeObjectURL` (`useEffect` cleanup).
  - 칸 모양: 정사각, 데스크톱 4열 / `@md` 미만 2열. 빈 칸 점선 `border-line` + "사진 추가"(버튼, 접근 가능한 이름). 첫 done 칸 왼쪽 위 "대표" 뱃지(높이 20, `primary-soft`/`primary-dark` 11/600). × 버튼 28 원(타일 닫기 모양), `aria-label`.
  - 이미지 요소: 미리보기는 blob URL이라 `next/image` 대신 `<img alt=…>` + 주석 "blob 미리보기는 next/image 최적화 대상이 아님" (eslint `@next/next/no-img-element`는 해당 줄만 disable).
  - `onUploadingChange(칸 중 uploading 있음)`.
  - 데이터시트: [PDF 선택] outline `primary` 34 → 업로드 중 스피너 → 완료 시 파일 이름 + ×. `kind` `listing-datasheet`.
  - `ListingForm`: `photos`·`listingDataSheet`를 `setValue(…, { shouldValidate: true })`, 서버 `fields.photos`/`fields.listingDataSheet` 오류를 `error` prop으로. 사진 업로드 중이면 [등록] 비활성.

- [ ] **Step 2: 확인** — `pnpm typecheck && pnpm lint && pnpm test` → 통과

- [ ] **Step 3: 수동 확인** (Task 3과 같은 실행 환경):
  - 사진 3장 + PDF로 등록 → 201, DB `prod_photo_1~3`·`prod_data_sheet`에 키
  - 5장 한 번에 선택 → 4장만, 안내 문구
  - `.gif`·6MB 사진 → 업로드 전 오류
  - 업로드 중 [등록] 비활성
  - 키 만료 재현: 사진 업로드 후 `docker compose exec redis redis-cli --scan --pattern 'upload:public/*'`로 키를 찾아 `docker compose exec redis redis-cli del <그 키>` → 등록 → 사진 칸에 "파일을 다시 올려 주세요."
  - 폭 390·타일 1/4 칸에서 사진 2열

- [ ] **Step 4: 커밋** — `feat(frontend): 매물 등록 사진·데이터시트 업로드`

---

### Task 5: 문서·전체 검증·PR

**Files:**
- Modify: `docs/security.md` ("입력 검증 > 매물" 표: 거래종류·상품상태 줄을 `상품상태 ^(신품|신품대비 1~99%)$`, 제조일 `yyyyMMdd`·오늘 이전, 납기일 `YYYY-MM-DD`·오늘 이후(한국 날짜)로)
- Modify: `docs/design.md` ("검색 결과 화면" 뒤에 "**매물 등록 폼**" 규격: 폭 720, 구역 3개, 2열/1열, 상태 토글, 사진 칸, 버튼)
- Modify: `docs/decisions.md` (새 항목 `## 2026-10-02 매물 등록 폼: 거래종류 "판매" 고정(임시), 상품상태 형식, 날짜 범위` — 결정·이유·재검토 조건 5줄 이내; 색인 "기능" 또는 "프론트" 행에 항목명)

- [ ] **Step 1: 문서 수정**

- [ ] **Step 2: 전체 검증** — `cd backend && ./gradlew check` → BUILD SUCCESSFUL; `cd frontend && pnpm typecheck && pnpm lint && pnpm test` → 통과

- [ ] **Step 3: 커밋** — `docs: 매물 등록 폼 반영 (검증 규칙·화면 규격·결정)`

- [ ] **Step 4: 푸시 + PR** — `git push -u origin feat/listing-create`, `gh pr create` (본문: 무엇을·왜·확인 방법·다른 영역 영향 — 백엔드 검증 강화로 옛 값 `new`·`등록` 거부, 상세 화면 미머지 시 등록 후 404, 카테고리 임시 칸). 이어서 `/code-review`, 입력 검증 변경이라 `/security-review` 실행 후 반영·보고. 머지는 사용자가 웹에서.
