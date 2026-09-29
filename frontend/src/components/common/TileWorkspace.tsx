"use client";

import type { ReactNode } from "react";
import { useIsFramed } from "@/hooks/useIsFramed";
import { useReportTilePathname } from "@/hooks/useReportTilePathname";
import { TileWorkspaceProvider, useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import { TileFrame } from "@/components/common/TileFrame";

export function TileWorkspace({ children }: { children: ReactNode }) {
  const framed = useIsFramed();
  useReportTilePathname();

  if (framed) return <>{children}</>;

  return (
    <TileWorkspaceProvider>
      <TileGrid main={children} />
    </TileWorkspaceProvider>
  );
}

function TileGrid({ main }: { main: ReactNode }) {
  const { secondary } = useTileWorkspace();

  if (secondary.length === 0) {
    return <div className="flex-1 min-h-0 h-full w-full">{main}</div>;
  }

  if (secondary.length === 1) {
    return (
      <div className="flex-1 min-h-0 grid grid-cols-2 h-full w-full">
        {main}
        <TileFrame tile={secondary[0]} />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 grid grid-cols-2 h-full w-full">
      {main}
      <div className="grid grid-rows-2 h-full">
        <TileFrame tile={secondary[0]} />
        <TileFrame tile={secondary[1]} />
      </div>
    </div>
  );
}
