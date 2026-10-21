import { afterEach, describe, expect, it, vi } from "vitest";
import { cartActionable, cartBadge, isCartChanged, notifyCartChanged } from "@/lib/cart";
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

describe("notifyCartChanged", () => {
  afterEach(() => vi.unstubAllGlobals());

  // 칸 엔진(TileFrame)은 source "market-tile" 메시지를 전부 칸 경로 보고로 읽는다 — 같은 source 로 보내면
  // 경로 없는 보고가 돼 screenOf(undefined) 로 깨진다 (E2E 화면 확인에서 발견)
  it("칸 엔진과 다른 source 로 최상위 창에 보낸다", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("window", { top: { postMessage }, location: { origin } });
    notifyCartChanged();
    expect(postMessage).toHaveBeenCalledWith({ source: "market-cart", type: "cart-changed" }, origin);
  });
});

describe("isCartChanged", () => {
  it("같은 출처의 market-cart cart-changed 만 받는다", () => {
    expect(isCartChanged(message({ source: "market-cart", type: "cart-changed" }), origin)).toBe(true);
    expect(isCartChanged(message({ source: "market-cart", type: "cart-changed" }, "http://evil.example"), origin)).toBe(false);
    expect(isCartChanged(message({ source: "market-tile", type: "open", path: "/" }), origin)).toBe(false);
    expect(isCartChanged(message({ source: "market-tile", type: "cart-changed" }), origin)).toBe(false);
    expect(isCartChanged(message({ type: "cart-changed" }), origin)).toBe(false);
    expect(isCartChanged(message(null), origin)).toBe(false);
  });
});
