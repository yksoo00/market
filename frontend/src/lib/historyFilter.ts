import { firstParam, type FilterField, type FilterValues, type SearchScopeSelect } from "@/lib/detailFilter";
import { SEARCH_FIELDS } from "@/lib/search";
import { my } from "@/messages/my";
import { search } from "@/messages/search";

// 내 거래이력 검색·필터 (계획 2026-10-30). 수치는 docs/security.md "입력 검증" 거래이력이 원본 — 백엔드와 같은 값.

export const MAX_Q = 100;
/** 거래 금액 컬럼이 int */
export const MAX_AMOUNT = 2_147_483_647;
/**
 * 정렬 칩 선택지 (2026-10-30, 사용자 지시 "진짜 필요한 것만"). 서버는 oldest 도 받지만 화면엔 두지 않는다 —
 * 주소의 ?sort=oldest 는 최신순으로 읽는다
 */
export const HISTORY_SORTS = ["latest", "amountDesc", "amountAsc"] as const;
export type HistorySort = (typeof HISTORY_SORTS)[number];

/** 주소 파라미터 이름 = 폼 값 키. API 는 min·max 를 minAmount·maxAmount 로 보낸다 */
export const HISTORY_KEYS = { q: "q", field: "field", from: "from", to: "to", min: "min", max: "max", sort: "sort" } as const;

const t = my.history.filter;

export const historyFields: FilterField[] = [
  { kind: "dateRange", label: t.period, fromKey: "from", toKey: "to", fromLabel: t.from, toLabel: t.to },
  { kind: "numberRange", label: t.amount, minKey: "min", maxKey: "max", minLabel: t.minAmount, maxLabel: t.maxAmount, suffix: t.won },
  { kind: "select", label: t.sort, key: "sort", defaultValue: "latest", options: HISTORY_SORTS.map((s) => ({ value: s, label: t.sorts[s] })) },
];

/** 검색창 왼쪽 구분 select (DetailFilter searchField) — 범위·문구는 매물 검색창과 같다 (2026-10-30) */
export const tradeSearchField: SearchScopeSelect = {
  key: "field",
  label: search.form.fieldLabel,
  defaultValue: "all",
  options: SEARCH_FIELDS.map((f) => ({ value: f, label: search.form.fields[f] })),
};

export const emptyHistoryFilter = (): FilterValues => ({ q: "", field: "all", from: "", to: "", min: "", max: "", sort: "latest" });

/** 존재하는 yyyy-MM-dd 인가 (2026-02-30 같은 날짜 거름) */
export function isRealDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isAmount = (s: string) => /^\d{1,10}$/.test(s) && Number(s) <= MAX_AMOUNT;

/**
 * 주소(?q=&field=&from=&to=&min=&max=&sort=)에서 필터 값. 손으로 고친 틀린 값은 버린다 — 그대로 보내면 서버가 400 을 돌려
 * 목록이 오류 화면이 된다. 앞뒤가 뒤집힌 범위는 뒤쪽 값을 버린다
 */
export function parseHistoryFilter(raw: Record<string, string | string[] | undefined>): FilterValues {
  const q = firstParam(raw.q).trim();
  let from = firstParam(raw.from);
  let to = firstParam(raw.to);
  let min = firstParam(raw.min);
  let max = firstParam(raw.max);
  const sort = firstParam(raw.sort);
  const field = firstParam(raw.field);
  if (!isRealDate(from)) from = "";
  if (!isRealDate(to)) to = "";
  if (from && to && from > to) to = "";
  if (!isAmount(min)) min = "";
  if (!isAmount(max)) max = "";
  if (min && max && Number(min) > Number(max)) max = "";
  return {
    q: q.length <= MAX_Q ? q : "",
    field: SEARCH_FIELDS.find((f) => f === field) ?? "all",
    from,
    to,
    min,
    max,
    sort: HISTORY_SORTS.find((s) => s === sort) ?? "latest",
  };
}

/** API 쿼리 파라미터 (값이 있는 것만). 정렬·구분이 기본이면 보내지 않고, 검색어가 없으면 구분도 안 보낸다 */
export function historyApiParams(f: FilterValues): [string, string][] {
  const out: [string, string][] = [];
  if (f.q) out.push(["q", f.q]);
  if (f.q && f.field && f.field !== "all") out.push(["field", f.field]);
  if (f.from) out.push(["from", f.from]);
  if (f.to) out.push(["to", f.to]);
  if (f.min) out.push(["minAmount", f.min]);
  if (f.max) out.push(["maxAmount", f.max]);
  if (f.sort && f.sort !== "latest") out.push(["sort", f.sort]);
  return out;
}

/** 서버가 돌려준 필드 오류의 이름(API)을 폼 키로 */
export const historyFieldFromApi: Record<string, string> = { q: "q", field: "field", from: "from", to: "to", minAmount: "min", maxAmount: "max", sort: "sort" };
