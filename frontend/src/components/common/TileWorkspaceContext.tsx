"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentFullPath } from "@/hooks/useCurrentFullPath";
import {
  closeTile as closeTileState,
  initialTileWorkspaceState,
  openTileLink as openTileLinkState,
  promoteTile as promoteTileState,
  resetTiles,
  updateTilePath as updateTilePathState,
  type SecondaryTile,
  type TileWorkspaceState,
} from "@/lib/tileWorkspace";

type TileWorkspaceContextValue = {
  secondary: SecondaryTile[];
  openTileLink: (path: string) => void;
  closeTile: (key: string) => void;
  promote: (key: string, replacementPath: string) => void;
  updateTilePath: (key: string, path: string) => void;
};

const TileWorkspaceContext = createContext<TileWorkspaceContextValue | null>(null);

export function TileWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<TileWorkspaceState>(initialTileWorkspaceState);
  // 메인 영역의 현재 경로(쿼리 포함). MainPathWatcher가 채운다.
  // 초기값 pathname은 Watcher가 마운트되기 전의 짧은 구간용.
  const currentPathRef = useRef(usePathname());
  // promote()가 router.push로 메인 경로를 바꿀 때는 서브 타일을 비우면 안 되므로,
  // promote 직전에 true로 세팅해 다음 경로 변경 감지를 한 번 건너뛴다.
  const skipResetRef = useRef(false);

  // setState·ref만 쓰므로 deps가 비어 있어도 안전하다. 참조가 바뀌면 Watcher effect가 매 렌더 돌아 타일이 비워진다.
  const handleMainPathChange = useCallback((fullPath: string) => {
    currentPathRef.current = fullPath;
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    setState(resetTiles());
  }, []);

  const openTileLink = (path: string) => {
    setState((s) => openTileLinkState(s, path, crypto.randomUUID()));
  };

  const closeTile = (key: string) => {
    setState((s) => closeTileState(s, key));
  };

  const promote = (key: string, replacementPath: string) => {
    const mainPath = currentPathRef.current;
    // 같은 경로로 push하면 경로 변경이 일어나지 않아 플래그가 소비되지 않고 남는다.
    // 그러면 다음 일반 <Link> 이동의 리셋이 삼켜지므로, 실제로 경로가 바뀔 때만 세팅한다.
    if (replacementPath !== mainPath) {
      skipResetRef.current = true;
    }
    setState((s) => promoteTileState(s, key, mainPath, crypto.randomUUID()));
    router.push(replacementPath);
  };

  // TileFrame의 message 리스너 effect deps에 들어가므로 참조를 고정한다 (매 렌더 재구독 방지).
  const updateTilePath = useCallback((key: string, path: string) => {
    setState((s) => updateTilePathState(s, key, path));
  }, []);

  return (
    <TileWorkspaceContext.Provider
      value={{ secondary: state.secondary, openTileLink, closeTile, promote, updateTilePath }}
    >
      {/* useSearchParams는 Suspense 밖에서 쓰면 정적 프리렌더가 깨지므로 잎 컴포넌트로 분리 */}
      <Suspense fallback={null}>
        <MainPathWatcher onChange={handleMainPathChange} />
      </Suspense>
      {children}
    </TileWorkspaceContext.Provider>
  );
}

// 메인 경로(쿼리 포함)가 바뀔 때마다 알린다. 쿼리만 바뀌는 이동(/search?q=a → ?q=b)도 감지한다.
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
