"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// 표의 가로 스크롤 위치를 정렬 같은 이동 뒤에도 이어 가려는 기억 (사용자 지시 2026-11-03). 정렬을 누르면 표가 다시 만들어지는데,
// 그때 가로 스크롤이 처음으로 돌아가면 오른쪽 끝 열을 다시 찾아가야 한다.
// latest = memoryKey 별 지금 위치(스크롤할 때마다 갱신), pending = 다음에 만들어질 때 복원할 위치(한 번 쓰면 지운다)
const latest = new Map<string, number>();
const pending = new Map<string, number>();

/** 정렬 같은 이동을 하기 직전에 부른다 — 다음에 같은 memoryKey 의 StickyXScroll 이 만들어지면 지금 가로 위치로 복원한다 */
export function rememberXScroll(memoryKey: string): void {
  const left = latest.get(memoryKey);
  if (left !== undefined) pending.set(memoryKey, left);
}

/**
 * 가로로 넘치는 표 래퍼 (사용자 지시 2026-11-03). 두 가지를 해 준다.
 * 1. 가로 스크롤바를 표 맨 아래가 아니라 화면 아래에 따라다니게 한다 — 표가 길어도 맨 아래까지 내려갔다 올라올 필요 없이
 *    보고 있는 자리에서 바로 옆으로 민다. 진짜 스크롤바는 숨기고, 같은 폭의 막대를 \`sticky bottom-0\` 으로 달아 서로 맞춘다.
 * 2. memoryKey 를 주면 이동 직전에 rememberXScroll(memoryKey) 를 불러 가로 위치를 이어 간다 (열 머리 정렬로 표가 새로 그려질 때).
 * className 은 바깥 틀(테두리·둥근 모서리·칸 폭에 따른 숨김)에 붙는다. 안쪽 표의 \`sticky left-0\` 열은 그대로 동작한다.
 */
export function StickyXScroll({ children, className = "", memoryKey }: { children: ReactNode; className?: string; memoryKey?: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const spacerRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  // 두 스크롤이 서로를 되부르지 않게
  const syncing = useRef(false);

  const measure = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    setOverflowing(body.scrollWidth > body.clientWidth + 1);
    // 측정한 폭이라 클래스로 못 정한다 (스크롤바 막대 안쪽 칸의 폭 = 표의 전체 폭)
    if (spacerRef.current) spacerRef.current.style.width = `${body.scrollWidth}px`;
  }, []);

  // 만들어진 직후 기억해 둔 위치를 복원 (그리기 전에 맞춰 깜빡이지 않게)
  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body || !memoryKey) return;
    const left = pending.get(memoryKey);
    if (left === undefined) return;
    pending.delete(memoryKey);
    body.scrollLeft = left;
  }, [memoryKey]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    if (body.firstElementChild) observer.observe(body.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  // 막대가 새로 나타날 때 폭과 몸통의 현재 위치를 맞춘다
  useLayoutEffect(() => {
    if (!overflowing || !barRef.current || !bodyRef.current) return;
    if (spacerRef.current) spacerRef.current.style.width = `${bodyRef.current.scrollWidth}px`;
    barRef.current.scrollLeft = bodyRef.current.scrollLeft;
  }, [overflowing]);

  const follow = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to) return;
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    if (to.scrollLeft !== from.scrollLeft) {
      syncing.current = true;
      to.scrollLeft = from.scrollLeft;
    }
  };

  return (
    // overflow-clip: 둥근 모서리는 자르되 스크롤 영역은 만들지 않는다 — hidden 이면 안쪽 sticky 막대가 이 틀에 갇혀 화면 아래에 안 붙는다
    <div className={`overflow-clip ${className}`}>
      <div
        ref={bodyRef}
        onScroll={() => {
          if (memoryKey && bodyRef.current) latest.set(memoryKey, bodyRef.current.scrollLeft);
          follow(bodyRef.current, barRef.current);
        }}
        className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {overflowing && (
        <div
          ref={barRef}
          aria-hidden="true"
          onScroll={() => follow(barRef.current, bodyRef.current)}
          className="sticky bottom-0 z-20 overflow-x-auto border-t border-line-2 bg-surface"
        >
          <div ref={spacerRef} className="h-px" />
        </div>
      )}
    </div>
  );
}
