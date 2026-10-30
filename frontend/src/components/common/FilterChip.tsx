"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/common/Icon";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 필터 칩 툴바의 부품 — 검색 결과 화면(FilterBar)에서 그대로 옮겨 거래이력·활동내역이 같은 모양을 쓴다 (사용자 지시 2026-10-30:
// 검색과 똑같이). 칩 = 팝업 여는 버튼 + (걸려 있으면) 그 조건만 지우는 ×.

export const inputClass =
  "h-8.5 rounded-md border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary aria-invalid:border-down";
export const applyClass =
  "h-8.5 px-4 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-40 disabled:pointer-events-none";

export interface ChipProps {
  label: string;
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClear: () => void;
  clearLabel: string;
  align?: "start" | "end";
  contentClass?: string;
  children: ReactNode;
}

/** 칩 = 팝업 여는 버튼 + (걸려 있으면) 그 조건만 지우는 × */
export function Chip({ label, active, open, onOpenChange, onClear, clearLabel, align, contentClass, children }: ChipProps) {
  return (
    <div
      className={`shrink-0 h-8.5 flex items-center rounded-full border text-sm ${
        active ? "border-primary bg-primary-soft text-primary-dark font-medium" : "border-line bg-surface text-ink-2"
      }`}
    >
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger className={`h-full ${active ? "pl-3.5 pr-1.5" : "px-3.5"} flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}>
          <span className="max-w-48 truncate">{label}</span>
          <span aria-hidden="true" className="text-xs opacity-60">
            ▾
          </span>
        </PopoverTrigger>
        <PopoverContent align={align} className={contentClass}>
          {children}
        </PopoverContent>
      </Popover>
      {active && (
        <button type="button" aria-label={clearLabel} onClick={onClear} className="h-full pl-1 pr-2.5 flex items-center rounded-r-full hover:text-primary">
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}

export function PopForm({ onSubmit, valid, applyLabel, children }: { onSubmit: () => void; valid: boolean; applyLabel: string; children: ReactNode }) {
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-3"
    >
      {children}
      <div className="flex justify-end">
        <button type="submit" disabled={!valid} className={applyClass}>
          {applyLabel}
        </button>
      </div>
    </form>
  );
}

interface PopFieldProps {
  label: string;
  htmlFor?: string;
  /** 체크박스 묶음처럼 label 대상이 하나가 아닐 때 aria-labelledby 용 */
  labelId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}

export function PopField({ label, htmlFor, labelId, error, errorId, children }: PopFieldProps) {
  const labelClass = "text-[13px] font-medium text-ink-2";
  return (
    <div className="flex flex-col gap-1">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span id={labelId} className={labelClass}>
          {label}
        </span>
      )}
      <div className="flex items-center gap-1.5">{children}</div>
      {error && (
        <p id={errorId} className="text-xs text-down">
          {error}
        </p>
      )}
    </div>
  );
}
