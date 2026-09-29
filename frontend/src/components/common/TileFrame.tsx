"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import type { SecondaryTile } from "@/lib/tileWorkspace";
import { common as t } from "@/messages/common";

export function TileFrame({ tile }: { tile: SecondaryTile }) {
  const { promote, closeTile, updateTilePath } = useTileWorkspace();
  // tile.path는 iframe 내부 이동을 따라 계속 갱신된다. 그걸 src에 그대로 걸면 이동할 때마다
  // src가 바뀌어 iframe이 같은 페이지를 한 번 더 로드하므로, 마운트 시점 경로로 고정한다.
  // 1↔2개 전환처럼 다시 마운트될 때는 최신 tile.path로 열린다.
  const [src] = useState(tile.path);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframeRef.current?.contentWindow &&
        event.data?.source === "market-tile"
      ) {
        updateTilePath(tile.key, event.data.pathname);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [tile.key, updateTilePath]);

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
      <iframe
        ref={iframeRef}
        src={src}
        title={t.tileFrameTitle}
        onError={() => setLoadError(true)}
        className="h-full w-full border-0"
      />
      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <button type="button" aria-label={t.tileExpand} onClick={() => promote(tile.key, tile.path)}>
          <Icon name="expand" size={16} />
        </button>
        <button type="button" aria-label={t.tileClose} onClick={() => closeTile(tile.key)}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
