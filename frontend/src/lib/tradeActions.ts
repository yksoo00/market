import type { Trade } from "@/types/trade";

export type RowAction = "complete" | "cancel" | "accept" | "reject" | "buy" | "requote";

/**
 * 목록 한 줄에서 지금 누를 수 있는 버튼 (스펙 2026-10-20 "화면"). 표시용 — 서버가 상태 조건으로 다시 막는다.
 * 견적: 구매자는 답 전 [취소]·수락 뒤 [구매]·거절 뒤 [재요청]·[취소], 판매자는 답 전 [수락]·[거절].
 * 구매요청(직접 구매든 수락된 견적에서 이어진 행이든 같다): 구매자 [거래완료]·[취소], 판매자 [취소].
 */
export function rowActions(item: Pick<Trade, "tradeStats">, asBuyer: boolean): RowAction[] {
  // 견적서 한 건은 한 행이 끝까지 이어져(견적수락 → 구매요청 → 구매확정) 종류가 아니라 진행 상태로 정한다
  switch (item.tradeStats) {
    case "quoteRequested":
      return asBuyer ? ["cancel"] : ["accept", "reject"];
    case "quoteAccepted":
      return asBuyer ? ["buy"] : [];
    case "quoteRejected":
      return asBuyer ? ["requote", "cancel"] : [];
    case "requested":
      return asBuyer ? ["complete", "cancel"] : ["cancel"];
    default:
      return [];
  }
}
