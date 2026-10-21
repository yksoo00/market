// 장바구니 (스펙 2026-10-21-cart-design.md). 헤더 배지와, 칸(iframe)에서 헤더로 보내는 "바뀜" 신호
import type { ListingSearchItem } from "@/types/listing";

export const CART_CHANGED = "cart-changed";

/** 배지 글자. 0 이하는 배지 없음, 100 부터는 99+ (헤더 폭이 좁아서) */
export function cartBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

/**
 * 담기·빼기·견적·구매 뒤 헤더 숫자를 다시 읽게 한다. 칸은 iframe 이라 헤더 상태를 직접 못 바꾼다 — 칸 열기 신호와
 * 같은 통로(window.top). 최상위 창이면 top 이 자기 자신이라 헤더가 그대로 받는다
 */
export function notifyCartChanged(): void {
  window.top?.postMessage({ source: "market-tile", type: CART_CHANGED }, window.location.origin);
}

/** 다른 출처의 메시지는 무시한다 */
export function isCartChanged(e: MessageEvent, origin: string): boolean {
  const data = e.data as { source?: unknown; type?: unknown } | null;
  return e.origin === origin && data?.source === "market-tile" && data.type === CART_CHANGED;
}

/** 거래완료 매물은 장바구니에 남지만 견적·구매 대상이 아니다 (빼기만) */
export function cartActionable(item: ListingSearchItem): boolean {
  return item.tradeStatus !== "completed";
}
