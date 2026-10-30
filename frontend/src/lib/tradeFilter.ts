import type { FilterField, FilterValues } from "@/lib/detailFilter";
import { firstParam } from "@/lib/detailFilter";
import { historyApiParams, historyFields, parseHistoryFilter } from "@/lib/historyFilter";
import { my } from "@/messages/my";
import { trade } from "@/messages/trade";
import type { TradeRole } from "@/types/trade";

// 내 활동내역 요청·구매 탭 검색·필터 (계획 2026-10-30 후속). 검색어·기간·금액·정렬은 거래이력과 같은 규칙(lib/historyFilter),
// 상태 칸만 더한다 — 이 목록에서 볼 수 있는 진행 중 상태 안에서 (서버도 같은 범위만 받는다).

const t = my.activityFilter;
const stats = trade.list.stats;

/** 구매자: 견적요청·견적수락·견적거절·구매요청, 판매자: 견적요청·구매요청 (TradeService.BUYER_ACTIVE·SELLER_ACTIVE) */
export const TRADE_STATUS_VALUES: Record<TradeRole, readonly ("quoteRequested" | "quoteAccepted" | "quoteRejected" | "requested")[]> = {
  buyer: ["quoteRequested", "quoteAccepted", "quoteRejected", "requested"],
  seller: ["quoteRequested", "requested"],
};

export function tradeFields(role: TradeRole): FilterField[] {
  const [period, amount, sort] = historyFields;
  return [
    {
      kind: "select",
      label: t.status,
      key: "status",
      defaultValue: "",
      options: [{ value: "", label: t.statusAll }, ...TRADE_STATUS_VALUES[role].map((s) => ({ value: s, label: stats[s] }))],
    },
    period.kind === "dateRange" ? { ...period, label: t.period } : period,
    amount,
    sort,
  ];
}

export const emptyTradeFilter = (): FilterValues => ({ q: "", from: "", to: "", min: "", max: "", sort: "latest", status: "" });

/** 주소에서 필터 값. 거래이력과 같은 정리(틀린 값은 버림) + 상태는 이 역할이 볼 수 있는 값만 */
export function parseTradeFilter(raw: Record<string, string | string[] | undefined>, role: TradeRole): FilterValues {
  const status = firstParam(raw.status);
  return { ...parseHistoryFilter(raw), status: TRADE_STATUS_VALUES[role].find((s) => s === status) ?? "" };
}

/** API 쿼리 파라미터 (값이 있는 것만) */
export function tradeApiParams(f: FilterValues): [string, string][] {
  const out = historyApiParams(f);
  if (f.status) out.push(["status", f.status]);
  return out;
}
