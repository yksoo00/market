# 아키텍처

> 현재 실행 구성과 이후 목표 구성을 구분한다. 계정 데이터 정의는 `data-model.md`, 결정 배경은 `decisions.md`.

## 현재 실행 구성

```text
브라우저 → Next.js (localhost:3000) → Spring Boot (localhost:8080)
                                         ├─ PostgreSQL: 정의서 테이블 trd_* (계정·카테고리·상품마스터·매물·거래)
                                         ├─ Redis: refresh 세션·업로드 기록·멱등 키·가입 임시값
                                         └─ 디스크: 업로드 파일 (Compose volume uploads_data)
```

- 로컬은 Docker Compose로 PostgreSQL·Redis를 실행하고, Spring은 `bootRun`, 프론트는 `pnpm dev`로 실행한다.
- Spring을 컨테이너로 띄우려면 `docker compose up --watch api-dev`(`dev` 프로필, `backend/Dockerfile.dev`). compose watch가 `src/`를 컨테이너로 복사 → 컨테이너 안 `gradlew classes --continuous`가 컴파일 → devtools가 앱만 재시작한다. `build.gradle`이 바뀌면 이미지를 다시 빌드한다. 포트는 호스트 `bootRun`과 같은 `127.0.0.1:8080`이라 둘 중 하나만 띄운다 (decisions.md 2026-10-07).
- Compose `prod` 프로필에는 Spring 복제본 2개가 있지만, 현재 외부 프록시·TLS는 실행하지 않는다.
- 구현된 도메인: 계정(가입·로그인), 매물(등록·수정·추가등록·검색·상세, 상품마스터에서 고르기), 거래(직접 구매 — 요청·거래완료·취소). 견적·장바구니·결제·채팅은 없다. AI 기능은 보류(서비스 제거).
- rate limit 은 2026-10-19 에 전부 지웠다. 운영 전에 다시 넣는다 (decisions.md 같은 날).
- `organization` 패키지는 조직 테이블을 없앤 뒤 남은 코드다 (`@Entity` 주석 처리). 쓰는 곳이 없다.
- 소셜 로그인은 구현했으나 단일 `trd_user_info` 전환으로 일시 주석 처리했다 (`OAuthController` 등).

## 기술 구성

| 구성 요소 | 역할 | 현재 상태 |
|---|---|---|
| Next.js 16 | 화면. 넓은 화면은 칸 엔진 [홈 \| 주기능 \| 보조] | 홈·로그인·가입·매물 등록/검색/상세·마이페이지·내 판매글·받은 구매요청·내 구매목록 |
| Spring Boot 4.1, Java 21 | REST API | 패키지 user·listing·trade·common |
| PostgreSQL 16 | 영속 데이터 | 정의서 테이블 `trd_*` 6개 + 보조 테이블. 목록은 `data-model.md` |
| Redis 7 | refresh 세션, 업로드 기록(24시간), 멱등 키, 가입 임시값(약관·본인인증 스텁) | 인증·업로드·매물 등록·구매요청 흐름에 사용 |
| 파일 저장소 | 업로드 파일 (`common/storage`, `STORAGE_ROOT`) | 서버 로컬 디스크. Compose는 volume `uploads_data`를 api-1·api-2가 공유. DB와 함께 백업 (decisions.md 2026-10-02) |

## 백엔드 구조

제품 백엔드는 도메인 패키지로 나누는 모듈러 모놀리스로 유지한다. 도메인 기능을 구현할 때 `controller → service → repository` 방향을 따른다. 조직 테이블은 없으며 기업 정보는 사용자 행의 회사 컬럼에 둔다.

현재 계정 API 흐름:

1. 개인 로그인: `user_id` 조회 → bcrypt 확인 → access·refresh 쿠키 발급.
2. 기업 로그인: `bus_reg_id` 조회 → bcrypt 확인 → 쿠키 발급.
3. refresh: Redis 세션 확인·회전 → 새 access·refresh 쿠키 발급.
4. 개인 가입: 입력값 검증·중복 확인 → 단일 `trd_user_info` 행 생성. 가입 시 본인인증·약관 단계는 없다.

5. 기업 가입: 사업자 인증(`/signup/business/verify`) → 토큰으로 `/signup/business`. 국세청 진위확인은 아직 연동 전이라 `APP_ENV=local`에서만 통과하고 그 외 환경은 거부한다.

사업자등록증 업로드·관리자 심사, 아이디/비밀번호 찾기 API는 아직 없다. 프론트 화면이 존재하더라도 해당 API가 준비된 것으로 간주하지 않는다.

## 이후 목표 구성

- 프론트는 Vercel, Spring·PostgreSQL·Redis는 자체 서버에서 운영할 계획이다.
- 공개 전 역방향 프록시, TLS, 접근 제어, 백업·복구 절차를 구성한다.
- AI 재개 시: 별도 FastAPI 1개를 Spring만 내부 네트워크로 호출하고, AI는 사용자 권한을 다루지 않는다 (decisions.md 2026-09-18).
- 견적 등 새 기능은 기능·권한·데이터 모델을 정의한 후 구현한다.
