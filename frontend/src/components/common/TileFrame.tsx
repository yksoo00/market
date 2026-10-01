"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/common/Icon";
import { useTileWorkspace } from "@/components/common/TileWorkspaceContext";
import type { Pane } from "@/lib/tileQueue";
import { common as t } from "@/messages/common";

// 칸 닫기 버튼. 주소창 칸·iframe 칸이 같은 모양을 쓴다.
// 항상 보이게 둔다. hover에서만 보이면 터치·키보드 사용자는 찾을 수 없고, 어두운 페이지 위에선 아이콘이 묻힌다
export function TileCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={t.tileClose}
      onClick={onClick}
      className="absolute top-1 right-1 z-20 w-7 h-7 flex items-center justify-center rounded-full bg-surface text-ink border border-line hover:border-primary"
    >
      <Icon name="close" size={14} />
    </button>
  );
}

export function TileFrame({ pane }: { pane: Pane }) {
  const { close, open, updatePath } = useTileWorkspace();
  // pane.path는 iframe 내부 이동을 따라 계속 갱신된다. 그걸 src에 그대로 걸면 이동할 때마다
  // src가 바뀌어 iframe이 같은 페이지를 한 번 더 로드하므로, 마운트 시점 경로로 고정한다.
  // 다른 경로로 바꿔야 할 때(같은 화면 교체)는 큐가 key를 바꿔 다시 마운트한다.
  const [src] = useState(pane.path);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow ||
        event.data?.source !== "market-tile"
      ) {
        return;
      }
      // iframe 안에서 다른 화면을 열면 부모 큐가 판단 (같은 화면 이동은 iframe이 스스로 하고 경로만 보고)
      if (event.data.type === "open") open(pane.key, event.data.path, event.data.reset === true);
      else updatePath(pane.key, event.data.pathname);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pane.key, open, updatePath]);

  if (loadError) {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
        <p>{t.unreachable}</p>
        <TileCloseButton onClick={() => close(pane.key)} />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full min-h-0">
      <iframe
        ref={iframeRef}
        src={src}
        title={t.tileFrameTitle}
        onError={() => setLoadError(true)}
        className="h-full w-full border-0"
      />
      <TileCloseButton onClick={() => close(pane.key)} />
    </div>
  );
}
