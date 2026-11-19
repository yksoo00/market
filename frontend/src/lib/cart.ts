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

/** 서버가 한 줄에 받는 수량 상한 (CartAddRequest·CartQuantityRequest) */
const MAX_QUANTITY = 100_000;

/**
 * 장바구니 줄의 +/- 가 바꿀 다음 수량 (주문단위만큼). 못 바꾸면 null — 버튼을 비활성으로 둔다.
 * 내릴 때는 최소주문량 아래로 못 가고(없애려면 [빼기]), 올릴 때는 지금 묶이지 않은 재고(item.stockQuantity)가 주문단위 이상이어야 한다.
 * 서버가 최종 판정한다(동시에 누가 가져갔으면 400)
 */
export function nextCartQuantity(item: ListingSearchItem, current: number, direction: "down" | "up"): number | null {
  if (!cartActionable(item)) return null;
  const unit = item.orderUnit ?? 1;
  const min = item.minOrderQuantity ?? 1;
  if (direction === "down") return current - unit >= min ? current - unit : null;
  // 담기와 같은 한 줄 상한(서버 100000)을 넘기는 + 도 막는다
  return unit <= (item.stockQuantity ?? 0) && current + unit <= MAX_QUANTITY ? current + unit : null;
}

/** 한 줄 금액 = 단가 × 담은 수량 */
export function cartLineAmount(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

/** 선택한 줄들의 합계 금액 */
export function cartTotal(lines: readonly { unitPrice: number; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + cartLineAmount(l.unitPrice, l.quantity), 0);
}

/** 담은 시각(yyyyMMddHHmmss, UTC)으로부터 자동 삭제(1시간)까지 남은 분. 시각을 모르면 null */
export function remainingMinutes(addedAt: string | undefined, now: number = Date.now()): number | null {
  const m = addedAt ? /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(addedAt) : null;
  if (!m) return null;
  const added = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return 60 - Math.floor((now - added) / 60_000);
}

/** 거래완료 매물은 장바구니에 남지만 견적·구매 대상이 아니다 (빼기만) */
export function cartActionable(item: ListingSearchItem): boolean {
  return item.tradeStatus !== "completed";
}
