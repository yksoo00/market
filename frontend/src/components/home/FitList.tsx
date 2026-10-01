"use client";

import { Children, type ReactNode } from "react";
import { useFitCount } from "@/hooks/useFitCount";

interface Props {
  rowHeight: number;
  className?: string;
  children: ReactNode;
}

/**
 * 칸 높이에 온전히 들어가는 행만 그리는 목록. 측정을 위해 이 잎 컴포넌트만 클라이언트로 두고,
 * 행(ListingRow)은 서버에서 그린 그대로 children 으로 받는다.
 * 측정 전(서버 렌더·첫 렌더)에는 행 수를 모르므로 숨겨 둔다. 반쯤 잘린 행이 보였다가 줄어드는 깜빡임 방지.
 */
export function FitList({ rowHeight, className = "", children }: Props) {
  const [ref, fit] = useFitCount<HTMLDivElement>(rowHeight);
  const rows = Children.toArray(children);
  return (
    <div ref={ref} className={`${className} ${fit === null ? "invisible" : ""}`}>
      {fit === null ? rows : rows.slice(0, fit)}
    </div>
  );
}
