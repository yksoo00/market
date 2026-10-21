import type { Trade } from "@/types/trade";

export type RowAction = "complete" | "cancel" | "accept" | "reject" | "buy";

/**
 * 목록 한 줄에서 지금 누를 수 있는 버튼 (스펙 2026-10-20 "화면"). 표시용 — 서버가 상태 조건으로 다시 막는다.
 * 견적: 구매자는 답 전 [취소]·답 뒤 [구매], 판매자는 답 전 [수락]·[거절]. 구매: 구매자 [거래완료]·[취소], 판매자 [취소].
 */
export function rowActions(item: Pick<Trade, "tradeType" | "tradeStats">, asBuyer: boolean): RowAction[] {
  if (item.tradeType === "quote") {
    if (item.tradeStats === "quoteRequested") return asBuyer ? ["cancel"] : ["accept", "reject"];
    if (item.tradeStats === "quoteReplied") return asBuyer ? ["buy"] : [];
    return [];
  }
  if (item.tradeStats === "requested") return asBuyer ? ["complete", "cancel"] : ["cancel"];
  return [];
}
