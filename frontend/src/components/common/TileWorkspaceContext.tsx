"use client";

import { useRouter } from "next/navigation";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useCurrentFullPath } from "@/hooks/useCurrentFullPath";
import { useIsFramed } from "@/hooks/useIsFramed";
import { useIsWide } from "@/hooks/useIsWide";
import { formIntercept, linkIntercept, type Intercept } from "@/lib/tileNavigation";
import {
  applyOpen,
  closePane,
  decideOpen,
  paneNavigated,
  restorePanes,
  serializePanes,
  STORAGE_KEY,
  syncMainPath,
  type Pane,
} from "@/lib/tileQueue";
import { screenOf } from "@/lib/tileScreens";
import { randomUUID } from "@/lib/uuid";

// 모든 화면 전환을 하나의 큐로 (스펙: docs/superpowers/specs/2026-10-01-tile-queue-design.md).
// 화면 코드는 일반 Link·form을 쓰고, 여기서 문서 전체의 클릭·GET 폼 제출을 캡처 단계에서 받아 판단한다.

type TileWorkspaceContextValue = {
  /** 오래된 순. panes[0]이 주소창 칸. 첫 경로를 알기 전(서버 렌더 등)엔 빈 배열 */
  panes: Pane[];
  /** 분할 가능한 폭(768 이상)인가 */
  wide: boolean;
  open: (fromKey: string, path: string, reset: boolean) => void;
  close: (key: string) => void;
  updatePath: (key: string, path: string) => void;
};

const TileWorkspaceContext = createContext<TileWorkspaceContextValue | null>(null);

const newKey = () => randomUUID();

export function TileWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const framed = useIsFramed();
  const wide = useIsWide();
  const [panes, setPanes] = useState<Pane[]>([]);

  // 문서 리스너는 한 번만 달고 최신 상태는 ref로 읽는다
  const panesRef = useRef(panes);
  const wideRef = useRef(wide);
  useEffect(() => {
    panesRef.current = panes;
    wideRef.current = wide;
  });

  const open = useCallback(
    (fromKey: string, path: string, reset: boolean) => {
      const cur = panesRef.current;
      if (cur.length === 0) {
        router.push(path);
        return;
      }
      const action = decideOpen(cur, fromKey, path, { reset, wide: wideRef.current });
      if (action.kind === "none") return;
      const next = applyOpen(cur, action, newKey());
      setPanes(next);
      // 주소창 칸이 바뀌었으면(제자리 이동, 가득 차서 밀림, 리셋) 라우터를 맞춘다
      if (next[0].path !== cur[0].path || next[0].key !== cur[0].key) router.push(next[0].path);
    },
    [router],
  );

  const close = useCallback(
    (key: string) => {
      const cur = panesRef.current;
      const next = closePane(cur, key);
      setPanes(next);
      // replace: 닫기를 기록에 쌓지 않아 뒤로가기가 닫기 전 배치를 거치지 않는다
      if (next[0] && next[0].key !== cur[0]?.key) router.replace(next[0].path, { scroll: false });
    },
    [router],
  );

  // iframe 칸이 보고한 현재 경로. 같은 화면이면 경로만 갱신, 코드로 다른 화면에 갔으면(로그인 성공 후 등)
  // 그 칸을 닫고 큐 규칙으로 연다 (paneNavigated). TileFrame의 message 리스너 deps에 들어가므로 참조 고정
  const updatePath = useCallback(
    (key: string, path: string) => {
      const cur = panesRef.current;
      const next = paneNavigated(cur, key, path, wideRef.current, newKey());
      const same = next.length === cur.length && next.every((p, i) => p.key === cur[i].key && p.path === cur[i].path);
      if (same) return;
      setPanes(next);
      if (next[0] && (next[0].key !== cur[0]?.key || next[0].path !== cur[0]?.path)) router.push(next[0].path);
    },
    [router],
  );

  // 주소창 경로가 바뀔 때: 처음이면 새로고침 복원 시도, 그 뒤엔 동기화(뒤로가기·router.push 등)
  const onMainPath = useCallback((fullPath: string) => {
    setPanes((prev) => {
      if (prev.length > 0) return syncMainPath(prev, fullPath, newKey());
      let restored: Pane[] | null = null;
      try {
        restored = restorePanes(sessionStorage.getItem(STORAGE_KEY), fullPath);
      } catch {
        // 사생활 보호 모드 등 저장소를 못 쓰면 복원 없이 시작
      }
      return restored ?? [{ key: newKey(), path: fullPath }];
    });
  }, []);

  // iframe(서브 칸) 안에서는 칸 목록을 갖지 않는다 — 같은 탭의 sessionStorage를 공유하므로 덮어쓰지 않게
  useEffect(() => {
    if (framed || panes.length === 0) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, serializePanes(panes));
    } catch {
      // 저장 실패는 무시 (새로고침 복원만 안 됨)
    }
  }, [panes, framed]);

  useEffect(() => {
    const handle = (event: Event, hit: Intercept) => {
      if (!hit) return;
      if (framed) {
        // iframe 칸: 같은 화면 안 이동은 iframe이 스스로(Next 기본 동작), 그 외는 부모 큐에 맡긴다
        const here = window.location.pathname + window.location.search;
        if (!hit.reset && screenOf(hit.path).id === screenOf(here).id) return;
        event.preventDefault();
        window.top?.postMessage({ source: "market-tile", type: "open", path: hit.path, reset: hit.reset }, window.location.origin);
        return;
      }
      event.preventDefault();
      const main = panesRef.current[0];
      open(main?.key ?? "", hit.path, hit.reset);
    };

    const onClick = (e: MouseEvent) => {
      const anchor = e.target instanceof Element ? e.target.closest("a") : null;
      if (!anchor) return;
      handle(
        e,
        linkIntercept(
          e,
          {
            href: anchor.href,
            target: anchor.target,
            hasDownload: anchor.hasAttribute("download"),
            tileReset: anchor.dataset.tile === "reset",
          },
          window.location.origin,
        ),
      );
    };

    const onSubmit = (e: SubmitEvent) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const entries = [...new FormData(form, e.submitter)].filter((x): x is [string, string] => typeof x[1] === "string");
      const info = {
        method: form.method,
        action: form.action,
        hasActionAttr: form.hasAttribute("action"),
        defaultPrevented: e.defaultPrevented,
        entries,
      };
      handle(e, formIntercept(info, window.location.origin));
    };

    // 링크는 캡처 단계: next/link가 defaultPrevented를 보고 스스로 이동하지 않게 먼저 막는다.
    // 폼 제출은 window 버블 단계: React(document에 붙음)의 onSubmit이 먼저 돌아, 앱이 직접 처리하는 폼
    // (react-hook-form 등)이 preventDefault 한 걸 보고 건드리지 않는다. 브라우저 기본 제출보다는 여전히 앞이다.
    document.addEventListener("click", onClick, true);
    window.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onSubmit);
    };
  }, [framed, open]);

  return (
    <TileWorkspaceContext.Provider value={{ panes, wide, open, close, updatePath }}>
      {/* useSearchParams는 Suspense 밖에서 쓰면 정적 프리렌더가 깨지므로 잎 컴포넌트로 분리 */}
      {!framed && (
        <Suspense fallback={null}>
          <MainPathWatcher onChange={onMainPath} />
        </Suspense>
      )}
      {children}
    </TileWorkspaceContext.Provider>
  );
}

// 주소창 경로(쿼리 포함)가 바뀔 때마다 알린다. 쿼리만 바뀌는 이동(/search?q=a → ?q=b)도 감지한다.
function MainPathWatcher({ onChange }: { onChange: (fullPath: string) => void }) {
  const fullPath = useCurrentFullPath();
  useEffect(() => {
    onChange(fullPath);
  }, [fullPath, onChange]);
  return null;
}

export function useTileWorkspace(): TileWorkspaceContextValue {
  const context = useContext(TileWorkspaceContext);
  if (!context) {
    throw new Error("useTileWorkspace는 TileWorkspaceProvider 안에서만 사용 가능합니다.");
  }
  return context;
}
