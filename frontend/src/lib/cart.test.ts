import { describe, expect, it, vi } from "vitest";
import { cartActionable, cartBadge, notifyCartChanged, onCartChanged } from "@/lib/cart";
import type { ListingSearchItem } from "@/types/listing";

describe("cartBadge", () => {
  it("0 이하는 배지 없음, 99 까지 숫자, 100 부터 99+", () => {
    expect(cartBadge(0)).toBeNull();
    expect(cartBadge(-1)).toBeNull();
    expect(cartBadge(1)).toBe("1");
    expect(cartBadge(99)).toBe("99");
    expect(cartBadge(100)).toBe("99+");
  });
});

describe("cartActionable", () => {
  it("거래완료 매물은 견적·구매 대상이 아니다", () => {
    expect(cartActionable({ tradeStatus: "completed" } as ListingSearchItem)).toBe(false);
    expect(cartActionable({ tradeStatus: "available" } as ListingSearchItem)).toBe(true);
  });
});

// 헤더(최상위 창)와 열려 있는 장바구니 칸(iframe)이 둘 다 받아야 한다 — 같은 출처의 모든 창에 가는 BroadcastChannel
describe("notifyCartChanged · onCartChanged", () => {
  it("구독한 쪽마다 신호가 가고, 구독을 끊으면 안 간다", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onCartChanged(a);
    const offB = onCartChanged(b);
    notifyCartChanged();
    await vi.waitFor(() => {
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });
    offA();
    notifyCartChanged();
    await vi.waitFor(() => expect(b).toHaveBeenCalledTimes(2));
    expect(a).toHaveBeenCalledTimes(1);
    offB();
  });
});
