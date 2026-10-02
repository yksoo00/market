---
paths:
  - "frontend/**"
---

# Frontend (Next.js App Router, TypeScript)

## 구조
```
frontend/src/
├── app/            라우트. 페이지 컴포넌트는 얇게 (데이터 가져오기 + 조립)
├── components/     ui/ (shadcn 원본), common/, 도메인별 (listing/, ...)
├── lib/            api 클라이언트, auth, utils
├── hooks/
├── messages/       사용자에게 보이는 문구
└── types/          API 응답 타입 (백엔드 DTO와 1:1)
```

## 컨벤션
- TypeScript strict. `any` 금지. API 응답은 `types/`에 정의된 타입으로만.
- 컴포넌트는 named export, 파일명 PascalCase. Props 타입 명시.
- 서버 컴포넌트 기본. `"use client"`는 상호작용·상태가 필요한 잎 컴포넌트에만.
- 데이터 가져오기: SSR은 SEO가 필요한 목록·상세만. 나머지는 클라이언트에서 `lib/api` 경유. 예외: 매물 상세는 아직 SEO 요구가 없어 클라이언트 조회 (`docs/decisions.md` 2026-10-02 매물 상세, 재검토 조건 거기).
- `lib/api`가 유일한 백엔드 호출 지점. 컴포넌트에서 `fetch` 직접 호출 금지. access token 갱신은 여기서 처리.
- 스타일은 Tailwind 클래스만. 인라인 style, CSS 모듈 금지. 색·간격은 `src/app/globals.css` `@theme` 토큰(`docs/design.md` 기준).
- shadcn/ui 컴포넌트를 먼저 찾고, 없을 때만 새로 만든다.
- 폼은 react-hook-form + zod. 스키마는 `lib/validation/`에 두고 `docs/security.md` "입력 검증"의 길이·범위 수치와 동일하게. 백엔드 규칙이 바뀌면 같은 PR에서 맞춘다.
- 검증 반응 (모든 폼 공통):
  - 필드를 벗어날 때(blur) 검증, 오류 나면 그 필드 아래 빨간 문구 + 테두리 색. 입력 중 고쳐지면 즉시 사라짐.
  - 제출 버튼은 필수값이 비었거나 오류가 있으면 비활성. 제출 중에는 스피너 + 중복 제출 방지.
  - 서버가 `{ ok: false, code, fields: { name: "message" } }`를 돌려주면 해당 필드에 그 문구를 붙인다. 필드를 못 찾으면 폼 상단에 표시.
  - 네트워크·5xx는 폼 상단 안내 + 재시도. 입력값은 지우지 않는다.
  - 오류 문구는 "무엇이 왜 틀렸고 어떻게 고치나". 예: "가격은 0원 이상 10억 원 이하로 입력하세요". `messages/`에 모아둔다.
  - 파일 업로드: 선택 즉시 형식·크기 검사, 실패하면 업로드 시작 전에 알림.

## 화면 규칙
- 모바일(390px) 먼저 확인, 그다음 데스크톱.
- 모든 목록에 빈 상태·로딩·에러 상태 UI. 백엔드 장애 시 "연결할 수 없습니다" + 재시도.
- 이미지는 `next/image`, alt 필수. 버튼·링크에 접근 가능한 이름. 예외: API 서버의 업로드 파일(`lib/files.ts` `fileUrl`)은 `next/image` 원격 호스트 설정 없이 `<img>` + 해당 줄 lint 예외 주석.
- 가격은 `formatPrice()` 헬퍼로만 표시.

## 테스트
- Vitest: `lib/`, `hooks/` 단위. Playwright: 핵심 흐름 (가입→로그인→상품 등록) 최소 1개.

## 하지 말 것
- `localStorage`에 access token 저장. httpOnly 쿠키로.
- 환경변수를 `NEXT_PUBLIC_`로 노출할 때 비밀값 포함.
- 페이지 컴포넌트에 비즈니스 로직.
