"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  closeTile as closeTileState,
  initialTileWorkspaceState,
  openTileLink as openTileLinkState,
  promoteTile as promoteTileState,
  resetTiles,
  type SecondaryTile,
  type TileWorkspaceState,
} from "@/lib/tileWorkspace";

type TileWorkspaceContextValue = {
  secondary: SecondaryTile[];
  openTileLink: (path: string) => void;
  closeTile: (key: string) => void;
  promote: (key: string, replacementPath: string) => void;
};

const TileWorkspaceContext = createContext<TileWorkspaceContextValue | null>(null);

export function TileWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [state, setState] = useState<TileWorkspaceState>(initialTileWorkspaceState);
  // promote()가 router.push로 메인 경로를 바꿀 때는 서브 타일을 비우면 안 되므로,
  // promote 직전에 true로 세팅해 다음 pathname 변경 감지를 한 번 건너뛴다.
  const skipResetRef = useRef(false);

  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    setState(resetTiles());
  }, [pathname]);

  const openTileLink = (path: string) => {
    setState((s) => openTileLinkState(s, path, crypto.randomUUID()));
  };

  const closeTile = (key: string) => {
    setState((s) => closeTileState(s, key));
  };

  const promote = (key: string, replacementPath: string) => {
    skipResetRef.current = true;
    setState((s) => promoteTileState(s, key, pathname, crypto.randomUUID()));
    router.push(replacementPath);
  };

  return (
    <TileWorkspaceContext.Provider value={{ secondary: state.secondary, openTileLink, closeTile, promote }}>
      {children}
    </TileWorkspaceContext.Provider>
  );
}

export function useTileWorkspace(): TileWorkspaceContextValue {
  const context = useContext(TileWorkspaceContext);
  if (!context) {
    throw new Error("useTileWorkspace는 TileWorkspaceProvider 안에서만 사용 가능합니다.");
  }
  return context;
}
