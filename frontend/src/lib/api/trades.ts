import { api } from "@/lib/api/client";
import type { PendingCounts, Trade, TradeCreateRequest, TradePage, TradeRole } from "@/types/trade";

const action = (tradeId: string, what: "complete" | "cancel") =>
  api<Trade>(`/api/v1/trades/${encodeURIComponent(tradeId)}/${what}`, { method: "POST" });

export const tradesApi = {
  /** idempotencyKey: 모달을 연 동안 같은 값. 응답이 유실돼 다시 눌러도 재고가 두 번 줄지 않게 (security.md "중복 생성 방지") */
  create: (req: TradeCreateRequest, idempotencyKey: string) =>
    api<Trade>("/api/v1/trades", { method: "POST", body: JSON.stringify(req), headers: { "Idempotency-Key": idempotencyKey } }),
  /** 구매자 거래완료 → 구매확정 */
  complete: (tradeId: string) => action(tradeId, "complete"),
  cancel: (tradeId: string) => action(tradeId, "cancel"),
  list: (role: TradeRole, opts: { reg?: string; cursor?: string } = {}) => {
    const q = new URLSearchParams({ role });
    if (opts.reg) q.set("reg", opts.reg);
    if (opts.cursor) q.set("cursor", opts.cursor);
    return api<TradePage>(`/api/v1/trades?${q}`, { cache: "no-store" });
  },
  pendingCounts: () => api<PendingCounts>("/api/v1/trades/pending-counts", { cache: "no-store" }),
};
