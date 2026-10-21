import { describe, expect, it } from "vitest";
import { cartActionable, cartBadge, isCartChanged } from "@/lib/cart";
import type { ListingSearchItem } from "@/types/listing";

const origin = "http://localhost:3000";
const message = (data: unknown, from = origin) => ({ data, origin: from }) as MessageEvent;

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

describe("isCartChanged", () => {
  it("같은 출처의 market-tile cart-changed 만 받는다", () => {
    expect(isCartChanged(message({ source: "market-tile", type: "cart-changed" }), origin)).toBe(true);
    expect(isCartChanged(message({ source: "market-tile", type: "cart-changed" }, "http://evil.example"), origin)).toBe(false);
    expect(isCartChanged(message({ source: "market-tile", type: "open", path: "/" }), origin)).toBe(false);
    expect(isCartChanged(message({ type: "cart-changed" }), origin)).toBe(false);
    expect(isCartChanged(message(null), origin)).toBe(false);
  });
});
