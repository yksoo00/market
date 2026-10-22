// 장바구니 (스펙 2026-10-21-cart-design.md). 헤더 배지와, 장바구니가 바뀌었다는 신호
import type { ListingSearchItem } from "@/types/listing";

/** 배지 글자. 0 이하는 배지 없음, 100 부터는 99+ (헤더 폭이 좁아서) */
export function cartBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

/**
 * 담기·빼기·견적·구매 뒤 장바구니가 바뀌었다고 알린다. 헤더(최상위 창)와 열려 있는 장바구니 칸(iframe)이 둘 다
 * 다시 읽어야 해서 window.top postMessage 가 아니라 BroadcastChannel — 같은 출처의 모든 창이 받는다(다른 출처는 못 받음).
 * 칸 엔진의 "market-tile" 메시지와도 섞이지 않는다
 */
const CHANNEL = "market-cart";

export function notifyCartChanged(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

/** 구독 — 돌려준 함수로 끊는다 */
export function onCartChanged(listener: () => void): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => listener();
  return () => channel.close();
}

/** 거래완료 매물은 장바구니에 남지만 견적·구매 대상이 아니다 (빼기만) */
export function cartActionable(item: ListingSearchItem): boolean {
  return item.tradeStatus !== "completed";
}
