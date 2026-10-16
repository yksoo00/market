// 내 판매글 표의 "구매요청 N건" (GET /api/v1/trades/pending-counts). 확정·취소는 세지 않는다
import { trade } from "@/messages/trade";
import type { PendingCounts } from "@/types/trade";

/** 구매요청 상태 건수 표시. 없으면 null (화면엔 대시) */
export function pendingLabel(counts: PendingCounts | null, regDate: string): string | null {
  const n = counts?.[regDate] ?? 0;
  return n > 0 ? trade.pending.count(n) : null;
}

/** 받은 구매요청을 그 매물로 걸러 연다 */
export function salesHref(regDate: string): string {
  return `/my/sales?reg=${regDate}`;
}
