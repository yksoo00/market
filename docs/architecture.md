# 아키텍처

> 이 문서가 답하는 질문: 무엇이 어디서 돌고, 서로 어떻게 연결되는가.
> 기능은 `prd.md`, 데이터는 `data-model.md`, 결정 이유는 `decisions.md`.

## 한눈에

```
[브라우저]
   │
   ├── app.example.com ──→ Vercel (Next.js)              프론트. 무중단·CDN은 Vercel 담당
   │
   └── api.example.com ──→ Cloudflare (DNS·DDNS·proxy)
                              └─→ [공유기] 80/443 포워딩 ──→ R740
                                    └─→ Caddy ─┬─→ api-1 ─┐
                                               ├─→ api-2 ─┤ Spring Boot (제품 백엔드)
                                               │          │   ├── PostgreSQL (+pgvector)
                                               │          │   ├── Redis
                                               │          │   ├── MinIO
                                               │          │   └──HTTP──→ ai (FastAPI, 내부 전용)
                                               └─→ /media → MinIO
```

- 서버 1대 (Dell R740, 64GB). Docker Compose로 전부 기동.
- 제품 백엔드는 **Spring Boot 모듈러 모놀리스** (프로세스 하나, 복제 2개, DB 하나).
- AI는 **별도 Python 서비스** (`ai`). 외부 노출 없음, Spring만 호출. 무상태 함수 모음.
- MSA 아님. 서비스는 Spring과 ai 둘뿐이고, ai는 Spring의 도구.

## 구성 요소

| 구성 요소 | 역할 | 위치 |
|---|---|---|
| Next.js | 화면. 목록·상세는 SSR(SEO), 나머지는 브라우저에서 API 직접 호출 | Vercel, 리전 icn1(서울) |
| Caddy | HTTPS 인증서 자동 발급, api-1/api-2 로드밸런싱, 헬스체크, /media → MinIO | R740 |
| Spring Boot ×2 | REST API + WebSocket(채팅). 인증·권한·도메인 로직 전부. stateless | R740 |
| PostgreSQL | 진실의 원천. 게시글·사용자·채팅·거래·임베딩(pgvector) 전부 | R740, 볼륨 마운트 |
| Redis | refresh token, WebSocket Pub/Sub, rate limit, 안 읽은 수, 백그라운드 작업 큐 | R740 |
| MinIO | 이미지 저장 (S3 호환). DB에는 경로만 | R740, 볼륨 마운트 |
| ai (FastAPI) | OCR, 임베딩 생성, 챗봇 응답. Hugging Face 모델(CPU) + 외부 API | R740, docker 내부 네트워크만 |

## Spring Boot 내부 구조 (모듈러 모놀리스)

```
backend/src/main/java/.../
├── user/           ← 도메인별 패키지
├── listing/
├── chat/
├── organization/   ← B2B. 1단계엔 엔티티·권한만
├── ai/             ← ai 서비스 HTTP 클라이언트 + 호출 조율. 모델 로직 없음
└── common/         ← auth, config, redis, storage, exception
```

- 각 도메인: `controller → service → repository`. 위→아래로만 호출.
- controller에 비즈니스 로직 금지, repository에 권한 검사 금지.
- 도메인 간 호출은 service 레벨에서만.
- 버전: Spring Boot 4.1, Java 21. 정확한 버전은 `CLAUDE.md` 스택 표.
- 마이그레이션: Flyway. 스키마 변경은 항상 마이그레이션 파일.

## ai 서비스 (FastAPI)

```
ai/app/
├── quote.py    ← 견적서 PDF: 텍스트 추출 → (스캔본이면 OCR) → LLM 구조화 → 품목 목록
├── embed.py    ← Hugging Face 임베딩 모델(CPU). pgvector 저장/유사 검색
├── chat.py     ← LLM tool calling. 조회는 Spring이 제공한 함수만 호출
└── main.py     ← 엔드포인트: POST /parse-quote, POST /embed, POST /similar, POST /chat
```

경계 규칙:
- 외부 노출 없음. Caddy 뒤가 아니라 docker 내부 네트워크에서 Spring만 호출. 내부 토큰으로 호출자 확인.
- 인증·권한·사용자·게시글 로직 없음. "입력 주면 결과 주는" 함수 모음.
- DB는 공유 Postgres. ai는 임베딩 테이블만 읽고 씀. 다른 테이블 접근 금지.
- ai가 죽어도 서비스는 정상. AI 기능만 비활성 (Spring이 타임아웃·실패를 처리).
- HTTP 계약은 `docs/ai-api.md`. 계약 바꾸면 양쪽 같은 PR.
- 서버에서 LLM 직접 실행 안 함 (GPU 없음). 임베딩·OCR은 CPU.

## 요청 흐름

### 일반 요청
브라우저 → `api.example.com` → Cloudflare → 공유기 → Caddy → Spring → Postgres/Redis → 응답

### SSR (목록·상세만)
브라우저 → Vercel → `api.example.com` → … → Vercel → 브라우저
SSR은 SEO가 필요한 페이지로 한정. 왕복이 세 번이라 남용하지 않음.

### 채팅
브라우저 ⇄ WebSocket ⇄ Spring (api-1 또는 api-2)
- 메시지 저장: Postgres `messages`
- 전달: Redis Pub/Sub 채널 `chat:{chat_id}` — api-1에 붙은 유저가 보낸 메시지를 api-2에 붙은 유저에게
- 재접속: 클라이언트가 끊기면 자동 재접속 후 `last_message_id` 이후를 REST로 재조회

### 이미지
업로드: 브라우저 → Spring(검증: 형식·크기) → MinIO → DB에 경로 저장
표시: 브라우저 → `api.example.com/media/...` → Caddy → MinIO (Cloudflare가 캐시)

### AI ① 견적서 → 상품 등록 초안
```
사용자가 PDF 업로드 → Spring이 MinIO 저장 → @Async로 ai /parse-quote 호출
ai: 텍스트 PDF면 텍스트 추출 / 스캔 PDF면 외부 OCR API → LLM 구조화
    → [{품명, 제조사, 모델명, 수량, 단가, 비고}, ...]
Spring: 품목별 "등록 초안(draft)" 저장 → 사용자에게 알림
사용자: 초안 화면에서 확인·수정 → 게시     ← 자동 게시 절대 안 함
```
- 처리 중 상태를 사용자에게 보여줌 (초 단위 작업).
- 구조화 실패 시 초안 없이 "직접 입력" 안내. 서비스 장애 아님.

### AI ② 상품 추천
- 상품 생성/수정 → Spring `@Async` → `ai /embed` (제목+스펙) → ai가 pgvector에 저장.
- 상세 페이지 "비슷한 상품" → Spring → `ai /similar` → 상품 id 목록 → Spring이 권한·상태 필터 후 응답.
- 1단계는 유사 상품만. 행동 기반 추천은 나중.

### AI ③ 챗봇 (LLM + DB 조회)
```
질문 → Spring → ai /chat
ai: LLM이 필요한 조회를 판단 (tool calling)
    → Spring의 조회 API 호출 (search_products, get_product, get_seller_summary …)
    → 결과로 답변 생성
Spring: 조회 API는 요청한 사용자 권한으로 실행. 남의 채팅·정산·개인정보 접근 불가
```
- **LLM이 SQL을 직접 생성하지 않음.** 미리 정의된 읽기 전용 함수만.
- 조회 함수 목록은 `docs/ai-api.md`에 명시. 추가할 때마다 권한 검토.
- 외부 API 키(OCR, LLM)는 ai 서비스의 `.env`에만. Spring은 모름.

## 인증

- Access token: JWT, 15분, stateless. 서명 검증만.
- Refresh token: 30일, Redis 저장 (`session:{user_id}:{device_id}`). 로그아웃·강제 로그아웃·기기별 세션 관리 가능.
- 쿠키는 루트 도메인(`.example.com`) 기준 → app./api. 공유.
- 소셜 로그인: 카카오, 구글 (OAuth 콜백은 api. 쪽). Spring Security.

## Redis 사용 원칙

**둔다** (Redis 아니면 둘 곳이 없는 상태):
- refresh token
- WebSocket Pub/Sub
- rate limit 카운터
- 안 읽은 수, 접속 상태 (재계산 가능한 파생 데이터)
- 백그라운드 작업 큐 (`@Async`로 부족해지면)

**두지 않는다**:
- 메시지 본문, 게시글, 사용자 정보 → Postgres
- 조회 캐시 → 느려진 게 **측정되면** 그때. `common/cache` 래퍼 경유로만.

## 외부 진입 (서버가 공유기 뒤에 있음)

**포트포워딩 + Cloudflare DDNS** (담당자 계획)

```
공인 IP 변경 → 공유기가 Cloudflare API로 api.example.com A 레코드 갱신 (DDNS)
사용자 → api.example.com → Cloudflare proxy → 공인 IP → 공유기 80/443 포워딩 → R740 Caddy
```

- DNS: Cloudflare. 공유기(ipTIME) DDNS 설정에서 Cloudflare 선택, API 토큰(DNS 편집 권한만) 입력. (지원 안 되는 기종이면 서버에 `cloudflare-ddns` 컨테이너로 대체.)
- 공유기: 80, 443 → R740 포트포워딩. 공유기 자체 HTTPS 기능은 끄거나 다른 포트로 (443 충돌 방지). 인증서는 공유기에서 다루지 않음.
- Cloudflare: 프록시(주황 구름) ON, SSL 모드 **Full (strict)** (Flexible 금지 — Cloudflare→서버 구간이 평문이 됨).
- 서버 쪽 할 일: Caddy가 443 받고 `api.example.com` 인증서 자동 발급. 포트포워딩이 먼저 되어 있어야 발급됨.
- 설정 순서: 도메인 → Cloudflare 등록 → API 토큰 → 공유기 DDNS·포워딩 → `compose up` → `/health` 확인 → 프록시 ON.

대안 (포트를 못 열게 될 경우만): Cloudflare Tunnel. `cloudflared` 컨테이너 1개, 포트 개방·DDNS 불필요.

## 배포

### 프론트
Vercel. `main` 푸시 → 자동 배포. 무중단 자동.

### 백엔드 (무중단)
GitHub Actions → SSH → 서버에서 스크립트 실행:
1. 새 이미지 빌드 (Spring, ai)
2. DB 마이그레이션 실행 — Flyway (직전 버전 코드와 호환되어야 함)
3. api-1 새 버전으로 재시작 → `/actuator/health` 200 대기 (최대 60초)
4. api-2 같은 순서
5. ai 재시작 (컨테이너 1개. 짧은 중단은 AI 기능만 영향)
6. 실패 시 이전 이미지 태그로 롤백

필요 조건:
- `GET /actuator/health`: DB·Redis 연결 확인 후 200
- SIGTERM 시 graceful shutdown, 30초 내 진행 중 요청·WS 마무리 (`server.shutdown=graceful`)
- 백엔드 컨테이너 안에 상태 없음 (세션 → Redis, 파일 → MinIO)

### DB 마이그레이션 규칙 (무중단 호환)
| 하고 싶은 것 | 방법 |
|---|---|
| 컬럼 추가 | nullable 또는 기본값으로 바로 추가 |
| 컬럼 이름 변경 | 새 컬럼 추가 → 코드가 둘 다 쓰게 → 배포 → 구 컬럼 삭제 (배포 2회) |
| 컬럼 삭제 | 코드에서 참조 제거 → 배포 → 다음 배포에서 삭제 |
| NOT NULL 추가 | 기본값 채운 뒤 → 다음 배포에서 제약 |

## 환경

| 환경 | 프론트 | 백엔드 | DB |
|---|---|---|---|
| local | `pnpm dev` | `docker compose up` (dev 프로필) | 로컬 컨테이너 |
| staging | Vercel preview | R740, 별도 compose 프로젝트, `staging-api.` | 별도 DB |
| production | Vercel production | R740 | production DB |

설정은 전부 환경변수. `.env`는 커밋하지 않음.

## 보안 경계

- 외부 개방 포트: 공유기 → R740 80, 443만. SSH는 키 인증, 가능하면 사내 IP만.
- Postgres, Redis, MinIO, ai는 docker 내부 네트워크만. 호스트 포트 바인딩 금지.
- Spring → ai 호출은 내부 토큰 헤더로 확인.
- Cloudflare DNS proxy: DDoS 완화, 이미지 캐시.
- fail2ban, 자동 보안 업데이트.
- 백엔드 장애 시 프론트는 "연결할 수 없습니다" 화면 + 재시도.

## 백업

- Postgres: 매일 `pg_dump` → 서버 **밖** (외부 스토리지/클라우드). 보관 30일.
- MinIO: 주기적 동기화 → 서버 밖.
- 복구 절차를 한 번은 실제로 해볼 것 (문서만 있는 백업은 백업이 아님).

## 확장 순서 (필요해질 때, 이 순서로)

1. 느린 쿼리 → 인덱스
2. 백엔드 컨테이너 늘리면 DB 연결 수 → PgBouncer
3. Postgres 램 배정 (`shared_buffers` 16GB 정도면 DB 대부분이 메모리에)
4. 읽기 복제본
5. 조회 캐시 (Redis)
6. ai 서비스 복제 (OCR·임베딩 부하 시) — Spring과 독립적으로 늘릴 수 있음
7. 병목 하나만 분리 (예상: 이미지 처리 → 검색)
8. 서버 2대 이상 → 그때 K8s 재검토

## 확정된 것 (2026-09-18)
- Java 21, Spring Boot 3.x
- 1단계 결제 없음 (채팅 직거래)
- 지역 개념 없음 (regions 테이블 없음)
- staging은 1단계에 없음. local + production

## 미정
- 챗봇 조회 함수 목록
- 견적서 샘플 형식
- 회선 업로드 속도 (파일 서빙은 업로드 방향. Cloudflare 캐시로 완화)
