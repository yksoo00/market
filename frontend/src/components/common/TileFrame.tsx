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

/** closable=false: 왼쪽 홈 칸 (늘 고정, 닫기 없음) */
export function TileFrame({ pane, closable = true }: { pane: Pane; closable?: boolean }) {
  const { close, open, updatePath } = useTileWorkspace();
  // pane.path는 iframe 내부 이동을 따라 계속 갱신된다. 그걸 src에 그대로 걸면 이동할 때마다
  // src가 바뀌어 iframe이 같은 페이지를 한 번 더 로드하므로, 마운트 시점 경로로 고정한다.
  // 다른 경로로 바꿔야 할 때(보조 교체)는 key를 바꿔 다시 마운트한다.
  const [src] = useState(pane.path);
  const [loadError, setLoadError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // iframe 안에서 모달이 열려 있는 동안 이 칸을 창 전체로 키운다 — 모달이 그 칸 안에 갇히지 않고 창 가운데 뜨게 (2026-11-02)
  const [modalOpen, setModalOpen] = useState(false);

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
      if (event.data.type === "modal") {
        // 키우기 전에 칸 위치를 재서 iframe 에 알린다 — 그 자리에 칸 내용을 그대로 두고 막·모달만 창 전체에 뜬다
        const rect = boxRef.current?.getBoundingClientRect();
        if (event.data.open === true && rect) {
          iframeRef.current?.contentWindow?.postMessage(
            { source: "market-tile", type: "modal-rect", rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
            window.location.origin,
          );
        }
        setModalOpen(event.data.open === true);
      }
      else if (event.data.type === "open") open(pane.key, event.data.path, event.data.reset === true);
      else updatePath(pane.key, event.data.pathname);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [pane.key, open, updatePath]);

  if (loadError) {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center gap-2 p-4 text-center text-sm">
        <p>{t.unreachable}</p>
        {/* 닫을 수 없는 칸(홈)은 다시 불러오기로 벗어난다 */}
        <button type="button" onClick={() => setLoadError(false)} className="h-8.5 px-4 rounded-md border border-primary text-primary text-sm font-medium hover:bg-primary-soft">
          {t.retry}
        </button>
        {closable && <TileCloseButton onClick={() => close(pane.key)} />}
      </div>
    );
  }

  return (
    // 바깥 칸은 늘 제자리를 지킨다 — 칸 위치는 이 요소로 잰다. 안쪽이 창 전체로 커진 뒤(담기 모달 → 완료 모달처럼 이어질 때)에 재면
    // 창 전체 크기가 나와 상세가 창 크기로 펴졌다 (2026-11-04)
    <div ref={boxRef} className="relative h-full w-full min-h-0">
      <div className={modalOpen ? "fixed inset-0 z-60" : "relative h-full w-full min-h-0"}>
        <iframe
          ref={iframeRef}
          src={src}
          title={t.tileFrameTitle}
          // 새로 불러온 문서에는 열린 모달이 없다 — F5·뒤로 가기·재시도로 "닫힘" 메시지 없이 문서가 사라져도 칸이 커진 채 남지 않게
          onLoad={() => setModalOpen(false)}
          onError={() => {
            setModalOpen(false);
            setLoadError(true);
          }}
          className="h-full w-full border-0"
        />
        {closable && !modalOpen && <TileCloseButton onClick={() => close(pane.key)} />}
      </div>
    </div>
  );
}
