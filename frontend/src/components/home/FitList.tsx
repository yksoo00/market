"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { useFitCount } from "@/hooks/useFitCount";

interface Props {
  rowHeight: number;
  className?: string;
  children: ReactNode;
}

/**
 * 칸 높이에 온전히 들어가는 행만 보이는 목록. 측정을 위해 이 잎 컴포넌트만 클라이언트로 두고,
 * 행(ListingRow)은 서버에서 그린 그대로 children 으로 받는다.
 * 넘치는 행은 지우지 않고 invisible 로 숨긴다. 지우면 목록의 내용 높이가 줄어 칸이 다시 커지지 못하고
 * (칸 높이가 내용에 맞춰지므로), invisible 은 자리는 지키면서 포커스·스크린리더에서도 빠진다.
 * 측정 전(서버 렌더·첫 렌더)에는 행 수를 모르므로 전부 숨긴다 — 반쯤 잘린 행이 보였다가 사라지는 깜빡임 방지.
 */
export function FitList({ rowHeight, className = "", children }: Props) {
  const [ref, fit] = useFitCount<HTMLDivElement>(rowHeight);
  return (
    <div ref={ref} className={`${className} ${fit === null ? "invisible" : ""}`}>
      {Children.toArray(children).map((row, i) => (
        <div key={isValidElement(row) ? row.key : i} className={fit !== null && i >= fit ? "invisible" : ""}>
          {row}
        </div>
      ))}
    </div>
  );
}
