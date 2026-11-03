// 받은 견적요청 한꺼번에 처리 (계획 2026-11-03-quote-bulk-reply.md). 같은 매물끼리 묶고, 묶음 합계를 재고와 견준다
import type { QuoteRequestItem } from "@/types/trade";

export interface QuoteGroup {
  /** 매물 등록일시 — 내 매물이라 이 값으로 매물이 정해진다 */
  regDate: string;
  prodName: string;
  /** 지금 재고 (모르면 null) */
  stock: number | null;
  items: QuoteRequestItem[];
}

/** 한 번에 처리하는 상한 — 서버 QuoteBulkService.MAX 와 같다 */
export const MAX_QUOTE_REPLY = 30;

/** 같은 매물끼리 묶는다. 묶음·묶음 안의 줄 모두 받은 순서(오래된 순)를 지킨다 */
export function groupQuoteRequests(items: readonly QuoteRequestItem[]): QuoteGroup[] {
  const groups = new Map<string, QuoteGroup>();
  for (const item of items) {
    const group = groups.get(item.regDate);
    if (group) group.items.push(item);
    else groups.set(item.regDate, { regDate: item.regDate, prodName: item.prodName, stock: item.stockQuantity, items: [item] });
  }
  return [...groups.values()];
}

/** 묶음의 요청 수량 합계 */
export function quantitySum(items: readonly Pick<QuoteRequestItem, "orderQuantity">[]): number {
  return items.reduce((sum, i) => sum + i.orderQuantity, 0);
}

/** 합계가 재고를 넘나 — 넘으면 [모두 수락]이 그 묶음을 통째로 막는다. 재고를 모르면 넘지 않은 것으로 본다(서버가 판정) */
export function overStock(stock: number | null, sum: number): boolean {
  return stock !== null && sum > stock;
}

/** 이미 처리됐거나 없어진 견적(구매자 취소 등) — 목록에서 뺀다 */
export function isHandledCode(code: string | null): boolean {
  return code === "TRADE_NOT_PENDING" || code === "TRADE_NOT_FOUND";
}
