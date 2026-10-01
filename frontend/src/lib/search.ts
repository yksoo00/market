import type { ListingSearchItem, TradeStatus } from "@/types/listing";

// 검색 결과 화면의 상태는 URL 파라미터가 원본 (뒤로가기·새로고침·공유 시 유지).
// 스펙: docs/superpowers/specs/2026-10-01-search-results-design.md

export type SearchField = "name" | "brand";
export type StatusFilter = TradeStatus | "all";

export interface SearchQuery {
  q: string;
  field: SearchField;
  category: string;
  status: StatusFilter;
  minStock?: number;
  minPrice?: number;
  maxPrice?: number;
  /** YYYY-MM-DD */
  deliveryBy?: string;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

// 수치는 docs/security.md "입력 검증"이 원본
export const MAX_STOCK = 100_000;
export const MAX_PRICE = 1_000_000_000;

const FIELDS: readonly SearchField[] = ["name", "brand"];
const STATUSES: readonly StatusFilter[] = ["available", "completed", "all"];

/** 실제 존재하는 YYYY-MM-DD인지 */
export function isValidDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

function intInRange(s: string, max: number): number | undefined {
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n <= max ? n : undefined;
}

// URL을 손으로 고친 잘못된 값은 오류 없이 무시(기본값)한다
export function parseSearchParams(raw: RawSearchParams): SearchQuery {
  const field = first(raw.field) as SearchField;
  const status = first(raw.status) as StatusFilter;
  const query: SearchQuery = {
    q: first(raw.q).trim(),
    field: FIELDS.includes(field) ? field : "name",
    category: first(raw.category).trim(),
    status: STATUSES.includes(status) ? status : "available",
  };
  const minStock = intInRange(first(raw.minStock), MAX_STOCK);
  const minPrice = intInRange(first(raw.minPrice), MAX_PRICE);
  const maxPrice = intInRange(first(raw.maxPrice), MAX_PRICE);
  const deliveryBy = first(raw.deliveryBy);
  if (minStock !== undefined) query.minStock = minStock;
  if (minPrice !== undefined) query.minPrice = minPrice;
  if (maxPrice !== undefined) query.maxPrice = maxPrice;
  if (isValidDate(deliveryBy)) query.deliveryBy = deliveryBy;
  return query;
}

export function filterListings(items: readonly ListingSearchItem[], query: SearchQuery): ListingSearchItem[] {
  const needle = query.q.toLowerCase();
  return items.filter((i) => {
    if (needle) {
      const haystack = query.field === "brand" ? [i.prodBrand] : [i.prodName, i.prodNo ?? ""];
      if (!haystack.some((s) => s.toLowerCase().includes(needle))) return false;
    }
    if (query.status !== "all" && i.tradeStatus !== query.status) return false;
    if (query.category && i.category !== query.category) return false;
    if (query.minStock !== undefined && i.stockQuantity < query.minStock) return false;
    if (query.minPrice !== undefined && i.salesUnitPrice < query.minPrice) return false;
    if (query.maxPrice !== undefined && i.salesUnitPrice > query.maxPrice) return false;
    // YYYY-MM-DD는 문자열 비교가 날짜 비교와 같다
    if (query.deliveryBy !== undefined && (i.deliveryDate === null || i.deliveryDate > query.deliveryBy)) return false;
    return true;
  });
}

/** 기본값인 파라미터는 생략 */
export function buildSearchHref(query: SearchQuery): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.field !== "name") p.set("field", query.field);
  if (query.category) p.set("category", query.category);
  if (query.status !== "available") p.set("status", query.status);
  if (query.minStock !== undefined) p.set("minStock", String(query.minStock));
  if (query.minPrice !== undefined) p.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) p.set("maxPrice", String(query.maxPrice));
  if (query.deliveryBy !== undefined) p.set("deliveryBy", query.deliveryBy);
  const s = p.toString();
  return s ? `/search?${s}` : "/search";
}

export function activeFilterCount(query: SearchQuery): number {
  return [
    query.category !== "",
    query.status !== "available",
    query.minStock !== undefined,
    query.minPrice !== undefined,
    query.maxPrice !== undefined,
    query.deliveryBy !== undefined,
  ].filter(Boolean).length;
}

export function clearFilters(query: SearchQuery): SearchQuery {
  return { q: query.q, field: query.field, category: "", status: "available" };
}

export function listingHref(item: Pick<ListingSearchItem, "userId" | "regDate">): string {
  return `/listings/${item.userId}/${item.regDate}`;
}
