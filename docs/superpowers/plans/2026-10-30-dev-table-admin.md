# 임시 테이블 관리 페이지 + 엑셀 불러오기 — 계획

이 파일은 설계 + 작업 (CLAUDE.md "중간 크기 기능" — 새 테이블·인증 변경 없음). 승인은 이 파일 한 번, 구현은 직접, PR 에서 `/code-review` 한 번. 브랜치 `feat/dev-table-admin` (main 에서). 의존성 추가(Apache POI)는 사용자 승인 받음 (2026-10-30).

## 설계

### 확정된 것 (사용자 2026-10-30)

- 테스트용 **임시** 페이지. 테이블마다 탭, 탭마다 [조회] [생성] [수정] [삭제] 버튼과 결과 그리드.
- 엑셀 불러오기 두 가지: [전체 불러오기](시트 = 테이블), [이 테이블 불러오기](시트 1개). 대량 입력용.
- 범용 JdbcTemplate CRUD 하나로 처리 (테이블별 엔티티·컨트롤러 만들지 않음).
- 접근 제한: 설정으로 켠 로컬에서만. 켜지 않으면 API·화면 모두 404.
- Apache POI(`poi-ooxml`) 추가.

### 가정 (검토 때 확인)

1. 서비스 로직을 거치지 않고 DB 에 바로 쓴다. 비밀번호 해시·거래 정합성·카테고리 검사가 없다. `trd_user_info.password` 는 bcrypt 해시를 직접 넣어야 한다.
2. 엑셀 PK 중복은 오류(upsert 아님). 한 번에 한 트랜잭션, 실패하면 전체 롤백하고 "시트·N행: 사유"를 돌려준다.
3. 화면은 타일 워크스페이스 밖의 일반 전체 화면 `/dev/tables`.
4. 대상 테이블은 화이트리스트 8개: `trd_user_info`, `trd_ctgr_code`, `trd_ctgr_master`, `trd_prod_master`, `trd_prod_reg`, `trd_trade_info`, `trd_cart_info`, `trd_trade_history`. `flyway_schema_history` 등은 제외.
5. 새 속성 없이 기존 `APP_ENV=local`(`app.env`)로 빈을 건다. 이 저장소는 Spring 프로필 대신 `.env` 값으로 로컬 전용 동작을 켠다(stub 본인인증 등). 프론트는 `NEXT_PUBLIC_DEV_TOOLS=true`. (구현 때 바꿈: 처음 계획은 `app.dev-tools.enabled`)
6. 켜졌을 때도 로그인은 필요 없다. `SecurityConfig` 에 `/api/v1/dev/**` permitAll 을 추가하되, 컨트롤러 빈 자체가 속성이 꺼지면 생성되지 않아 404 가 된다. 이 규칙이 켜진 환경의 공개 노출을 의미하므로 **운영 `.env` 에 절대 넣지 않는다**(security.md 에 한 줄 기록).

### 백엔드 (`com.company.market.devtools`)

`@ConditionalOnProperty("app.dev-tools.enabled")` 로 컨트롤러·서비스 빈을 건다.

| 요청 | 동작 |
|---|---|
| `GET /api/v1/dev/tables` | 화이트리스트 테이블별 컬럼(이름·타입·nullable)·PK 목록. `information_schema` 에서 읽는다 |
| `GET /api/v1/dev/tables/{t}/rows?limit&offset` | 조회. limit 기본 100·최대 1000 |
| `POST /api/v1/dev/tables/{t}/rows` | 생성. 바디 = `{컬럼: 값}` |
| `PUT /api/v1/dev/tables/{t}/rows` | 수정. 바디 = `{key:{PK컬럼:값}, values:{컬럼:값}}` |
| `DELETE /api/v1/dev/tables/{t}/rows` | 삭제. 바디 = `{PK컬럼:값}` |
| `POST /api/v1/dev/tables/{t}/import` | multipart xlsx, 첫 시트 한 장을 `{t}` 로 |
| `POST /api/v1/dev/import` | multipart xlsx, 시트 이름 = 테이블명. 화이트리스트에 없는 시트가 있으면 전체 거절 |

- 테이블·컬럼 이름은 메타데이터 목록에 있는 값만 SQL 식별자로 쓴다(따옴표 처리). 값은 전부 바인드 파라미터 — 컬럼 타입(uuid, integer, char/varchar)에 맞춰 변환. 사용자가 보낸 문자열을 SQL 에 이어 붙이지 않는다.
- 엑셀: 1행 = 컬럼 물리명(대소문자 무시), 2행부터 데이터. 빈 셀 = null. 숫자 셀은 컬럼 타입에 맞춰 변환(정수 컬럼에 `1.0` 은 `1`; `varchar` 컬럼의 숫자 셀은 지수 표기 없이 문자열로). 모르는 헤더 컬럼이 있으면 거절. 파일 10MB·최대 행 수 제한(security.md 업로드 수치에 맞춤, 행 수는 시트당 5만).
- 오류 응답은 기존 `ErrorCode` 형식. DB 제약 위반 메시지는 그대로 보여 준다(테스트용이라 필요).
- 응답·로그에 `password` 컬럼 값은 `***` 로 가린다(조회 응답 포함). 생성·수정·엑셀 입력은 그대로 받는다.

### 프론트 (`app/dev/tables/page.tsx`, `components/dev/*`, `lib/api/dev.ts`)

- `NEXT_PUBLIC_DEV_TOOLS` 가 `true` 가 아니면 `notFound()`. 평소엔 일반 화면 어디서도 링크하지 않는다.
- 위: [엑셀 전체 불러오기] 버튼(파일 선택). 아래: 테이블 탭. 탭 안: [조회] [생성] [수정] [삭제], [이 테이블 엑셀 불러오기], 결과 그리드(행 선택 가능).
- [생성]/[수정]: 컬럼별 입력 폼(수정은 PK 칸 읽기 전용). 서버 오류는 폼 위에 그대로 표시. [삭제]: 선택한 행, 확인 모달 후.
- 엑셀 결과: 성공 시 "N행 입력", 실패 시 시트·행·사유. 기존 `ResultDialog` 재사용.
- 문구는 `messages/` 에 모은다. zod 검증은 안 만든다: 임시 화면이라 서버 오류를 필드 옆이 아닌 폼 위에 보인다(규칙 예외, 이 문서에 이유 기록).

### 영향 검토

- 운영 경로: 속성이 꺼지면 빈 자체가 없어 기존 API·화면 영향 없음. `SecurityConfig` 에 규칙 한 줄 추가만.
- DB: 마이그레이션·테이블 없음. 로컬 DB 에 직접 쓰므로 데이터 정합은 사용자 몫.
- 의존성: `org.apache.poi:poi-ooxml` 1개 (백엔드 런타임에 포함되지만 사용 코드는 devtools 한 곳).

## 작업

1. `build.gradle` 에 `poi-ooxml` 추가. 설정 클래스에 `app.dev-tools.enabled` 속성(기본 false). `.env.example` 키 추가.
2. 테스트 먼저: `DevTableApiTest`(Testcontainers) — 꺼짐이면 404, 켜짐이면 목록·생성·조회·수정·삭제, 화이트리스트 밖 테이블 거절, `password` 마스킹.
3. `devtools` 메타데이터·CRUD 서비스·컨트롤러 구현. `SecurityConfig` permitAll.
4. 엑셀 테스트(`DevExcelImportTest`) — 정상, 중복 PK 롤백, 모르는 헤더, 화이트리스트 밖 시트, 타입 변환 → 서비스·컨트롤러 구현.
5. 프론트: `lib/api/dev.ts`, 페이지·탭·그리드·폼·엑셀 버튼, `messages/`. `pnpm typecheck && pnpm lint && pnpm test`.
6. `docs/security.md` 에 임시 개발 API 한 단락, `decisions.md` 에 결정(범용 CRUD·속성 게이트·POI) 추가, `bruno/` 요청 파일.
7. 직접 띄워 확인: 속성 켠 로컬에서 각 탭 조회·생성·수정·삭제, 샘플 엑셀 두 가지 불러오기. 끄면 404.
8. PR → `/code-review` 1회 (`./gradlew check` 통과 후). `/security-review` 는 인증 규칙 변경이 있으니 실행.

## 미정

- 없음. 위 가정 6개 중 틀린 것은 승인 때 말해 주세요.
