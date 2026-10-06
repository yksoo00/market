import type { ListingSearchItem, TradeStatus } from "@/types/listing";

// 검색 결과 화면의 상태는 URL 파라미터가 원본 (뒤로가기·새로고침·공유 시 유지).
// 스펙: docs/superpowers/specs/2026-10-01-search-results-design.md

export type SearchField = "all" | "name" | "brand";
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

/**
 * search = 전체 검색(/search), mine = 내 판매글(/my/listings). 같은 화면 부품을 쓰고 경로·거래상태 기본값·API 의 mine 만 다르다.
 * 내 글은 거래완료한 것도 보여야 해서 거래상태 기본값이 "전체"다 (검색은 "거래 가능").
 */
export type SearchScope = "search" | "mine";

const defaultStatus = (scope: SearchScope): StatusFilter => (scope === "mine" ? "all" : "available");

export type RawSearchParams = Record<string, string | string[] | undefined>;

// 수치는 docs/security.md "입력 검증"이 원본
export const MAX_QUERY = 100;
export const MAX_STOCK = 100_000;
export const MAX_PRICE = 1_000_000_000;

const FIELDS: readonly SearchField[] = ["all", "name", "brand"];
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
export function parseSearchParams(raw: RawSearchParams, scope: SearchScope = "search"): SearchQuery {
  const field = first(raw.field) as SearchField;
  const status = first(raw.status) as StatusFilter;
  const query: SearchQuery = {
    // 넘치는 검색어를 그대로 보내면 서버 400 이 [다시 시도]로도 안 풀린다 → 잘라서 쓴다
    q: first(raw.q).trim().slice(0, MAX_QUERY).trim(),
    field: FIELDS.includes(field) ? field : "all",
    category: first(raw.category).trim(),
    status: STATUSES.includes(status) ? status : defaultStatus(scope),
  };
  const minStock = intInRange(first(raw.minStock), MAX_STOCK);
  const minPrice = intInRange(first(raw.minPrice), MAX_PRICE);
  const maxPrice = intInRange(first(raw.maxPrice), MAX_PRICE);
  const deliveryBy = first(raw.deliveryBy);
  if (minStock !== undefined) query.minStock = minStock;
  // 뒤집힌 가격 쌍을 그대로 두면 필터 폼이 처음부터 무효라 '적용'이 이유 없이 막힌다 → 둘 다 버림
  const inverted = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice;
  if (minPrice !== undefined && !inverted) query.minPrice = minPrice;
  if (maxPrice !== undefined && !inverted) query.maxPrice = maxPrice;
  if (isValidDate(deliveryBy)) query.deliveryBy = deliveryBy;
  return query;
}

// 검색어·필터 매칭은 서버가 한다 (GET /api/v1/listings, 규칙은 docs/superpowers/specs/2026-10-02-search-api-design.md)

/** 기본값인 파라미터는 생략 */
export function buildSearchHref(query: SearchQuery, scope: SearchScope = "search"): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.field !== "all") p.set("field", query.field);
  if (query.category) p.set("category", query.category);
  if (query.status !== defaultStatus(scope)) p.set("status", query.status);
  if (query.minStock !== undefined) p.set("minStock", String(query.minStock));
  if (query.minPrice !== undefined) p.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) p.set("maxPrice", String(query.maxPrice));
  if (query.deliveryBy !== undefined) p.set("deliveryBy", query.deliveryBy);
  const s = p.toString();
  const path = scope === "mine" ? "/my/listings" : "/search";
  return s ? `${path}?${s}` : path;
}

/**
 * 검색 API(GET /api/v1/listings) 쿼리 문자열. 카테고리는 보내지 않는다 — 화면 카테고리(한글 이름)와 DB 코드가
 * 안 맞고 카테고리 마스터가 미정 (decisions.md 2026-10-02 매물 검색). status 는 API 기본값(all)과 화면 기본값이
 * 달라 항상 보낸다
 */
export function searchApiParams(query: SearchQuery, cursor?: string, scope: SearchScope = "search"): string {
  const p = new URLSearchParams();
  // 서버가 인증 정보로 본인 글만 거른다 (본인 id 를 보내지 않는다)
  if (scope === "mine") p.set("mine", "true");
  if (query.q) p.set("q", query.q);
  if (query.field !== "all") p.set("field", query.field);
  p.set("status", query.status);
  if (query.minStock !== undefined) p.set("minStock", String(query.minStock));
  if (query.minPrice !== undefined) p.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) p.set("maxPrice", String(query.maxPrice));
  if (query.deliveryBy !== undefined) p.set("deliveryBy", query.deliveryBy);
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

// 카테고리는 보류 중이라 걸려 있어도 결과에 영향이 없으므로 세지 않는다 (예전 URL 의 category 가 "(1)"로 보이지 않게)
export function activeFilterCount(query: SearchQuery, scope: SearchScope = "search"): number {
  return [
    query.status !== defaultStatus(scope),
    query.minStock !== undefined,
    query.minPrice !== undefined,
    query.maxPrice !== undefined,
    query.deliveryBy !== undefined,
  ].filter(Boolean).length;
}

export function clearFilters(query: SearchQuery, scope: SearchScope = "search"): SearchQuery {
  return { q: query.q, field: query.field, category: "", status: defaultStatus(scope) };
}

export function listingHref(item: Pick<ListingSearchItem, "userId" | "regDate">): string {
  return `/listings/${item.userId}/${item.regDate}`;
}
