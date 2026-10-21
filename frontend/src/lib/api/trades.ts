import { api } from "@/lib/api/client";
import type { PendingCounts, QuoteItem, Trade, TradeCreateRequest, TradePage, TradeRole } from "@/types/trade";

const action = (tradeId: string, what: "complete" | "accept" | "reject") =>
  api<Trade>(`/api/v1/trades/${encodeURIComponent(tradeId)}/${what}`, { method: "POST" });

export const tradesApi = {
  /** idempotencyKey: 모달을 연 동안 같은 값. 응답이 유실돼 다시 눌러도 재고가 두 번 줄지 않게 (security.md "중복 생성 방지") */
  create: (req: TradeCreateRequest, idempotencyKey: string) =>
    api<Trade>("/api/v1/trades", { method: "POST", body: JSON.stringify(req), headers: { "Idempotency-Key": idempotencyKey } }),
  /** 견적 요청 1~20개. 하나라도 틀리면 아무것도 안 생긴다. 키는 create 와 같은 이유 */
  createQuotes: (items: QuoteItem[], idempotencyKey: string) =>
    api<Trade[]>("/api/v1/trades/quotes", {
      method: "POST",
      body: JSON.stringify({ items }),
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  /** 구매자 거래완료 → 구매확정 */
  complete: (tradeId: string) => action(tradeId, "complete"),
  /** 판매자 견적 수락(매물 단가 = 희망단가)·거절 → 견적수락·견적거절 */
  accept: (tradeId: string) => action(tradeId, "accept"),
  reject: (tradeId: string) => action(tradeId, "reject"),
  /** 취소 = 행 삭제 → 204 (돌려줄 거래 없음) */
  cancel: (tradeId: string) => api<null>(`/api/v1/trades/${encodeURIComponent(tradeId)}/cancel`, { method: "POST" }),
  list: (role: TradeRole, opts: { reg?: string; cursor?: string } = {}) => {
    const q = new URLSearchParams({ role });
    if (opts.reg) q.set("reg", opts.reg);
    if (opts.cursor) q.set("cursor", opts.cursor);
    return api<TradePage>(`/api/v1/trades?${q}`, { cache: "no-store" });
  },
  pendingCounts: () => api<PendingCounts>("/api/v1/trades/pending-counts", { cache: "no-store" }),
};
