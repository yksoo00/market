---
paths:
  - "frontend/**"
---

# Frontend (Next.js App Router, TypeScript)

## 구조
```
frontend/src/
├── app/            라우트. 페이지 컴포넌트는 얇게 (데이터 가져오기 + 조립)
├── components/     ui/ (shadcn 원본), common/, 도메인별 (listing/, chat/, ...)
├── lib/            api 클라이언트, auth, utils
├── hooks/
├── messages/       사용자에게 보이는 문구
└── types/          API 응답 타입 (백엔드 DTO와 1:1)
```

## 컨벤션
- TypeScript strict. `any` 금지. API 응답은 `types/`에 정의된 타입으로만.
- 컴포넌트는 named export, 파일명 PascalCase. Props 타입 명시.
- 서버 컴포넌트 기본. `"use client"`는 상호작용·상태가 필요한 잎 컴포넌트에만.
- 데이터 가져오기: SSR은 SEO가 필요한 목록·상세만. 나머지는 클라이언트에서 `lib/api` 경유.
- `lib/api`가 유일한 백엔드 호출 지점. 컴포넌트에서 `fetch` 직접 호출 금지. access token 갱신은 여기서 처리.
- 스타일은 Tailwind 클래스만. 인라인 style, CSS 모듈 금지. 색·간격은 `tailwind.config` 토큰(`docs/design.md` 기준).
- shadcn/ui 컴포넌트를 먼저 찾고, 없을 때만 새로 만든다.
- 폼은 react-hook-form + zod. 서버 검증과 같은 규칙.

## 화면 규칙
- 모바일(390px) 먼저 확인, 그다음 데스크톱.
- 모든 목록에 빈 상태·로딩·에러 상태 UI. 백엔드 장애 시 "연결할 수 없습니다" + 재시도.
- 이미지는 `next/image`, alt 필수. 버튼·링크에 접근 가능한 이름.
- 가격은 `formatPrice()` 헬퍼로만 표시.

## 채팅
- WebSocket은 `hooks/useChatSocket`. 끊기면 자동 재접속 후 `lastMessageId` 이후를 REST로 재조회.
- 낙관적 전송 → 서버 확인 후 확정. 중복 메시지는 `clientMessageId`로 제거.

## 테스트
- Vitest: `lib/`, `hooks/` 단위. Playwright: 핵심 흐름 (가입→로그인→상품 등록→채팅) 최소 1개.

## 하지 말 것
- `localStorage`에 access token 저장. httpOnly 쿠키로.
- 환경변수를 `NEXT_PUBLIC_`로 노출할 때 비밀값 포함.
- 페이지 컴포넌트에 비즈니스 로직.
