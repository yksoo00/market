"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import type { SecondaryTile } from "@/lib/tileWorkspace";
import { common as t } from "@/messages/common";

export function TileFrame({ tile }: { tile: SecondaryTile }) {
  const { promote, closeTile } = useTileWorkspace();
  const [currentPath, setCurrentPath] = useState(tile.path);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframeRef.current?.contentWindow &&
        event.data?.source === "market-tile"
      ) {
        setCurrentPath(event.data.pathname);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  if (loadError) {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
        <p>{t.unreachable}</p>
        <button
          type="button"
          aria-label={t.tileClose}
          onClick={() => closeTile(tile.key)}
          className="absolute top-1 right-1"
        >
          <Icon name="close" size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="group relative h-full w-full">
      <iframe ref={iframeRef} src={tile.path} onError={() => setLoadError(true)} className="h-full w-full border-0" />
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" aria-label={t.tileExpand} onClick={() => promote(tile.key, currentPath)}>
          <Icon name="expand" size={16} />
        </button>
        <button type="button" aria-label={t.tileClose} onClick={() => closeTile(tile.key)}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
