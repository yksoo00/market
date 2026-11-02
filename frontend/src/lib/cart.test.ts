import { describe, expect, it, vi } from "vitest";
import { cartActionable, cartBadge, nextCartQuantity, notifyCartChanged, onCartChanged } from "@/lib/cart";
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

describe("nextCartQuantity", () => {
  const item = (o: Partial<ListingSearchItem>) => ({ tradeStatus: "available", orderUnit: 5, minOrderQuantity: 10, stockQuantity: 12, ...o }) as ListingSearchItem;

  it("주문단위만큼 오르내린다", () => {
    expect(nextCartQuantity(item({}), 15, "down")).toBe(10);
    expect(nextCartQuantity(item({}), 15, "up")).toBe(20);
  });

  it("최소주문량 아래로는 못 내린다 (없애려면 빼기)", () => {
    expect(nextCartQuantity(item({}), 10, "down")).toBeNull();
  });

  it("남은 재고가 주문단위보다 적으면 못 올린다", () => {
    expect(nextCartQuantity(item({ stockQuantity: 4 }), 15, "up")).toBeNull();
    expect(nextCartQuantity(item({ stockQuantity: 5 }), 15, "up")).toBe(20);
    expect(nextCartQuantity(item({ stockQuantity: null }), 15, "up")).toBeNull();
  });

  it("주문단위·최소주문량이 없으면 1 단위, 거래완료 매물은 둘 다 못 바꾼다", () => {
    expect(nextCartQuantity(item({ orderUnit: null, minOrderQuantity: null }), 3, "down")).toBe(2);
    expect(nextCartQuantity(item({ orderUnit: null, minOrderQuantity: null }), 1, "down")).toBeNull();
    expect(nextCartQuantity(item({ tradeStatus: "completed" }), 15, "up")).toBeNull();
    expect(nextCartQuantity(item({ tradeStatus: "completed" }), 15, "down")).toBeNull();
  });
});
