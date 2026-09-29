# 타일 워크스페이스 (Tile Workspace) 설계

날짜: 2026-09-29
상태: 설계 승인 대기

## 배경 / 목적

사용자가 페이지 이동을 최소화하며 연속된 작업을 편리하게 이어갈 수 있도록, 연관된 페이지를 화면 분할로 계속 띄워두는 기능. 전체화면 단일 페이지 → (연관 페이지 클릭) 50/50 분할 → (또 연관 페이지 클릭) 좌측 1/2 + 우측 1/4 + 1/4 3분할. 연관 없는 페이지로 이동하면 그 페이지가 새 전체화면으로 리셋된다.

데스크톱 전용 (모바일은 화면이 작아 분할 의미 없음, 기존 네비게이션 유지).

## 범위 / 전제

- 현재 frontend는 home(mock)·로그인·가입 화면만 존재. listing/chat 등 실제로 타일링할 도메인 페이지는 아직 없음.
- 이 스펙은 타일 워크스페이스 "엔진"만 다룬다. 어떤 페이지가 서로 "연관"인지는 각 도메인 페이지 구현 시점에 `TileLink`를 쓸지 말지로 결정한다 (이 스펙 밖).
- 브라우저 주소창은 하나뿐이므로 "타일마다 실제 URL"은 세 개 주소창을 동시에 갖는다는 뜻이 아니다. 메인 타일의 경로만 주소창에 반영한다.

## 아키텍처

- **메인 (좌측, 1/2 또는 전체)**: 지금 Next.js 라우터가 렌더링하는 실제 페이지. 주소창 = 메인 경로.
- **서브 타일 (우측, 최대 2개, 각 1/4)**: `<iframe src="해당 경로">`.
  - 이유: App Router 페이지는 Server Component일 수 있어 클라이언트에서 임의로 동적 import해 그릴 수 없다. iframe을 쓰면 서버 렌더링·데이터 fetch·클라이언트 상호작용이 해당 페이지 그대로 동작하고, Next.js 라우팅 내부를 우회하거나 건드릴 필요가 없다.
  - same-origin이므로 세션 쿠키 그대로 적용됨 (로그인 필요한 페이지도 별도 처리 불필요).
  - **주의**: `docs/security.md` 확인 결과 현재 X-Frame-Options/CSP frame-ancestors 미설정. 추후 보안 헤더 추가 시 same-origin(`'self'`) 프레이밍은 허용해야 이 기능이 깨지지 않는다. 헤더 추가 작업 시 `docs/security.md`에 이 의존성을 남긴다.

## 상태 모델

전역 Context 하나, `app/layout.tsx`에 배치하는 클라이언트 컴포넌트 `TileWorkspaceProvider`가 소유.

```ts
type SecondaryTile = { path: string; key: string };
type TileWorkspaceState = {
  secondary: SecondaryTile[]; // 최대 2개. [0] = 최신, [1] = 이전
};
```

메인은 Context에 담지 않는다 — Next.js 라우터 자체가 메인 상태를 갖는다 (주소창 경로 = 메인).

## 전환 규칙

- **일반 `<Link>` 클릭** (비연관): 전체 리셋. `secondary`를 비우고 해당 경로로 라우터 이동 → 새 메인이 단독 전체화면.
- **`<TileLink>` 클릭** (연관 페이지 전용):
  - `secondary` 0개 → 1개: 50/50 (메인 1/2, 새 타일 1/2)
  - `secondary` 1개 → 2개: 3분할 (메인 1/2, 새 타일 우상단 1/4, 기존 타일 우하단 1/4)
  - `secondary` 2개 (가득): 새 타일이 우상단 차지, 기존 우상단 → 우하단, 기존 우하단 제거 (FIFO, `secondary` 배열 앞에 새 항목 unshift 후 slice(0,2))
- **서브 타일 호버 컨트롤** (코너 아이콘, 평소 숨김):
  - 확대: 그 타일의 최신 경로로 메인을 라우터 이동시키고, 기존 메인 경로는 그 타일이 있던 자리로 들어감 (자리 스왑)
  - 닫기(X): `secondary`에서 제거, 나머지는 앞으로 당김
- **서브 타일 내부 네비게이션**: iframe 안에서의 링크 클릭은 iframe 자체 히스토리에서만 처리되고 부모 상태를 바꾸지 않는다. iframe은 자신의 현재 pathname을 `postMessage`로 부모에 보고하고, 부모는 이를 저장해 "확대" 시 최신 경로로 이동한다.
- **서브 타일 안에서 또 TileLink 클릭**: 이번 스펙 범위에서는 무시(자기 자신 안에서만 이동), 3분할 확장은 메인 컨텍스트에서만 일어난다. 필요성이 확인되면 이후 postMessage로 부모에 위임하는 확장을 검토한다.

## 컴포넌트 구조

- `TileWorkspaceProvider` — Context, `app/layout.tsx`
- `TileWorkspace` — client component. `app/layout.tsx`에서 `children`(메인)을 감싸 그리드로 배치 (1/2/3분할 CSS grid), `secondary` 상태에 따라 `TileFrame` 렌더
- `TileFrame` — 서브 타일 하나: iframe + 호버 컨트롤
- `TileLink` (`components/common/TileLink.tsx`) — Link 감싸서 클릭 시 context에 push
- 서브 타일 내부 페이지(iframe 안)에서 pathname 보고용 훅 하나 (`useReportTilePathname`, root layout에서 `window.self !== window.top`일 때만 동작)

## 레이아웃 (CSS)

- 1개(메인만): 전체화면
- 2개(메인+서브1): grid 2열 50/50
- 3개(메인+서브2): grid, 좌측 컬럼 1/2 폭 전체높이, 우측 컬럼 1/2 폭을 상하 50/50 (1/4, 1/4)

## 엣지케이스

- iframe 안 로그인 필요 페이지: same-origin 쿠키로 인증 그대로 통과, 추가 처리 불필요.
- F5 새로고침: `secondary` 상태 소실, 메인만 남음. 합의된 트레이드오프 (클라이언트 상태만이라 새로고침 시 초기화됨). 공유 링크로 3분할 복원은 지원하지 않는다.
- iframe 로드 실패(대상 페이지가 프레이밍 거부 등): 타일 안에 에러 표시, 닫기 버튼으로 제거 가능해야 함.

## 테스트

- `TileWorkspaceProvider` 상태 전환 로직: Vitest 단위 테스트로 0→1→2→3 전환, FIFO 교체, 리셋 케이스 검증
- `TileLink`, `TileFrame`: RTL로 클릭 시 context 업데이트 확인
- iframe 실제 렌더링과 postMessage 왕복은 단위테스트로 한계 있음 → 수동 확인 항목으로 남긴다 (구현 완료 후 실제 두 페이지로 브라우저 수동 검증)

## 이후 논의 필요 (이 스펙 범위 밖)

- 실제로 어떤 페이지 쌍이 "연관"인지는 listing/chat 도메인 페이지 구현 시점에 결정 (`TileLink` 채택 여부는 해당 PR에서 판단)
- 보안 헤더(X-Frame-Options/CSP) 추가 시 same-origin 프레이밍 허용 필요 — `docs/security.md` 갱신 필요
