"use client";
import { useSyncExternalStore } from "react";

// 타일 큐 분할 기준: 모바일(768 미만)에선 분할하지 않는다 (사용자 지시)
const QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** 화면 폭이 분할 가능한 폭(768 이상)인가. 서버 렌더에선 false */
export function useIsWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
