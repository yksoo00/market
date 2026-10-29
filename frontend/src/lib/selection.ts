// 검색 목록에서 체크한 상품 (설계 2026-10-27 PR 3 "선택 줄", 사용자 결정 2026-10-29): 체크한 것이 목록 위 줄에 계속 보이고,
// 검색어·필터를 바꿔도(목록 컴포넌트가 다시 만들어져도) 남는다. 같은 문서(칸) 안의 모듈 상태 — 새로고침하면 비워진다.
import { useSyncExternalStore } from "react";
import type { ListingSearchItem } from "@/types/listing";

export const selectionKey = (i: Pick<ListingSearchItem, "userId" | "regDate">) => `${i.userId}/${i.regDate}`;

type Selected = ReadonlyMap<string, ListingSearchItem>;

const EMPTY: Selected = new Map();
let current: Selected = EMPTY;
const listeners = new Set<() => void>();

function set(next: Selected) {
  current = next;
  listeners.forEach((l) => l());
}

export const selection = {
  get: (): Selected => current,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** 체크하면 담고 다시 체크하면 뺀다 (담은 순서 유지) */
  toggle(item: ListingSearchItem) {
    const next = new Map(current);
    const key = selectionKey(item);
    if (next.has(key)) next.delete(key);
    else next.set(key, item);
    set(next);
  },
  /** 보이는 목록 전체 선택 — 이미 담은 다른 상품은 그대로 */
  addAll(items: ListingSearchItem[]) {
    const next = new Map(current);
    for (const i of items) next.set(selectionKey(i), next.get(selectionKey(i)) ?? i);
    set(next);
  },
  /** 보이는 목록 전체 해제 — 목록에 없는 다른 선택은 그대로 */
  removeAll(items: ListingSearchItem[]) {
    const next = new Map(current);
    for (const i of items) next.delete(selectionKey(i));
    set(next);
  },
  remove(key: string) {
    if (!current.has(key)) return;
    const next = new Map(current);
    next.delete(key);
    set(next);
  },
  clear() {
    if (current.size > 0) set(EMPTY);
  },
};

export function useSelection(): Selected {
  return useSyncExternalStore(selection.subscribe, selection.get, () => EMPTY);
}
