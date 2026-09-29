# 타일 워크스페이스 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전체화면 ↔ 50/50 분할 ↔ 3분할(좌 1/2, 우상 1/4, 우하 1/4) 로 전환되는 타일 워크스페이스를 구현하고, 연관 페이지(`TileLink`)는 타일 유지, 비연관 페이지(일반 `Link`)는 전체화면으로 리셋되게 한다.

**Architecture:** 메인은 실제 Next.js 라우터가 그리는 페이지(주소창 반영). 서브 타일 최대 2개는 `<iframe>`으로 같은 오리진의 다른 경로를 그린다 (App Router 페이지가 Server Component일 수 있어 클라이언트에서 직접 임베드 불가하기 때문). 전역 `TileWorkspaceProvider`가 서브 타일 배열 상태를 갖고, `usePathname()` 변화를 감지해 (승격 액션이 아닌 이상) 자동으로 서브 타일을 비운다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind (기존 스택만 사용, 신규 의존성 없음).

**Spec:** `docs/superpowers/specs/2026-09-29-tile-workspace-design.md`

## Global Constraints

- 데스크톱 전용 기능. 모바일 분기·레이아웃 변경 없음.
- 서브 타일은 최대 2개, 배열 순서 `[최신, 이전]`.
- 서브 타일은 `<iframe>`으로 렌더링한다 (Server Component 제약).
- 메인 경로만 주소창에 반영한다. F5 새로고침 시 서브 타일 소실은 합의된 트레이드오프이며 별도 복구 로직을 만들지 않는다.
- TypeScript strict, `any` 금지.
- 스타일은 Tailwind 클래스만. 인라인 `style` 금지.
- 사용자 노출 문구는 `frontend/src/messages/`에 추가한다. 컴포넌트에 하드코딩 금지.
- 신규 npm 의존성 추가 금지. 특히 `vitest.config.mts` 주석대로 jsdom·testing-library는 상의 후에만 추가 가능 — 이 플랜에서는 추가하지 않는다.
- Vitest는 `src/**/*.test.ts`만 실행 (node environment). React 컴포넌트 렌더 테스트는 만들지 않는다. 컴포넌트 동작은 수동으로 dev 서버에서 확인한다.
- import는 `@/` 별칭 사용 (기존 컨벤션).

## Review Focus

- 서브 타일을 닫아서 1개만 남을 때 레이아웃이 50/50으로 자동 축소되는가 (배열 길이 기반 그리드 재계산) — Task 1, Task 4
- 이미 떠 있는 경로를 `TileLink`로 다시 클릭하면 중복 타일이 새 항목으로 허용되는가 (기존 항목을 찾아 승격하지 않음) — Task 1
- 서브 타일 안에서 다른 경로로 이동한 뒤 "확대"를 누르면 최초 경로가 아니라 iframe이 postMessage로 보고한 최신 경로로 승격되는가 — Task 5 (수동 확인)
- `TileLink`에서 ctrl/cmd/shift/middle-click 시 브라우저 기본 동작(새 탭 열기 등)이 막히지 않는가 — Task 6 (수동 확인)
- iframe 로드 실패(프레이밍 거부 등) 시 에러가 표시되고 닫기 버튼으로 제거 가능한가 — Task 5 (수동 확인)

---

### Task 1: 순수 타일 상태 모듈

**Files:**
- Create: `frontend/src/lib/tileWorkspace.ts`
- Test: `frontend/src/lib/tileWorkspace.test.ts`

**Interfaces:**
- Produces:
  - `type SecondaryTile = { path: string; key: string }`
  - `type TileWorkspaceState = { secondary: SecondaryTile[] }`
  - `const initialTileWorkspaceState: TileWorkspaceState`
  - `function openTileLink(state: TileWorkspaceState, path: string, key: string): TileWorkspaceState`
  - `function closeTile(state: TileWorkspaceState, key: string): TileWorkspaceState`
  - `function promoteTile(state: TileWorkspaceState, key: string, replacementPath: string, replacementKey: string): TileWorkspaceState`
  - `function resetTiles(): TileWorkspaceState`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import {
  initialTileWorkspaceState,
  openTileLink,
  closeTile,
  promoteTile,
  resetTiles,
} from "./tileWorkspace";

describe("openTileLink", () => {
  it("0개 -> 1개: 새 타일이 secondary[0]", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(s.secondary).toEqual([{ path: "/a", key: "k1" }]);
  });

  it("1개 -> 2개: 새 타일이 앞, 기존은 뒤", () => {
    const s0 = openTileLink(initialTileWorkspaceState, "/a", "k1");
    const s1 = openTileLink(s0, "/b", "k2");
    expect(s1.secondary).toEqual([
      { path: "/b", key: "k2" },
      { path: "/a", key: "k1" },
    ]);
  });

  it("2개 가득 -> FIFO: 새 타일 앞, 기존[0]은 뒤로, 기존[1] 제거", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    s = openTileLink(s, "/c", "k3");
    expect(s.secondary).toEqual([
      { path: "/c", key: "k3" },
      { path: "/b", key: "k2" },
    ]);
  });

  it("이미 떠 있는 경로를 다시 열면 중복 항목으로 추가된다", () => {
    const s0 = openTileLink(initialTileWorkspaceState, "/a", "k1");
    const s1 = openTileLink(s0, "/a", "k2");
    expect(s1.secondary).toEqual([
      { path: "/a", key: "k2" },
      { path: "/a", key: "k1" },
    ]);
  });
});

describe("closeTile", () => {
  it("해당 key 제거, 나머지는 순서 유지", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    const result = closeTile(s, "k2");
    expect(result.secondary).toEqual([{ path: "/a", key: "k1" }]);
  });

  it("없는 key는 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(closeTile(s, "none")).toEqual(s);
  });
});

describe("promoteTile", () => {
  it("해당 key 자리를 replacementPath/Key로 교체", () => {
    let s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    s = openTileLink(s, "/b", "k2");
    const result = promoteTile(s, "k2", "/old-main", "k-new");
    expect(result.secondary).toEqual([
      { path: "/old-main", key: "k-new" },
      { path: "/a", key: "k1" },
    ]);
  });

  it("없는 key면 상태 그대로 반환", () => {
    const s = openTileLink(initialTileWorkspaceState, "/a", "k1");
    expect(promoteTile(s, "none", "/x", "k-new")).toEqual(s);
  });
});

describe("resetTiles", () => {
  it("빈 상태를 반환", () => {
    expect(resetTiles()).toEqual({ secondary: [] });
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `pnpm --dir frontend test -- tileWorkspace`
Expected: FAIL (`tileWorkspace` 모듈 없음)

- [ ] **Step 3: `frontend/src/lib/tileWorkspace.ts` 구현**

각 함수는 불변 업데이트로 작성 (원본 state 변경 금지). `openTileLink`는 새 항목을 배열 앞에 추가 후 `slice(0, 2)`. `closeTile`은 `filter`. `promoteTile`은 `map`으로 일치하는 key만 교체, 못 찾으면 원본 반환. `resetTiles`는 항상 새 `{ secondary: [] }` 객체 반환.

- [ ] **Step 4: 테스트 실행해 통과 확인**

Run: `pnpm --dir frontend test -- tileWorkspace`
Expected: PASS (전체 케이스)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/lib/tileWorkspace.ts frontend/src/lib/tileWorkspace.test.ts
git commit -m "feat(frontend): 타일 워크스페이스 순수 상태 전환 로직 추가"
```

---

### Task 2: 프레임 감지 + pathname 보고 훅

**Files:**
- Create: `frontend/src/hooks/useIsFramed.ts`
- Create: `frontend/src/hooks/useReportTilePathname.ts`

**Interfaces:**
- Consumes: 없음 (React `usePathname` from `next/navigation`만 사용)
- Produces:
  - `function useIsFramed(): boolean` — 서버/최초 렌더는 항상 `false`, 마운트 후 `window.self !== window.top`이면 `true`로 갱신
  - `function useReportTilePathname(): void` — 현재 창이 iframe 안이면 `pathname`이 바뀔 때마다 `window.top`으로 `{ source: "market-tile", pathname }` postMessage 전송, 아니면 아무 것도 안 함

- [ ] **Step 1: `useIsFramed` 구현**

`useState(false)` + `useEffect(() => setFramed(window.self !== window.top), [])`. SSR에서는 `window`가 없으므로 반드시 `useEffect` 안에서만 접근.

- [ ] **Step 2: `useReportTilePathname` 구현**

```ts
"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function useReportTilePathname() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;
    window.top?.postMessage({ source: "market-tile", pathname }, window.location.origin);
  }, [pathname]);
}
```

- [ ] **Step 3: 타입체크로 확인 (단위 테스트 없음 — DOM/window 의존, node environment로 테스트 불가)**

Run: `pnpm --dir frontend typecheck`
Expected: 통과 (에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/hooks/useIsFramed.ts frontend/src/hooks/useReportTilePathname.ts
git commit -m "feat(frontend): 타일 iframe 감지 및 pathname 보고 훅 추가"
```

---

### Task 3: TileWorkspaceContext (Provider + 훅)

**Files:**
- Create: `frontend/src/components/common/TileWorkspaceContext.tsx`

**Interfaces:**
- Consumes: Task 1의 `SecondaryTile`, `TileWorkspaceState`, `initialTileWorkspaceState`, `openTileLink`, `closeTile`, `promoteTile`, `resetTiles` (충돌 방지 위해 `as` 별칭으로 import: 예 `openTileLink as openTileLinkState`)
- Produces:
  - `function TileWorkspaceProvider({ children }: { children: React.ReactNode }): JSX.Element`
  - `function useTileWorkspace(): { secondary: SecondaryTile[]; openTileLink: (path: string) => void; closeTile: (key: string) => void; promote: (key: string, replacementPath: string) => void }`
  - Provider 밖에서 `useTileWorkspace()` 호출 시 에러 throw ("TileWorkspaceProvider 안에서만 사용 가능")

- [ ] **Step 1: Context/Provider 구현**

`"use client"`. `usePathname()`, `useRouter()` (둘 다 `next/navigation`). `useState(initialTileWorkspaceState)`. `useRef(false)`를 `skipResetRef`로 사용.

`useEffect(() => { if (skipResetRef.current) { skipResetRef.current = false; return; } setState(resetTiles()); }, [pathname])` — 승격이 아닌 다른 이유로 메인 경로가 바뀌면(일반 `Link` 클릭 등) 서브 타일을 비운다.

`openTileLink(path)`: `setState(s => openTileLinkState(s, path, crypto.randomUUID()))`.
`closeTile(key)`: `setState(s => closeTileState(s, key))`.
`promote(key, replacementPath)`: `skipResetRef.current = true;` 먼저 설정한 뒤 `setState(s => promoteTileState(s, key, pathname, crypto.randomUUID()))`, 그다음 `router.push(replacementPath)`.

- [ ] **Step 2: 타입체크**

Run: `pnpm --dir frontend typecheck`
Expected: 통과

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/common/TileWorkspaceContext.tsx
git commit -m "feat(frontend): 타일 워크스페이스 Context/Provider 추가"
```

---

### Task 4: TileWorkspace 레이아웃 컴포넌트

**Files:**
- Create: `frontend/src/components/common/TileWorkspace.tsx`

**Interfaces:**
- Consumes: Task 2의 `useIsFramed`, `useReportTilePathname`. Task 3의 `TileWorkspaceProvider`, `useTileWorkspace`. Task 5의 `TileFrame` (아래에서 먼저 타입만 알고 작성 가능: `function TileFrame({ tile }: { tile: SecondaryTile }): JSX.Element`)
- Produces: `function TileWorkspace({ children }: { children: React.ReactNode }): JSX.Element`

- [ ] **Step 1: 프레임 분기 구현**

```tsx
"use client";
export function TileWorkspace({ children }: { children: React.ReactNode }) {
  const framed = useIsFramed();
  useReportTilePathname();
  if (framed) return <>{children}</>;
  return (
    <TileWorkspaceProvider>
      <TileGrid main={children} />
    </TileWorkspaceProvider>
  );
}
```

`TileGrid`는 같은 파일 안 내부 컴포넌트로 작성 (Provider 안에서만 `useTileWorkspace()` 호출 가능하므로).

- [ ] **Step 2: `TileGrid` 레이아웃 구현**

`useTileWorkspace().secondary`의 길이로 분기, 모두 Tailwind 그리드 클래스로만 (인라인 style 금지):
- 길이 0: `<div className="h-full w-full">{main}</div>`
- 길이 1: `<div className="grid grid-cols-2 h-full w-full">` 안에 main과 `<TileFrame tile={secondary[0]} />`
- 길이 2: 바깥 `grid grid-cols-2 h-full w-full`, 오른쪽 칸은 `grid grid-rows-2 h-full` 안에 `<TileFrame tile={secondary[0]} />`(위, 우상단) / `<TileFrame tile={secondary[1]} />`(아래, 우하단)

- [ ] **Step 3: 타입체크**

Run: `pnpm --dir frontend typecheck`
Expected: 통과 (이 시점엔 `TileFrame`이 아직 없으므로 Task 5 완료 후 다시 확인해도 됨 — import 에러만 없으면 진행)

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/common/TileWorkspace.tsx
git commit -m "feat(frontend): 타일 워크스페이스 그리드 레이아웃 추가"
```

---

### Task 5: TileFrame (서브 타일 + 호버 컨트롤)

**Files:**
- Create: `frontend/src/components/common/TileFrame.tsx`
- Modify: `frontend/src/components/common/Icon.tsx` (paths에 `expand`, `close` 추가)
- Modify: `frontend/src/messages/common.ts` (문구 추가)

**Interfaces:**
- Consumes: Task 1의 `SecondaryTile`. Task 3의 `useTileWorkspace()` (`promote`, `closeTile`).
- Produces: `function TileFrame({ tile }: { tile: SecondaryTile }): JSX.Element`

- [ ] **Step 1: `Icon.tsx`에 아이콘 추가**

`paths` 객체에 추가 (기존 항목 사이, 알파벳/의미 순서 유지 안 해도 됨 — 파일 끝에 추가):

```ts
expand: <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />,
close: <path d="M6 6l12 12M18 6L6 18" />,
```

- [ ] **Step 2: `messages/common.ts`에 문구 추가**

```ts
tileExpand: "확대",
tileClose: "닫기",
```

- [ ] **Step 3: `TileFrame` 구현**

`"use client"`. `useState(tile.path)`를 `currentPath`로 초기화. `useRef<HTMLIFrameElement>(null)`을 `iframeRef`로. `useState(false)`를 `loadError`로.

`useEffect`로 `window.addEventListener("message", handler)` 등록: `handler`는 `event.origin === window.location.origin && event.source === iframeRef.current?.contentWindow && event.data?.source === "market-tile"`일 때만 `setCurrentPath(event.data.pathname)`.

`<iframe ref={iframeRef} src={tile.path} onError={() => setLoadError(true)} className="h-full w-full border-0" />`를 감싸는 `<div className="group relative h-full w-full">` 안에 호버 컨트롤:

```tsx
<div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
  <button type="button" aria-label={t.tileExpand} onClick={() => promote(tile.key, currentPath)}>
    <Icon name="expand" size={16} />
  </button>
  <button type="button" aria-label={t.tileClose} onClick={() => closeTile(tile.key)}>
    <Icon name="close" size={16} />
  </button>
</div>
```

`loadError`가 `true`면 iframe 대신 에러 안내(`common.unreachable` 재사용) + 항상 보이는(호버 아님) 닫기 버튼을 렌더링.

- [ ] **Step 4: 타입체크**

Run: `pnpm --dir frontend typecheck`
Expected: 통과

- [ ] **Step 5: 수동 확인 (Review Focus 항목)**

`pnpm --dir frontend dev` 실행 후:
- 서브 타일 안에서 다른 링크로 이동한 뒤 확대 클릭 → 이동한 최신 경로로 메인이 바뀌는지 확인
- 존재하지 않는 경로를 강제로 서브 타일에 띄워 (임시로 `tile.path`를 잘못된 값으로 바꿔 테스트) 에러 UI와 닫기 동작 확인 후 원복

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/common/TileFrame.tsx frontend/src/components/common/Icon.tsx frontend/src/messages/common.ts
git commit -m "feat(frontend): 서브 타일(iframe) 컴포넌트와 호버 컨트롤 추가"
```

---

### Task 6: TileLink

**Files:**
- Create: `frontend/src/components/common/TileLink.tsx`

**Interfaces:**
- Consumes: Task 3의 `useTileWorkspace()` (`openTileLink`)
- Produces: `function TileLink({ href, children, ...rest }: { href: string; children: React.ReactNode } & Omit<React.ComponentProps<typeof Link>, "href">): JSX.Element`

- [ ] **Step 1: 구현**

`"use client"`. 내부적으로 `next/link`의 `<Link href={href} {...rest}>`를 렌더링하되 `onClick`에서: 수정키(`metaKey`, `ctrlKey`, `shiftKey`, `altKey`) 또는 `button !== 0`이면 아무 것도 하지 않고 브라우저 기본 동작(새 탭 등)에 맡긴다. 그 외에는 `e.preventDefault()` 후 `openTileLink(href)` 호출 (메인 라우터는 이동하지 않음 — 서브 타일이 iframe으로 그 경로를 그림).

- [ ] **Step 2: 타입체크**

Run: `pnpm --dir frontend typecheck`
Expected: 통과

- [ ] **Step 3: 수동 확인 (Review Focus 항목)**

아무 페이지에나 임시로 `<TileLink href="/">홈</TileLink>` 하나 넣어 dev 서버에서: 일반 클릭 시 타일 열림, ctrl+클릭 시 새 탭으로 열리는지 확인 후 임시 코드 제거.

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/components/common/TileLink.tsx
git commit -m "feat(frontend): 연관 페이지용 TileLink 컴포넌트 추가"
```

---

### Task 7: 루트 레이아웃 배선 및 전체 시나리오 검증

**Files:**
- Modify: `frontend/src/app/layout.tsx:26`

**Interfaces:**
- Consumes: Task 4의 `TileWorkspace`

- [ ] **Step 1: `layout.tsx` 수정**

`body` 안 `{children}`을 `<TileWorkspace>{children}</TileWorkspace>`로 교체. 기존 `className="h-dvh overflow-hidden flex flex-col"` 유지, `TileWorkspace`가 렌더하는 최상위 요소에 `flex-1 min-h-0` 클래스를 추가해 기존 flex 레이아웃 안에서 남은 공간을 채우도록 한다 (Task 4의 `TileGrid` 최상위 div 클래스에 반영).

- [ ] **Step 2: 타입체크 + 린트**

Run: `pnpm --dir frontend typecheck && pnpm --dir frontend lint`
Expected: 통과

- [ ] **Step 3: 전체 시나리오 수동 검증**

`pnpm --dir frontend dev`로 실행, `TileLink`를 임시로 홈 화면 두 군데에 넣고:
1. 전체화면 → `TileLink` 클릭 → 50/50 분할 확인
2. 또 다른 `TileLink` 클릭 → 3분할(좌 1/2, 우상 1/4, 우하 1/4) 확인, 새 타일이 우상단인지 확인
3. 세 번째 `TileLink` 클릭 → 기존 우상단이 우하단으로, 기존 우하단이 사라지는지(FIFO) 확인
4. 서브 타일 닫기(X) → 남은 하나가 50/50으로 재배치되는지 확인
5. 서브 타일 확대 → 메인과 자리 스왑되는지 확인
6. 일반 `Link`(예: 헤더 로고) 클릭 → 모든 서브 타일이 사라지고 새 페이지가 전체화면으로 뜨는지 확인
7. 브라우저 F5 → 서브 타일 사라지고 메인만 남는지 확인 (합의된 동작)

검증 후 임시로 넣은 `TileLink` 제거 (실제 도메인 페이지에 붙이는 건 이 플랜 범위 밖).

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/app/layout.tsx
git commit -m "feat(frontend): 루트 레이아웃에 타일 워크스페이스 연결"
```
