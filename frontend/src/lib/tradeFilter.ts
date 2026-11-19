import type { ColumnSortValues } from "@/lib/columnSort";
import type { FilterField, FilterValues } from "@/lib/detailFilter";
import { firstParam } from "@/lib/detailFilter";
import { historyApiParams, historyFields, parseHistoryFilter } from "@/lib/historyFilter";
import { search } from "@/messages/search";
import { my } from "@/messages/my";
import { trade } from "@/messages/trade";
import type { TradeRole } from "@/types/trade";

// 내 활동내역 요청·구매 탭 검색·필터 (계획 2026-10-30 후속). 검색어·기간·금액·정렬은 거래이력과 같은 규칙(lib/historyFilter),
// 상태 칸만 더한다 — 이 목록에서 볼 수 있는 진행 중 상태 안에서 (서버도 같은 범위만 받는다).

const t = my.activityFilter;
const stats = trade.list.stats;

/** 활동내역 요청·구매 표의 열 → 그 열의 오름·내림 sort 값 (열 머리 정렬 2026-11-03). 기본(최신순 = 거래ID 내림)은 열이 아니라 모든 열이 꺼진 상태 */
export const TRADE_SORT_COLUMNS = {
  name: { asc: "nameAsc", desc: "nameDesc" },
  party: { asc: "partyAsc", desc: "partyDesc" },
  quantity: { asc: "quantityAsc", desc: "quantityDesc" },
  unitPrice: { asc: "unitPriceAsc", desc: "unitPriceDesc" },
  amount: { asc: "amountAsc", desc: "amountDesc" },
  reqDeli: { asc: "reqDeliAsc", desc: "reqDeliDesc" },
  status: { asc: "statusAsc", desc: "statusDesc" },
} as const satisfies Record<string, ColumnSortValues>;
export type TradeSortColumn = keyof typeof TRADE_SORT_COLUMNS;

/** 이 목록의 sort 값 전부 (주소에서 읽는다). 서버 TradeFilterRules.ACTIVITY_SORTS 와 같다 — 칩 선택지는 그중 historyFields 의 3개 */
export const TRADE_SORTS: readonly string[] = ["latest", "oldest", ...Object.values(TRADE_SORT_COLUMNS).flatMap((v) => [v.asc, v.desc])];

/** sort 값이 어느 열의 오름·내림인가 (정렬 칩 글자용). 열 정렬이 아니면 null */
export function tradeSortColumn(sort: string): { column: TradeSortColumn; dir: "asc" | "desc" } | null {
  for (const column of Object.keys(TRADE_SORT_COLUMNS) as TradeSortColumn[]) {
    const v = TRADE_SORT_COLUMNS[column];
    if (sort === v.asc) return { column, dir: "asc" };
    if (sort === v.desc) return { column, dir: "desc" };
  }
  return null;
}

/** 구매자: 견적요청·견적수락·견적거절·구매요청, 판매자: 견적요청·구매요청 (TradeService.BUYER_ACTIVE·SELLER_ACTIVE) */
export const TRADE_STATUS_VALUES: Record<TradeRole, readonly ("quoteRequested" | "quoteAccepted" | "quoteRejected" | "requested")[]> = {
  buyer: ["quoteRequested", "quoteAccepted", "quoteRejected", "requested"],
  seller: ["quoteRequested", "requested"],
};

export function tradeFields(role: TradeRole): FilterField[] {
  const [period, amount, historySort] = historyFields;
  // 정렬 칩은 거래이력과 같은 선택지 3개 — 열 머리로 정한 값(상대 ▲ 등)의 칩 글자만 이 목록의 열 이름으로
  const sort: FilterField =
    historySort.kind === "select"
      ? {
          ...historySort,
          labelOf: (value) => {
            const hit = tradeSortColumn(value);
            return hit ? search.sort.columnText(t.sortColumns[hit.column], hit.dir) : undefined;
          },
        }
      : historySort;
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

export const emptyTradeFilter = (): FilterValues => ({ q: "", field: "all", from: "", to: "", min: "", max: "", sort: "latest", status: "" });

/** 주소에서 필터 값. 거래이력과 같은 정리(틀린 값은 버림) + 상태는 이 역할이 볼 수 있는 값만 */
export function parseTradeFilter(raw: Record<string, string | string[] | undefined>, role: TradeRole): FilterValues {
  const status = firstParam(raw.status);
  // 정렬은 이 목록의 sort 값(열 머리 정렬 포함)만 읽는다 — 거래이력 전용 값(구분 등)은 최신순
  return { ...parseHistoryFilter(raw, TRADE_SORTS), status: TRADE_STATUS_VALUES[role].find((s) => s === status) ?? "" };
}

/** API 쿼리 파라미터 (값이 있는 것만) */
export function tradeApiParams(f: FilterValues): [string, string][] {
  const out = historyApiParams(f);
  if (f.status) out.push(["status", f.status]);
  return out;
}
