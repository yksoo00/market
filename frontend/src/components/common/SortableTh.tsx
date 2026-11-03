"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import type { SortState } from "@/lib/columnSort";

interface Props {
  label: ReactNode;
  /** 이 열이 정렬 중인가 — 오름·내림·아님 */
  state: SortState;
  /** 열 머리를 눌렀을 때 (다음 정렬로 — lib/columnSort.nextSort) */
  onSort: () => void;
  /** 이 th 의 나머지 클래스 (폭·여백·정렬·sticky 등 — 일반 th 와 같게) */
  className?: string;
}

/**
 * 눌러서 정렬하는 열 머리 (사용자 지시 2026-11-03). 정렬 중인 열은 굵게 ▲(오름)·▼(내림), 아닌 열은 흐린 ↕ 로 눌러 볼 수 있음을 알린다.
 * 스크린리더는 aria-sort 로 정렬 방향을 읽는다
 */
export function SortableTh({ label, state, onSort, className = "" }: Props) {
  const Arrow = state === "asc" ? ArrowUp : state === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={state === "asc" ? "ascending" : state === "desc" ? "descending" : "none"} className={className}>
      <button
        type="button"
        onClick={onSort}
        className={`inline-flex items-center gap-1 rounded-sm hover:text-ink focus-visible:outline-2 focus-visible:outline-primary ${state ? "font-bold text-ink" : ""}`}
      >
        {label}
        <Arrow size={12} aria-hidden="true" className={state ? "text-primary" : "text-ink-3"} />
      </button>
    </th>
  );
}
