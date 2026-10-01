"use client";

import { useEffect, useRef, useState } from "react";
import { fitCount } from "@/lib/fitCount";

/**
 * 목록 칸 높이에 잘리지 않고 들어가는 행 수. 홈은 스크롤 없이 한 화면이라(design.md)
 * 넘치는 행은 스크롤 대신 잘라내고 '전체'로 보낸다.
 * 측정 전(서버 렌더·첫 렌더)은 null → 호출 측은 전부 그리고 칸의 overflow-hidden 에 맡긴다.
 */
export function useFitCount<T extends HTMLElement>(rowHeight: number) {
  const ref = useRef<T>(null);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setCount(fitCount(entry.contentRect.height, rowHeight)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [rowHeight]);

  return [ref, count] as const;
}
