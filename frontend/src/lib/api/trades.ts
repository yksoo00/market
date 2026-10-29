import { api } from "@/lib/api/client";
import type { HistorySide, PendingCounts, QuoteItem, Trade, TradeCreateRequest, TradeHistoryPage, TradePage, TradeRole, TradeScopes } from "@/types/trade";

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
  /** 수락된 견적에서 [구매] — 같은 거래가 구매요청이 된다 (새 거래 없음). 단가는 서버가 지금 매물 단가로 정한다 */
  purchaseQuote: (tradeId: string, body: { orderQuantity: number; reqDeliDate: string; remarks?: string }) =>
    api<Trade>(`/api/v1/trades/${encodeURIComponent(tradeId)}/purchase`, { method: "POST", body: JSON.stringify(body) }),
  /** 구매자 거래완료 → 구매확정 */
  complete: (tradeId: string) => action(tradeId, "complete"),
  /** 판매자 견적 수락(매물 단가 = 희망단가)·거절 → 견적수락·견적거절 */
  accept: (tradeId: string) => action(tradeId, "accept"),
  reject: (tradeId: string) => action(tradeId, "reject"),
  /** 취소 = 행 삭제 → 204 (돌려줄 거래 없음) */
  cancel: (tradeId: string) => api<null>(`/api/v1/trades/${encodeURIComponent(tradeId)}/cancel`, { method: "POST" }),
  /** active: 내 활동내역 — 진행 중 거래만 (구매자 견적요청·견적수락·견적거절·구매요청, 판매자 견적요청·구매요청) */
  list: (role: TradeRole, opts: { reg?: string; cursor?: string; active?: boolean } = {}) => {
    const q = new URLSearchParams({ role });
    if (opts.reg) q.set("reg", opts.reg);
    if (opts.cursor) q.set("cursor", opts.cursor);
    if (opts.active) q.set("active", "true");
    return api<TradePage>(`/api/v1/trades?${q}`, { cache: "no-store" });
  },
  pendingCounts: () => api<PendingCounts>("/api/v1/trades/pending-counts", { cache: "no-store" }),
  /** 내 거래이력(구매확정만). cursor 는 응답의 nextCursor */
  history: (side: HistorySide, cursor?: string) => {
    const q = new URLSearchParams({ side });
    if (cursor) q.set("cursor", cursor);
    return api<TradeHistoryPage>(`/api/v1/trades/history?${q}`, { cache: "no-store" });
  },
  /** 검색 범위 탭 판정. 비로그인이면 401 — 호출하는 쪽이 탭 없음으로 본다 */
  scopes: () => api<TradeScopes>("/api/v1/trades/scopes", { cache: "no-store" }),
};
