# 타일 큐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 화면 전환을 타일 큐 하나로 — 같은 화면은 제자리, 연관 화면은 큐(최대 3칸, 가득 차면 가장 오래된 칸 빠짐), 연관 없으면 리셋. 모든 칸 닫기, 새로고침 복원.

**Architecture:** 판단은 전부 `lib/`의 순수 함수(화면 표, 큐 상태 전이, 링크·폼 판별)로 두고 Vitest로 덮는다. `TileWorkspaceContext`가 문서 전체의 클릭·GET 폼 제출을 캡처해 순수 함수에 묻고, 결과로 칸 목록과 라우터를 맞춘다. 칸 목록 `panes`(오래된 순, `panes[0]` = 주소창 칸)는 sessionStorage에 저장한다.

**Tech Stack:** Next.js 16 App Router(client 컴포넌트, `useRouter`·`useSearchParams`), React 19 `useSyncExternalStore`, Vitest. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-01-tile-queue-design.md`

## Global Constraints

- 최대 칸 3. 배치: 1칸 전체 / 2칸 1:1 / 3칸 `panes[0]` 왼쪽 1/2, `panes[1]` 오른쪽 위 1/4, `panes[2]` 오른쪽 아래 1/4. 새 칸은 맨 뒤(오른쪽 아래).
- 분할은 화면 폭 768 이상만 (`(min-width: 768px)`). 미만이면 주소창 칸만.
- 로고는 항상 리셋 (`data-tile="reset"`).
- sessionStorage 키 `tile-panes`. 읽기·쓰기 예외는 삼키고 복원 없이 동작.
- postMessage 출처 `"market-tile"`, 같은 origin만 받는다.
- 화면 코드는 일반 `<Link>`·`<form>` 그대로. 화면마다 분할 코드를 두지 않는다.
- 문구는 `src/messages/`. 닫기 aria-label은 기존 `common.tileClose`.
- 프론트 검증은 매 태스크 `pnpm typecheck && pnpm lint && pnpm test` 셋 다.
- 커밋: `feat(frontend): …`/`refactor(frontend): …`/`docs: …`, 본문은 한국어로 "왜", 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Ctrl/⌘/Shift/가운데 클릭, `target="_blank"`, `download`, 다른 출처 링크 → 엔진이 가로채지 않고 브라우저 기본 동작. → Task 3 테스트
2. 지금 칸과 같은 주소(쿼리까지) 링크 클릭 → 칸이 늘거나 리셋되지 않음 (제자리, 변화 없음). → Task 2 테스트
3. sessionStorage 값이 깨졌거나 다른 형식 → 예외 없이 주소창 칸 하나로 시작. → Task 2 테스트
4. 뒤로가기로 다른 화면이 주소창에 오면 → 다른 칸이 남아 엉뚱하게 붙지 않고 리셋. → Task 2 테스트
5. 이미 다른 칸에 열린 화면을 또 열면 → 같은 화면이 두 칸이 되지 않고 그 칸이 새 경로로 바뀜. → Task 2 테스트

---

### Task 1: 화면 표

**Files:**
- Create: `frontend/src/lib/tileScreens.ts`
- Test: `frontend/src/lib/tileScreens.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TileGroup = "common" | "buy" | "sell";
  export interface Screen { id: string; group: TileGroup | null }
  /** path는 쿼리·해시가 붙어 있어도 된다. 표에 없으면 { id: pathname, group: null } */
  export function screenOf(path: string): Screen;
  /** 새 화면이 열린 화면들과 연관 있는가 (스펙 "열기 규칙" 2번 정의) */
  export function isRelated(target: Screen, open: readonly Screen[]): boolean;
  ```
  표 내용은 스펙 "화면 표" 그대로. 구체적 경로가 먼저 맞도록 배열 순서로 매칭.

- [ ] **Step 1: 브랜치 확인** — `git branch --show-current` → `feat/tile-queue`.
- [ ] **Step 2: 실패하는 테스트**
  - `screenOf("/")` → `{ id: "home", group: "common" }`; `"/login/find-id"` → login/common; `"/signup/personal/form?x=1"` → signup/common
  - `"/search?q=LM"` → search/buy; `"/quotes"` → buyQuotes/buy; `"/quotes/adjust"` → sellQuote/sell
  - `"/listings/new"` → sellNew/sell; `"/listings/extra"` → sellExtra/sell; `"/listings/u1/20261001090000"` → listingDetail/common
  - 표에 없음: `"/prices"` → `{ id: "/prices", group: null }`; `"/prices?x#y"` → id `"/prices"`
  - `isRelated`: common 대상 → 항상 true; buy 대상 + 열린 [home, search] → true; sell 대상 + 열린 [home, search] → false; buy 대상 + 열린 [home, login] → true; group null 대상 + 열린 [home] → false; group null 대상 + 열린 [같은 id 화면] → true
- [ ] **Step 3: 실패 확인** — `pnpm test src/lib/tileScreens.test.ts` → FAIL (모듈 없음)
- [ ] **Step 4: 구현** — 경로 매칭은 정규식 배열 (`/^\/listings\/[^/]+\/[^/]+$/` 등). `/quotes`는 `^\/quotes$`, `/requests`는 `^\/requests(\/.*)?$`.
- [ ] **Step 5: 통과 확인** + `pnpm typecheck && pnpm lint`
- [ ] **Step 6: 커밋** — `feat(frontend): 타일 큐 화면 표 — 화면·그룹 판단`

### Task 2: 큐 상태 전이

**Files:**
- Create: `frontend/src/lib/tileQueue.ts`
- Test: `frontend/src/lib/tileQueue.test.ts`

**Interfaces:**
- Consumes: `screenOf`, `isRelated` (Task 1)
- Produces:
  ```ts
  export const MAX_PANES = 3;
  export const STORAGE_KEY = "tile-panes";
  export interface Pane { key: string; path: string }
  export type OpenAction =
    | { kind: "none" }                                   // 이미 그 주소
    | { kind: "inPlace"; paneKey: string; path: string } // 같은 화면: 그 칸에서 이동
    | { kind: "replace"; paneKey: string; path: string } // 같은 화면이 다른 칸에 있음: 그 칸을 바꿈
    | { kind: "push"; path: string }                     // 연관: 맨 뒤에 추가
    | { kind: "reset"; path: string };                   // 연관 없음·로고·좁은 화면
  export function decideOpen(panes: readonly Pane[], fromKey: string, path: string, opts: { reset: boolean; wide: boolean }): OpenAction;
  /** newKey는 push·reset에서 새 칸 key. push로 MAX_PANES를 넘으면 panes[0]을 뺀다 */
  export function applyOpen(panes: readonly Pane[], action: OpenAction, newKey: string): Pane[];
  export function closePane(panes: readonly Pane[], key: string): Pane[];
  /** 주소창 경로가 바뀌었을 때(스펙 "주소창 칸 경로 동기화") */
  export function syncMainPath(panes: readonly Pane[], fullPath: string, newKey: string): Pane[];
  export function serializePanes(panes: readonly Pane[]): string;
  /** 저장값의 panes[0].path가 currentPath와 같을 때만 복원. 아니면·깨졌으면 null */
  export function restorePanes(raw: string | null, currentPath: string): Pane[] | null;
  ```
  판단 순서(`decideOpen`): `reset` 옵션 → reset / from 칸 경로와 같음 → none / from 칸과 같은 화면 → inPlace / 다른 칸과 같은 화면 → replace / `wide`가 false → reset / `isRelated(target, 열린 칸 화면들)` → push / 그 외 reset.

- [ ] **Step 1: 실패하는 테스트** (`P = (key, path) => ({ key, path })`)
  - decideOpen: `[P("a","/")]`, from a, `"/login"`, wide → `{ kind: "push", path: "/login" }`
  - 같은 주소: `[P("a","/search?q=1")]`, from a, `"/search?q=1"` → `{ kind: "none" }` (Review Focus 2)
  - 같은 화면: `[P("a","/signup")]`, from a, `"/signup/personal/form"` → inPlace a
  - 다른 칸에 같은 화면: `[P("a","/"), P("b","/login")]`, from a, `"/login/find-id"` → replace b (Review Focus 5)
  - 연관 없음: `[P("a","/"), P("b","/search")]`, from a, `"/listings/new"` → reset
  - 표에 없는 화면: `[P("a","/")]`, from a, `"/prices"` → reset
  - 로고: `opts.reset: true` → reset `/`
  - 좁은 화면: `[P("a","/")]`, from a, `"/login"`, wide false → reset
  - applyOpen push 3칸 가득: `[a:/, b:/login, c:/signup]` + push `/search` key d → `[b, c, d:/search]`
  - applyOpen push 2칸: `[a, b]` + push → `[a, b, new]`; reset → `[new]`; inPlace → 그 칸 key 그대로 path만 바뀜; replace → 그 칸 key가 newKey로 바뀌고 path도 바뀜 (iframe을 새 경로로 다시 마운트하려고)
  - closePane: 3칸에서 a 닫기 → `[b, c]`; 가운데 b → `[a, c]`; 마지막 칸 닫기 시도(1칸) → 그대로
  - syncMainPath: `[a:"/search?q=1", b]` + `"/search?q=2"` → `[a:"/search?q=2", b]`; `[a:"/", b]` + `"/"` → 그대로(같은 참조 아니어도 내용 같음); `[a:"/", b:"/login"]` + `"/listings/new"` (뒤로가기 등) → `[new:"/listings/new"]` (Review Focus 4)
  - restorePanes: 저장 `[a:"/", b:"/login"]`, 현재 `"/"` → 그대로; 현재 `"/search"` → null; `"not json"`·`'{"x":1}'`·`'[{"key":1}]'`·`null` → null (Review Focus 3); 4칸 이상 저장값 → null
- [ ] **Step 2: 실패 확인** — `pnpm test src/lib/tileQueue.test.ts` → FAIL
- [ ] **Step 3: 구현** — 순수 함수, 입력 배열을 바꾸지 않는다. `restorePanes`는 `JSON.parse` 예외를 잡고, 각 원소가 `{ key: string, path: string }`인지 확인.
- [ ] **Step 4: 통과 확인** + `pnpm typecheck && pnpm lint`
- [ ] **Step 5: 커밋** — `feat(frontend): 타일 큐 상태 전이 — 제자리·교체·추가·리셋, 닫기, 주소 동기화, 복원`

### Task 3: 링크·폼 판별

**Files:**
- Create: `frontend/src/lib/tileNavigation.ts`
- Test: `frontend/src/lib/tileNavigation.test.ts`

**Interfaces:**
- Produces (DOM 타입 대신 필요한 필드만 받아 node 환경에서 테스트):
  ```ts
  export interface ClickInfo { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }
  export interface AnchorInfo { href: string; target: string; hasDownload: boolean; tileReset: boolean }
  export interface FormInfo { method: string; action: string; hasFunctionAction: boolean; entries: [string, string][] }
  export type Intercept = { path: string; reset: boolean } | null;
  /** 엔진이 가로챌 링크 클릭이면 경로(쿼리·해시 포함, origin 제외), 아니면 null */
  export function linkIntercept(click: ClickInfo, anchor: AnchorInfo, origin: string): Intercept;
  /** GET 폼 제출이면 action + 입력값 쿼리 경로, 아니면 null */
  export function formIntercept(form: FormInfo, origin: string): Intercept;
  ```
- [ ] **Step 1: 실패하는 테스트**
  - 일반 왼쪽 클릭, `href: "http://h/login"`, origin `"http://h"` → `{ path: "/login", reset: false }`
  - `tileReset: true` → reset true
  - button 1, metaKey, ctrlKey, shiftKey, altKey 각각 → null; `target: "_blank"` → null; `hasDownload` → null; 다른 출처 → null; `defaultPrevented` → null; `href: "http://h/a#x"` → path `"/a#x"`; `href: "mailto:x"` → null (Review Focus 1)
  - 폼: method `"get"`, action `"http://h/search"`, entries `[["q","LM"],["field","all"]]` → `{ path: "/search?q=LM&field=all", reset: false }`; method `"post"` → null; `hasFunctionAction` → null; 다른 출처 action → null; 빈 값 entries도 그대로(`q=`)
- [ ] **Step 2: 실패 확인** → FAIL
- [ ] **Step 3: 구현** — `new URL(href)`로 origin 비교, `pathname + search + hash` 반환.
- [ ] **Step 4: 통과 확인** + typecheck·lint
- [ ] **Step 5: 커밋** — `feat(frontend): 타일 큐 링크·폼 가로채기 판별`

### Task 4: 엔진 연결 (Context·배치·iframe·로고)

**Files:**
- Modify: `frontend/src/components/common/TileWorkspaceContext.tsx` (상태를 `panes`로, 아래 Produces)
- Modify: `frontend/src/components/common/TileWorkspace.tsx` (배치·주소창 칸 닫기)
- Modify: `frontend/src/components/common/TileFrame.tsx` (`open` 메시지 처리, 경로 보고 그대로)
- Modify: `frontend/src/hooks/useReportTilePathname.ts` → iframe 안 가로채기도 여기서(또는 새 훅 `useTileIntercept`)
- Modify: `frontend/src/components/common/Header.tsx` (로고 `<Link>`에 `data-tile="reset"`)
- Create: `frontend/src/hooks/useIsWide.ts` (`useSyncExternalStore` + `matchMedia("(min-width: 768px)")`, 서버 스냅샷 false)
- Delete: `frontend/src/lib/tileWorkspace.ts`, `frontend/src/lib/tileWorkspace.test.ts`, `frontend/src/components/common/TileLink.tsx`

**Interfaces:**
- Consumes: Task 1~3 전부
- Produces (`useTileWorkspace()`):
  ```ts
  { panes: Pane[]; wide: boolean; open: (fromKey: string, path: string, reset: boolean) => void; close: (key: string) => void; updatePath: (key: string, path: string) => void }
  ```
- 동작 (스펙 그대로, 결정 필요한 부분만):
  - 첫 렌더 `panes = [{ key: "main", path: 현재 fullPath }]`. 마운트 후 `restorePanes(sessionStorage.getItem(STORAGE_KEY), fullPath)`가 있으면 교체. `panes`가 바뀔 때마다 `serializePanes` 저장. 둘 다 try/catch.
  - 부모 문서(`!framed`)에서 `document`에 캡처 단계 `click`·`submit` 리스너 → `linkIntercept`/`formIntercept` → 값이 있으면 `preventDefault()` 후 `open(panes[0].key, path, reset)`. 헤더 클릭도 주소창 칸 기준.
  - `open`: `decideOpen` → `applyOpen` → 결과의 `panes[0].path`가 이전과 다르면 `router.push(새 panes[0].path)`. inPlace가 주소창 칸이면 `router.push(path)`. inPlace는 주소창 칸에서만 온다(iframe 안의 같은 화면 이동은 iframe이 스스로 함). replace는 applyOpen이 key를 바꿔 주므로 TileFrame이 새 경로로 다시 마운트된다.
  - `close(key)`: `closePane` → 주소창 칸을 닫았으면 `router.replace(새 panes[0].path)`.
  - 주소창 경로 변화(`useCurrentFullPath`, Suspense 안) → `syncMainPath`.
  - iframe 안(`framed`): 같은 캡처 리스너. 대상 화면이 자기 화면과 같으면 가로채지 않음(Next가 iframe 안에서 이동). 다르면 `preventDefault()` 후 `window.top.postMessage({ source: "market-tile", type: "open", path, reset }, origin)`.
  - TileFrame: 기존 `pathname` 보고 + `type: "open"` 메시지면 `open(tile.key, path, reset)`.
  - TileWorkspace: `wide && !framed`일 때만 2·3칸 그리드. 칸이 2개 이상이면 주소창 칸 오른쪽 위에도 닫기(TileFrame 닫기 버튼과 같은 모양). 3칸 = 왼쪽 `panes[0]`, 오른쪽 위 `panes[1]`, 아래 `panes[2]`.
- [ ] **Step 1: 구현** (위 동작)
- [ ] **Step 2: 검증** — `pnpm typecheck && pnpm lint && pnpm test`. `pnpm dev` 1280px:
  - 홈 → 헤더 로그인 → 홈 | 로그인; 로그인 칸에서 회원가입 → 홈 | 로그인 / 가입; 홈 검색 → 로그인 | 가입 / 검색 (홈 빠짐, 주소창 = /login)
  - 주소창 칸 닫기 → 다음 칸이 주소창으로; iframe 칸 닫기
  - 새로고침 → 같은 구성; 주소 직접 입력 → 전체화면
  - 로고 → 홈 전체화면
  - 390px: 분할 없음, 링크는 그냥 이동
  - Ctrl+클릭 → 새 탭
- [ ] **Step 3: 커밋** — `feat(frontend): 모든 링크·검색 제출을 타일 큐로 — 화면별 분할 대신 엔진 하나`

### Task 5: 로그인·가입 전용 분할 걷어내기

**Files:**
- Modify: `frontend/src/components/auth/AuthSplitShell.tsx` → 한 칸(가운데 카드)만 그리는 `AuthShell`로 이름 변경 (`git mv`), 홈 칸·위 칸 쌓기·닫기 제거
- Modify: `frontend/src/app/(auth)/layout.tsx`
- Delete: `frontend/src/lib/authSplit.ts`, `frontend/src/lib/authSplit.test.ts`, `frontend/src/components/auth/HomeAuthPane.tsx`
- [ ] **Step 1: 구현** — `AuthShell`은 기존 오른쪽 칸 마크업(`section` + `max-w-[560px] my-auto`)만.
- [ ] **Step 2: 검증** — typecheck·lint·test. `pnpm dev`: 로그인 전체화면에서 회원가입 → 로그인 | 가입 (Task 4 엔진), 가입 단계 이동은 제자리, `/login` 직접 접속 → 로그인 한 칸.
- [ ] **Step 3: 커밋** — `refactor(frontend): 로그인·가입 전용 분할 제거 — 타일 큐가 맡음`

### Task 6: 문서

- Modify: `docs/superpowers/specs/2026-09-29-tile-workspace-design.md` 상단 상태 줄에 "일부 대체 → 2026-10-01 타일 큐 스펙" 추가
- Modify: `docs/design.md` — "헤더" 항목의 분할 설명을 타일 큐 기준으로(768 이상 분할, 모든 칸 닫기, 새 칸 오른쪽 아래)
- [ ] **Step 1: 수정** (한글 파일 국소 편집) → **Step 2: 커밋** `docs: 타일 큐 반영`

### 마무리

- [ ] 최종 `pnpm typecheck && pnpm lint && pnpm test`, 푸시, PR(본문: 무엇을·왜·확인 방법, PR #23과의 관계 — #23 머지 후 검색 화면 폼 동작 확인 필요), `/code-review`.
