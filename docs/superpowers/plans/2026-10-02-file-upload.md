# 파일 업로드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매물 사진·데이터시트·테스트리포트·정품인증서·대체품 파일을 서버 로컬 디스크에 저장하고, 매물 등록·수정 API가 본인이 올린 파일 키만 받게 한다.

**Architecture:** `common/storage` 패키지 하나에 저장소(`FileStorage`/`LocalFileStorage`), 형식·용도 규칙(`FileType`/`UploadKind`), 업로드·소유 확인(`UploadService`), API 두 개(`UploadController`, `FileController`)를 둔다. 업로드 소유 기록은 Redis `upload:<key>`(24시간). `ListingService`는 `UploadService`를 호출해 키를 확인하고, DB 저장 성공 후 기록을 지운다.

**Tech Stack:** Spring Boot 4.1 (webmvc multipart, `java.nio.file`), Redis(`StringRedisTemplate`), JUnit 5 + Testcontainers + MockMvc. 의존성 추가 없음.

**Spec:** `docs/superpowers/specs/2026-10-02-file-upload-design.md`

## Global Constraints

- 브랜치 `feat/file-upload` (main에서 새로 생성). DB 마이그레이션 없음.
- 의존성 추가 금지. Spring 기본 multipart·`java.nio.file`만.
- 용도 표 (spec 그대로):
  - `listing-photo` → `public/listings/photos/`, jpg·png·webp, 5MB, 누구나
  - `listing-datasheet` → `private/listings/datasheets/`, pdf, 10MB, 로그인
  - `listing-test-report` → `private/listings/test-reports/`, pdf·jpg·png, 10MB, 로그인
  - `listing-certificate` → `private/listings/certificates/`, pdf·jpg·png, 10MB, 로그인
  - `listing-replace-prod` → `private/listings/replace-prods/`, pdf·jpg·png, 10MB, 로그인
- 키 형식: `<폴더>/yyyy/MM/<uuid>.<ext>`. ext는 소문자 `jpg|png|webp|pdf` (`jpeg`→`jpg`). 연·월은 주입된 `Clock`(UTC).
- 매직 바이트: jpg `FF D8 FF`, png `89 50 4E 47 0D 0A 1A 0A`, webp `RIFF`(0~3) + `WEBP`(8~11), pdf `%PDF-`. Content-Type 헤더 안 믿음.
- Redis `upload:<key>` = `<userId>|<kind값>`, TTL 24시간.
- rate limit: 업로드 20회/10분/사용자, 키 `upload:rate:<userId>` (기존 `RateLimiter.hit`).
- 오류 코드: `UPLOAD_INVALID_TYPE`(400), `UPLOAD_TOO_LARGE`(413 `HttpStatus.CONTENT_TOO_LARGE`). 키 확인 실패는 400 `VALIDATION`, 필드 문구 정확히 `"파일을 다시 올려 주세요."`.
- 새 오류 코드는 같은 PR에서 프론트 `frontend/src/messages/upload.ts`에 문구 추가.
- 코드 주석·커밋 메시지·문서 한국어. 테스트 이름 `@DisplayName` 한국어. 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 한글 파일은 필요한 줄만 국소 수정 (전체 재저장 금지).
- 테스트: `./gradlew test`는 Docker Desktop 필요 (Testcontainers).

## Review Focus

- 확장자 대문자(`PHOTO.JPG`)·`jpeg` 확장자 → 정상 업로드, 키는 `.jpg` (Task 1 `FileTypeTest`).
- 등록 요청에 조작한 키(`public/listings/photos/../../private/...`, 앞에 `/`, 다른 용도 폴더) → 400 VALIDATION, 파일 접근 없음 (Task 5 `ListingApiTest`), 열람 API는 404 (Task 4).
- 실제 multipart 상한(10MB) 초과 → 500이 아니라 413 `UPLOAD_TOO_LARGE` (MockMvc는 상한을 안 거치므로 Task 3에서 핸들러 직접 테스트).
- 수정(PATCH)에서 `photos: []`로 사진 전부 삭제 → 키 확인 없이 성공 (Task 5).
- 24시간 지나 Redis 기록이 만료된 키로 등록 → 400 VALIDATION "파일을 다시 올려 주세요." (Task 5, 기록 삭제로 재현).

---

### Task 1: 형식·용도 규칙 (`FileType`, `UploadKind`)

**Files:**
- Create: `backend/src/main/java/com/company/market/common/storage/FileType.java`
- Create: `backend/src/main/java/com/company/market/common/storage/UploadKind.java`
- Test: `backend/src/test/java/com/company/market/common/storage/FileTypeTest.java`
- Test: `backend/src/test/java/com/company/market/common/storage/UploadKindTest.java`

**Interfaces:**
- Produces:
  - `enum FileType { JPG, PNG, WEBP, PDF }`
    - `String extension()` — `"jpg"|"png"|"webp"|"pdf"`
    - `String contentType()` — `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
    - `static Optional<FileType> fromFilename(String filename)` — 마지막 `.` 뒤, 소문자화, `jpeg`→JPG. 없거나 모르면 empty
    - `boolean matches(byte[] head)` — 앞 12바이트(이하 가능)로 매직 바이트 검사
  - `enum UploadKind { LISTING_PHOTO, LISTING_DATASHEET, LISTING_TEST_REPORT, LISTING_CERTIFICATE, LISTING_REPLACE_PROD }`
    - `String value()` — `"listing-photo"` 등
    - `String folder()` — `"public/listings/photos"` 등 (끝 `/` 없음)
    - `long maxBytes()`, `boolean allows(FileType)`, `boolean isPublic()` (`folder().startsWith("public/")`)
    - `static Optional<UploadKind> fromValue(String value)`
    - `static Optional<UploadKind> ofKey(String key)` — 키 전체가 `^<folder>/\d{4}/\d{2}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$`에 맞는 kind, 아니면 empty
    - `String newKey(FileType type, Clock clock)` — `folder/yyyy/MM/<UUID.randomUUID()>.<ext>`

- [ ] **Step 1: 브랜치 생성** — `git checkout -b feat/file-upload main`

- [ ] **Step 2: 실패하는 테스트 작성**

`FileTypeTest`:
- `@DisplayName("확장자는 대소문자를 무시하고 jpeg는 jpg로 본다")` — `fromFilename("PHOTO.JPG")`·`fromFilename("a.jpeg")` → `JPG`, `fromFilename("a.PDF")` → `PDF`
- `@DisplayName("확장자가 없거나 모르는 형식이면 비어 있다")` — `"noext"`, `"a.exe"`, `"a."` → empty
- `@DisplayName("매직 바이트가 형식과 맞아야 통과한다")` — `JPG.matches({FF,D8,FF,E0})` true; `PNG.matches({89,50,4E,47,0D,0A,1A,0A})` true; `WEBP.matches("RIFF"+4바이트+"WEBP")` true; `PDF.matches("%PDF-1.7")` true
- `@DisplayName("내용이 다른 형식이거나 비어 있으면 거부한다")` — `JPG.matches("%PDF-1.7")` false, `WEBP.matches("RIFF0000WAVE")` false, `PDF.matches(new byte[0])` false

`UploadKindTest`:
- `@DisplayName("용도 값으로 찾고, 모르는 값은 비어 있다")` — `fromValue("listing-photo")` → `LISTING_PHOTO`; `fromValue("photo")` → empty
- `@DisplayName("사진은 공개·5MB·이미지만, 데이터시트는 비공개·10MB·PDF만")` — `LISTING_PHOTO.isPublic()` true, `maxBytes()==5*1024*1024`, `allows(PDF)` false; `LISTING_DATASHEET.isPublic()` false, `maxBytes()==10*1024*1024`, `allows(JPG)` false; `LISTING_TEST_REPORT.allows(PNG)` true, `allows(WEBP)` false
- `@DisplayName("새 키는 폴더/연/월/uuid.확장자 이고 ofKey로 같은 용도가 나온다")` — `Clock.fixed(2026-10-02T00:00:00Z)`, `LISTING_REPLACE_PROD.newKey(PDF, clock)`이 `private/listings/replace-prods/2026/10/`로 시작, `.pdf`로 끝, 길이 ≤ 100, `ofKey(key)` → `LISTING_REPLACE_PROD`
- `@DisplayName("형식이 어긋난 키는 용도를 찾지 못한다")` — `ofKey`가 empty: `"/public/listings/photos/2026/10/<uuid>.jpg"`, `"public/listings/photos/../../private/listings/datasheets/2026/10/<uuid>.pdf"`, `"public/listings/photos/2026/10/a.jpg"`, `"public/listings/photos/2026/10/<uuid>.JPG"`, `"p1.jpg"`, `null`

- [ ] **Step 3: 실패 확인** — `cd backend && ./gradlew test --tests '*FileTypeTest' --tests '*UploadKindTest'` → 컴파일 실패

- [ ] **Step 4: `FileType`, `UploadKind` 구현** — 위 Interfaces 그대로. 용도별 수치는 Global Constraints 표.

- [ ] **Step 5: 통과 확인** — 같은 명령 → PASS

- [ ] **Step 6: 커밋** — `feat(backend): 업로드 용도·파일 형식 규칙` (본문: 용도로 폴더·형식·크기·공개 여부를 정하는 이유)

---

### Task 2: 로컬 디스크 저장소 + 설정

**Files:**
- Create: `backend/src/main/java/com/company/market/common/storage/StorageProperties.java`
- Create: `backend/src/main/java/com/company/market/common/storage/FileStorage.java`
- Create: `backend/src/main/java/com/company/market/common/storage/LocalFileStorage.java`
- Modify: `backend/src/main/resources/application.yml` (`app.storage.root`, `spring.servlet.multipart`)
- Modify: `backend/src/test/resources/application-test.yml` (`app.storage.root: build/test-uploads`)
- Modify: `docker-compose.yml` (api 공통 `volumes: - uploads_data:/data/uploads`, `environment: STORAGE_ROOT: /data/uploads`, 맨 아래 `volumes:`에 `uploads_data:`)
- Modify: `.env.example` (`STORAGE_ROOT=` 주석: 로컬 bootRun은 비우면 `./data/uploads`)
- Modify: `.gitignore` (`backend/data/`)
- Test: `backend/src/test/java/com/company/market/common/storage/LocalFileStorageTest.java`

**Interfaces:**
- Consumes: `UploadKind.ofKey(String)` (Task 1)
- Produces:
  - `@ConfigurationProperties("app.storage") record StorageProperties(String root)`
  - `interface FileStorage { void save(String key, InputStream content) throws IOException; Optional<Resource> open(String key); }`
  - `@Component class LocalFileStorage implements FileStorage` — 생성자 `(StorageProperties props)`

- [ ] **Step 1: 실패하는 테스트 작성** (`new LocalFileStorage(new StorageProperties(tempDir.toString()))`, `@TempDir`)
- `@DisplayName("저장한 키로 다시 열면 같은 내용이다")` — 유효 키 저장 후 `open(key)` 내용 일치, 파일이 `tempDir/<key>`에 있음
- `@DisplayName("다 쓰고 나면 임시 파일이 남지 않는다")` — 저장 후 해당 디렉터리 파일 목록 = 최종 파일 1개
- `@DisplayName("형식이 어긋난 키는 저장을 거부한다")` — `"../escape.jpg"`, `"public/listings/photos/../../x/2026/10/<uuid>.jpg"` → `IllegalArgumentException`, `tempDir` 밖·안 어디에도 파일 없음
- `@DisplayName("없는 키·형식이 어긋난 키를 열면 비어 있다")` — 유효하지만 없는 키 → empty, `"../../etc/passwd"` → empty

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests '*LocalFileStorageTest'` → 컴파일 실패

- [ ] **Step 3: 구현**
- 키 검사: `UploadKind.ofKey(key)` empty면 `save`는 `IllegalArgumentException`, `open`은 empty. 추가로 `root.resolve(key).normalize().startsWith(root)` 확인 (이중 방어).
- 저장: 상위 디렉터리 생성 → 같은 디렉터리에 `Files.createTempFile(dir, ".upload-", ".tmp")`로 복사 → `Files.move(tmp, target, ATOMIC_MOVE)`. 실패 시 임시 파일 삭제.
- `open`: 존재하는 일반 파일이면 `new FileSystemResource(path)`.
- 루트는 생성자에서 `Path.of(props.root()).toAbsolutePath().normalize()`.
- `application.yml`: `app.storage.root: ${STORAGE_ROOT:./data/uploads}` (주석: Compose는 volume 경로, decisions.md 2026-10-02). `spring.servlet.multipart.max-file-size: 10MB`, `max-request-size: 11MB` (주석: 용도별 상한은 UploadKind, 이건 가장 큰 용도 기준 바깥 상한).

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS. `./gradlew test --tests '*MarketApplicationTests'` → 컨텍스트 기동 PASS

- [ ] **Step 5: 커밋** — `feat(backend): 로컬 디스크 파일 저장소` (본문: MinIO 대신 로컬 디스크, 임시 파일 후 이동 이유)

---

### Task 3: 업로드 API (`POST /api/v1/uploads`)

**Files:**
- Create: `backend/src/main/java/com/company/market/common/storage/UploadService.java`
- Create: `backend/src/main/java/com/company/market/common/storage/UploadController.java`
- Create: `backend/src/main/java/com/company/market/common/storage/UploadResponse.java` (`record UploadResponse(String key)`)
- Modify: `backend/src/main/java/com/company/market/common/exception/ErrorCode.java` (`// 업로드` 묶음: `UPLOAD_INVALID_TYPE(HttpStatus.BAD_REQUEST, "올릴 수 없는 파일 형식입니다.")`, `UPLOAD_TOO_LARGE(HttpStatus.CONTENT_TOO_LARGE, "파일이 너무 큽니다.")`)
- Modify: `backend/src/main/java/com/company/market/common/exception/GlobalExceptionHandler.java` (`handleMaxUploadSizeExceededException` 오버라이드 → 413 `ApiError.of(UPLOAD_TOO_LARGE)`)
- Modify: `frontend/src/messages/upload.ts` (`errors: { UPLOAD_INVALID_TYPE: "...", UPLOAD_TOO_LARGE: "..." } as Record<string, string>` — 문구는 "무엇이 왜 틀렸고 어떻게 고치나")
- Create: `bruno/uploads/upload.bru` (multipart, `kind=listing-photo`, docs에 용도 표·오류·rate)
- Test: `backend/src/test/java/com/company/market/common/storage/UploadApiTest.java`
- Test: `backend/src/test/java/com/company/market/common/exception/GlobalExceptionHandlerTest.java` (없으면 생성)

**Interfaces:**
- Consumes: `UploadKind`, `FileType` (Task 1), `FileStorage` (Task 2), `RateLimiter.hit(String,int,Duration)`
- Produces:
  - `UploadService.upload(UUID userId, String kindValue, MultipartFile file): String` — 저장한 키
  - `UploadController`: `@PostMapping(value = "/api/v1/uploads", consumes = MULTIPART_FORM_DATA_VALUE)` → 201 `ApiResponse<UploadResponse>`
  - Redis 기록 `upload:<key>` = `<userId>|<kind.value()>` (Task 5가 읽음)

- [ ] **Step 1: 실패하는 테스트 작성** — `UploadApiTest` (`ListingApiTest`와 같은 셋업: `@Import(TestInfraConfiguration.class) @SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")`, 사용자 생성 + access 쿠키. 매 테스트 전 rate 키 삭제)
- `@DisplayName("사진을 올리면 201과 키를 돌려주고 디스크와 Redis에 기록된다")` — `multipart("/api/v1/uploads").file("file", jpg바이트, "a.jpg").param("kind","listing-photo")` → 201, `$.data.key`가 `public/listings/photos/`로 시작; `build/test-uploads/<key>` 존재; Redis `upload:<key>` = `<userId>|listing-photo`, TTL 0 < t ≤ 86400
- `@DisplayName("로그인 없이 올리면 401")`
- `@DisplayName("모르는 용도면 400 VALIDATION, fields.kind")`
- `@DisplayName("확장자는 jpg인데 내용이 PDF면 400 UPLOAD_INVALID_TYPE")`
- `@DisplayName("데이터시트 칸에 이미지를 올리면 400 UPLOAD_INVALID_TYPE")` — `kind=listing-datasheet`, png
- `@DisplayName("빈 파일은 400 UPLOAD_INVALID_TYPE")`
- `@DisplayName("사진이 5MB를 넘으면 413 UPLOAD_TOO_LARGE")` — jpg 헤더 + 5*1024*1024+1 바이트
- `@DisplayName("10분에 21번째 업로드는 429")`

`GlobalExceptionHandlerTest`:
- `@DisplayName("multipart 상한 초과는 500이 아니라 413 UPLOAD_TOO_LARGE")` — `new GlobalExceptionHandler().handleMaxUploadSizeExceededException(new MaxUploadSizeExceededException(10L*1024*1024), new HttpHeaders(), HttpStatus.CONTENT_TOO_LARGE, mock(WebRequest))` → status 413, body code `UPLOAD_TOO_LARGE`

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests '*UploadApiTest' --tests '*GlobalExceptionHandlerTest'` → FAIL

- [ ] **Step 3: 구현**
- `UploadService.upload` 순서: rate limit(20, 10분) → `UploadKind.fromValue` 없으면 `ValidationException(Map.of("kind","알 수 없는 업로드 용도입니다."))` → `FileType.fromFilename(file.getOriginalFilename())` 없거나 `!kind.allows(type)`면 `UPLOAD_INVALID_TYPE` → `file.isEmpty()`면 `UPLOAD_INVALID_TYPE` → `file.getSize() > kind.maxBytes()`면 `UPLOAD_TOO_LARGE` → 앞 12바이트 읽어 `!type.matches(head)`면 `UPLOAD_INVALID_TYPE` → `kind.newKey(type, clock)` → `storage.save` → Redis `opsForValue().set(key, value, Duration.ofHours(24))` → 키 반환.
- `IOException`은 그대로 던져 전역 500 (디스크 오류는 사용자 잘못이 아님).
- 컨트롤러는 `@AuthenticationPrincipal AuthenticatedUser me`, `@RequestParam String kind`, `@RequestPart MultipartFile file`. 인증은 기존 `anyRequest().authenticated()`가 막는다.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS

- [ ] **Step 5: 프론트 확인** — `cd frontend && pnpm typecheck && pnpm lint` → 통과

- [ ] **Step 6: 커밋** — `feat(backend): 파일 업로드 API` (본문: 2단계 업로드·Redis 소유 기록 이유. 프론트 문구 포함)

---

### Task 4: 파일 열람 API (`GET /api/v1/files/{*key}`)

**Files:**
- Create: `backend/src/main/java/com/company/market/common/storage/FileController.java`
- Modify: `backend/src/main/java/com/company/market/common/auth/SecurityConfig.java` (`requestMatchers(HttpMethod.GET, "/api/v1/files/**").permitAll()` + 주석: 공개·비공개 판단은 FileController)
- Create: `bruno/uploads/file.bru`
- Test: `backend/src/test/java/com/company/market/common/storage/FileApiTest.java`

**Interfaces:**
- Consumes: `FileStorage.open(String)` (Task 2), `UploadKind.ofKey`, `FileType.fromFilename` (Task 1)
- Produces: `GET /api/v1/files/{*key}` — `{*key}`는 앞에 `/`가 붙어 오므로 떼고 사용

- [ ] **Step 1: 실패하는 테스트 작성** (파일은 `FileStorage.save`로 직접 넣는다)
- `@DisplayName("공개 사진은 로그인 없이 200, image/jpeg, nosniff, 1년 캐시")` — `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`, `Cache-Control`에 `max-age=31536000`·`public`·`immutable`, 본문 일치
- `@DisplayName("비공개 데이터시트는 로그인 없이 401")`
- `@DisplayName("비공개 데이터시트는 로그인하면 200, application/pdf, inline, 캐시 private")` — `Content-Disposition`이 `inline`으로 시작, `Cache-Control`에 `private`·`no-cache`
- `@DisplayName("없는 키·형식이 어긋난 키는 404")` — 유효하지만 없는 키, `/api/v1/files/public/listings/photos/2026/10/x.jpg` → 404
- `@DisplayName("인코딩한 경로 탈출(%2e%2e)은 방화벽이 400으로 끊는다")` — `/api/v1/files/public/listings/photos/%2e%2e/%2e%2e/%2e%2e/etc/passwd` → 400 (Spring Security `StrictHttpFirewall`)

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests '*FileApiTest'` → FAIL

- [ ] **Step 3: 구현**
- 순서: `UploadKind.ofKey(key)` empty → `ApiException(NOT_FOUND)` → `!kind.isPublic() && me == null` → `ApiException(UNAUTHENTICATED)` → `storage.open` empty → `NOT_FOUND` → 200 `ResponseEntity<Resource>`.
- 헤더: `contentType(FileType.contentType())`, `X-Content-Type-Options: nosniff`, 공개 `CacheControl.maxAge(365일).cachePublic().immutable()`, 비공개 `CacheControl.noCache().cachePrivate()`, PDF면 `ContentDisposition.inline().filename(<키 마지막 조각>)`.

- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS

- [ ] **Step 5: 커밋** — `feat(backend): 업로드 파일 열람 API` (본문: 공개/비공개 판단을 폴더로 하는 이유, 캐시 정책)

---

### Task 5: 매물 등록·수정의 업로드 키 확인

**Files:**
- Modify: `backend/src/main/java/com/company/market/common/storage/UploadService.java` (`verifyOwned`, `release` 추가)
- Create: `backend/src/main/java/com/company/market/common/storage/UploadRef.java` (`record UploadRef(String field, String key, UploadKind kind)`)
- Modify: `backend/src/main/java/com/company/market/listing/service/ListingService.java` (생성자에 `UploadService`, `create`·`update`에서 호출)
- Modify: `backend/src/test/java/com/company/market/listing/service/ListingServiceTest.java` (`@Mock UploadService` 추가, 생성자 인자)
- Modify: `backend/src/test/java/com/company/market/listing/controller/ListingApiTest.java` (임의 문자열 사진·데이터시트 경로 → 실제 업로드 키. 헬퍼 `String uploaded(UploadKind kind)` = `/api/v1/uploads` 호출 후 키 반환)
- Modify: `bruno/listings/create.bru`, `bruno/listings/update.bru`(경로 필드가 있으면), `bruno/listings/register-warranty.bru` (값을 업로드 키 예시로, docs에 "uploads/upload.bru 먼저" 안내)
- Modify: `backend/src/main/java/com/company/market/listing/dto/ListingCreateRequest.java`, `ListingUpdateRequest.java` (클래스 주석에 "경로 필드는 /api/v1/uploads 가 돌려준 키" 한 줄만)

**Interfaces:**
- Consumes: Redis 기록 형식 (Task 3), `UploadKind` (Task 1)
- Produces:
  - `UploadService.verifyOwned(UUID userId, List<UploadRef> refs): void` — 실패한 필드 전부 모아 `ValidationException(fields)`; 필드 문구 `"파일을 다시 올려 주세요."`. 같은 키는 한 번만 Redis 조회.
  - `UploadService.release(Collection<String> keys): void` — Redis 기록 삭제

- [ ] **Step 1: 실패하는 테스트 작성** (`ListingApiTest`에 추가)
- `@DisplayName("업로드한 사진·데이터시트 키로 등록하면 저장되고 업로드 기록은 지워진다")` — `photos`=[사진 키 2개], `listingDataSheet`=`productDataSheet`=같은 데이터시트 키 → 201, 응답 `photos` 일치, Redis `upload:<각 키>` 없음
- `@DisplayName("다른 사용자가 올린 키로 등록하면 400 VALIDATION, fields.photos")` — 문구 `"파일을 다시 올려 주세요."`
- `@DisplayName("용도가 다른 키(사진 칸에 데이터시트 키)는 400, fields.photos")`
- `@DisplayName("이미 등록에 쓴 키를 다시 쓰면 400")`
- `@DisplayName("업로드 기록이 없는 키(만료·조작)는 400")` — 형식은 맞지만 Redis 없는 키, `"public/listings/photos/../../private/listings/datasheets/2026/10/<uuid>.pdf"`, `"p1.jpg"` 각각 → 400, `fields.photos`
- `@DisplayName("수정할 때 이미 이 매물에 있는 사진 키는 다시 올리지 않아도 통과한다")` — 등록(사진 A,B) 후 PATCH `photos`=[A, 새 업로드 C] → 200, [A,C]
- `@DisplayName("수정으로 사진을 전부 빼면(photos: []) 성공한다")`
- `@DisplayName("수정에서 테스트리포트·정품인증서·대체품도 본인 업로드 키만 받는다")` — 각 용도로 올린 키 → 200 저장; `testReport`에 사진 키 → 400 `fields.testReport`
- 기존 테스트(`createsListingAndAutoCreatesProduct`, `photosBoundary`, `photosOverLimit`, `responseIncludesProductAndListingDetailFields` 등)의 경로 문자열을 업로드 키로 바꾼다. `photosOverLimit`의 "100자 초과" 케이스는 Bean Validation이 먼저 막으므로 그대로 400.

- [ ] **Step 2: 실패 확인** — `./gradlew test --tests '*ListingApiTest' --tests '*ListingServiceTest'` → FAIL

- [ ] **Step 3: 구현**
- `verifyOwned`: 각 ref에 대해 `UploadKind.ofKey(key)`가 `ref.kind()`가 아니면 실패, Redis 값이 `<userId>|<ref.kind().value()>`가 아니면 실패. 실패 필드는 `putIfAbsent`.
- `ListingService.create`: DB 저장 전에 `verifyOwned(userId, refs)` — refs = `photos`→`LISTING_PHOTO`("photos"), `listingDataSheet`·`productDataSheet`→`LISTING_DATASHEET`. null·빈 목록은 제외. `saveAndFlush` 성공 후 `release(키들)`.
- `ListingService.update`: 권한 검사 뒤, `photos`·`listingDataSheet`·`testReport`(`LISTING_TEST_REPORT`)·`certificateOfAuthen`(`LISTING_CERTIFICATE`)·`replaceProd`(`LISTING_REPLACE_PROD`) 중 null 아닌 것에서 **이 매물에 이미 저장된 값과 같은 키는 빼고** refs 구성 → `verifyOwned` → `applyUpdate` → `listings.flush()` → `release`.
- Redis 삭제는 DB 커밋 전에 일어나지만 flush로 제약 위반은 먼저 드러난다. 커밋 실패 시 사용자는 다시 업로드하면 된다 (주석으로 남김).

- [ ] **Step 4: 통과 확인** — `./gradlew test --tests '*Listing*'` → PASS

- [ ] **Step 5: 커밋** — `feat(backend): 매물 등록·수정은 본인이 올린 파일 키만 받음` (본문: 임의 경로 저장을 막는 이유, 기존 키 통과 이유)

---

### Task 6: 문서 + 전체 검증

**Files:**
- Modify: `docs/decisions.md` — 09-28 "파일 저장소는 구현 시 결정" 제목에 `[대체됨 → 2026-10-02]`; 새 항목 `## 2026-10-02 파일 저장소는 서버 로컬 디스크, 2단계 업로드` (결정·이유·대안 MinIO·재검토 조건, 5줄 이내); 색인 "인프라" 행에서 MinIO 보류 → 로컬 디스크, 새 행 없이 항목명 추가
- Modify: `docs/security.md` "파일 업로드" — 이미지 열을 용도 표(spec "업로드 용도")로 교체, 사진 최대 4장, 저장·공개 칸 갱신, EXIF 위치 노출 위험 한 줄, 비공개 파일 로그인 열람
- Modify: `docs/architecture.md` — 저장소 volume `uploads_data` 한 줄
- Modify: `docs/data-model.md` — 매물 경로 컬럼 설명을 "저장소 키 (`/api/v1/uploads` 응답)"로, 다음에 정할 것에서 파일 관련 제거
- Modify: `bruno/README.md` (폴더 목록이 있으면 `uploads/` 추가)

- [ ] **Step 1: 문서 수정** — 한글 파일 국소 수정만

- [ ] **Step 2: 전체 검증**
- `cd backend && ./gradlew check` → BUILD SUCCESSFUL
- `cd frontend && pnpm typecheck && pnpm lint && pnpm test` → 통과

- [ ] **Step 3: 수동 확인** — `docker compose up -d` + `./gradlew bootRun`, Bruno로 로그인 → `uploads/upload.bru`(실제 jpg) → `uploads/file.bru` 200 → `listings/create.bru`(받은 키) 201. 11MB 파일 업로드 → 413 `UPLOAD_TOO_LARGE`.

- [ ] **Step 4: 커밋** — `docs: 파일 업로드 반영 (저장소 결정·보안·데이터 모델)` (문서지만 기능 브랜치에 같이 — 코드와 짝)

- [ ] **Step 5: 푸시 + PR** — `git push -u origin feat/file-upload`, `gh pr create` (본문: 무엇을·왜·확인 방법, 프론트는 다음 PR). 이어서 `/code-review`, 인증·권한·업로드라 `/security-review`도 실행하고 반영 후 보고. 머지는 사용자가 웹에서.
