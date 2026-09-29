"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * 이 페이지가 iframe 안에 있을 때, 현재 경로를 부모 윈도우로 postMessage 전송합니다.
 * iframe이 아닐 때는 아무것도 하지 않습니다.
 */
export function useReportTilePathname(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;
    window.top?.postMessage({ source: "market-tile", pathname }, window.location.origin);
  }, [pathname]);
}
