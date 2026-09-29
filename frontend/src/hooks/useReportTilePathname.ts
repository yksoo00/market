"use client";
import { useEffect } from "react";
import { useCurrentFullPath } from "@/hooks/useCurrentFullPath";

/**
 * 이 페이지가 iframe 안에 있을 때, 현재 경로(쿼리 포함)를 부모 윈도우로 postMessage 전송합니다.
 * iframe이 아닐 때는 아무것도 하지 않습니다.
 * useSearchParams를 쓰므로 호출하는 컴포넌트는 `<Suspense>` 안에 있어야 합니다.
 */
export function useReportTilePathname(): void {
  const fullPath = useCurrentFullPath();

  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;
    window.top?.postMessage({ source: "market-tile", pathname: fullPath }, window.location.origin);
  }, [fullPath]);
}
