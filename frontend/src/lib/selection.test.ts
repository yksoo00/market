import { beforeEach, describe, expect, it } from "vitest";
import { selection, selectionKey } from "./selection";
import type { ListingSearchItem } from "@/types/listing";

const item = (n: number, category = "P01-Q01-R001"): ListingSearchItem =>
  ({ userId: `u${n}`, regDate: `2026102910000${n}`, prodName: `상품 ${n}`, category }) as ListingSearchItem;

describe("selection (검색 목록의 선택한 상품)", () => {
  beforeEach(() => selection.clear());

  it("토글하면 담기고 다시 하면 빠진다 — 담은 순서를 지킨다", () => {
    selection.toggle(item(1));
    selection.toggle(item(2));
    expect([...selection.get().keys()]).toEqual([selectionKey(item(1)), selectionKey(item(2))]);
    selection.toggle(item(1));
    expect([...selection.get().keys()]).toEqual([selectionKey(item(2))]);
  });

  it("보이는 목록 전체 선택·해제는 이미 담은 다른 상품을 건드리지 않는다", () => {
    selection.toggle(item(9));
    selection.addAll([item(1), item(2)]);
    expect(selection.get().size).toBe(3);
    selection.removeAll([item(1), item(2)]);
    expect([...selection.get().keys()]).toEqual([selectionKey(item(9))]);
  });

  it("개별 제거와 모두 해제", () => {
    selection.addAll([item(1), item(2)]);
    selection.remove(selectionKey(item(1)));
    expect(selection.get().size).toBe(1);
    selection.clear();
    expect(selection.get().size).toBe(0);
  });

  it("값이 바뀔 때만 구독자에게 알린다", () => {
    let calls = 0;
    const off = selection.subscribe(() => calls++);
    selection.clear();
    expect(calls).toBe(0);
    selection.toggle(item(1));
    expect(calls).toBe(1);
    off();
    selection.toggle(item(2));
    expect(calls).toBe(1);
  });
});
