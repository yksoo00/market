"use client";

import { createContext, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useCurrentFullPath } from "@/hooks/useCurrentFullPath";
import {
  closeTile as closeTileState,
  initialTileWorkspaceState,
  openTileLink as openTileLinkState,
  resetTiles,
  updateTilePath as updateTilePathState,
  type SecondaryTile,
  type TileWorkspaceState,
} from "@/lib/tileWorkspace";

type TileWorkspaceContextValue = {
  secondary: SecondaryTile[];
  openTileLink: (path: string) => void;
  closeTile: (key: string) => void;
  updateTilePath: (key: string, path: string) => void;
};

const TileWorkspaceContext = createContext<TileWorkspaceContextValue | null>(null);

export function TileWorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TileWorkspaceState>(initialTileWorkspaceState);

  // 메인 경로(쿼리 포함)가 바뀌면(일반 Link 클릭 등) 서브 타일을 비운다.
  const resetOnMainPathChange = useCallback(() => {
    setState(resetTiles());
  }, []);

  const openTileLink = (path: string) => {
    setState((s) => openTileLinkState(s, path, crypto.randomUUID()));
  };

  const closeTile = (key: string) => {
    setState((s) => closeTileState(s, key));
  };

  // TileFrame의 message 리스너 effect deps에 들어가므로 참조를 고정한다 (매 렌더 재구독 방지).
  const updateTilePath = useCallback((key: string, path: string) => {
    setState((s) => updateTilePathState(s, key, path));
  }, []);

  return (
    <TileWorkspaceContext.Provider value={{ secondary: state.secondary, openTileLink, closeTile, updateTilePath }}>
      {/* useSearchParams는 Suspense 밖에서 쓰면 정적 프리렌더가 깨지므로 잎 컴포넌트로 분리 */}
      <Suspense fallback={null}>
        <MainPathWatcher onChange={resetOnMainPathChange} />
      </Suspense>
      {children}
    </TileWorkspaceContext.Provider>
  );
}

// 메인 경로(쿼리 포함)가 바뀔 때마다 알린다. 쿼리만 바뀌는 이동(/search?q=a → ?q=b)도 감지한다.
function MainPathWatcher({ onChange }: { onChange: () => void }) {
  const fullPath = useCurrentFullPath();
  useEffect(() => {
    onChange();
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
