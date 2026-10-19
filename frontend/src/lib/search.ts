import type { ListingSearchItem, TradeStatus } from "@/types/listing";

// 검색 결과 화면의 상태는 URL 파라미터가 원본 (뒤로가기·새로고침·공유 시 유지).
// 스펙: docs/superpowers/specs/2026-10-01-search-results-design.md

export type SearchField = "all" | "name" | "brand";
export type StatusFilter = TradeStatus | "all";
/** 상품상태 "이 구간 이상": new = 신품, 90 = 신품대비 90~99% 이상 … */
export type StateFilter = "new" | "90" | "80" | "70" | "60" | "50";
/** 불량지원: replace = 대체, refund = 환불 (URL 에 한글을 싣지 않게 영문 키) */
export type CoverageFilter = "replace" | "refund";
/** 가진 자료. 고른 것을 전부 가진 매물만 */
export type HasItem = "datasheet" | "photo" | "testReport" | "certificate" | "replaceProd";

export const STATE_FILTERS: readonly StateFilter[] = ["new", "90", "80", "70", "60", "50"];
export const COVERAGE_FILTERS: readonly CoverageFilter[] = ["replace", "refund"];
export const HAS_ITEMS: readonly HasItem[] = ["datasheet", "photo", "testReport", "certificate", "replaceProd"];
/** 보증기간 "N개월 이상" 선택지. URL·API 는 일수(× 30) — 등록 값(listingExtra WARRANTY_MONTHS)과 같은 단위 */
export const WARRANTY_FILTER_MONTHS = [1, 3, 6, 12, 24, 36] as const;

export interface SearchQuery {
  q: string;
  field: SearchField;
  /** 대·중·소 카테고리 코드(`P01`, `P01-Q01`, `P01-Q01-R001`). 고른 분류와 그 아래 전부. 빈 값 = 전체 */
  category: string;
  status: StatusFilter;
  /** 검색 화면의 [전체 / 내 판매]. 필터가 아니라 범위 — 필터 개수에 안 세고 초기화해도 남는다. 내 판매글 화면(scope mine)은 늘 내 글이라 false */
  mine: boolean;
  minStock?: number;
  minPrice?: number;
  maxPrice?: number;
  /** YYYY-MM-DD */
  deliveryBy?: string;
  // 상세 필터 (2026-10-19)
  state?: StateFilter;
  brand?: string;
  /** 보증기한 일수 이상 (WARRANTY_FILTER_MONTHS × 30) */
  minWarranty?: number;
  coverage?: CoverageFilter;
  /** 빈 배열 = 조건 없음. 순서는 HAS_ITEMS 순서로 맞춘다 (같은 조건이 다른 URL 이 되지 않게) */
  has: HasItem[];
  /** 최소주문수량이 이 값 이하 */
  maxMinOrder?: number;
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
export const MAX_BRAND = 50;
export const MAX_MIN_ORDER = 100_000;
/** 서버 ListingSearchCondition.category 와 같은 형식 (대 `P01` · 중 `P01-Q01` · 소 `P01-Q01-R001`) */
const CATEGORY_PATTERN = /^[A-Z0-9]{1,4}(-[A-Z0-9]{1,4}){0,2}$/;
const WARRANTY_DAYS: readonly number[] = WARRANTY_FILTER_MONTHS.map((m) => m * 30);

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
    // 형식이 틀린 코드를 보내면 서버 400 이 [다시 시도]로도 안 풀린다 → 버린다
    category: CATEGORY_PATTERN.test(first(raw.category)) ? first(raw.category) : "",
    status: STATUSES.includes(status) ? status : defaultStatus(scope),
    mine: scope === "search" && first(raw.mine) === "1",
    has: HAS_ITEMS.filter((h) => first(raw.has).split(",").includes(h)),
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
  const state = first(raw.state) as StateFilter;
  if (STATE_FILTERS.includes(state)) query.state = state;
  const brand = first(raw.brand).trim().slice(0, MAX_BRAND).trim();
  if (brand) query.brand = brand;
  const minWarranty = intInRange(first(raw.minWarranty), Infinity);
  if (minWarranty !== undefined && WARRANTY_DAYS.includes(minWarranty)) query.minWarranty = minWarranty;
  const coverage = first(raw.coverage) as CoverageFilter;
  if (COVERAGE_FILTERS.includes(coverage)) query.coverage = coverage;
  const maxMinOrder = intInRange(first(raw.maxMinOrder), MAX_MIN_ORDER);
  if (maxMinOrder !== undefined && maxMinOrder >= 1) query.maxMinOrder = maxMinOrder;
  return query;
}

// 검색어·필터 매칭은 서버가 한다 (GET /api/v1/listings, 규칙은 docs/superpowers/specs/2026-10-02-search-api-design.md)

/** 기본값인 파라미터는 생략 */
export function buildSearchHref(query: SearchQuery, scope: SearchScope = "search"): string {
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (query.field !== "all") p.set("field", query.field);
  if (query.status !== defaultStatus(scope)) p.set("status", query.status);
  setFilterParams(p, query);
  if (scope === "search" && query.mine) p.set("mine", "1");
  const s = p.toString();
  const path = scope === "mine" ? "/my/listings" : "/search";
  return s ? `${path}?${s}` : path;
}

/** 거래상태 말고 필터 칸 전부. URL·API 이름이 같다 */
function setFilterParams(p: URLSearchParams, query: SearchQuery) {
  if (query.category) p.set("category", query.category);
  if (query.minStock !== undefined) p.set("minStock", String(query.minStock));
  if (query.minPrice !== undefined) p.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) p.set("maxPrice", String(query.maxPrice));
  if (query.deliveryBy !== undefined) p.set("deliveryBy", query.deliveryBy);
  if (query.state !== undefined) p.set("state", query.state);
  if (query.brand !== undefined) p.set("brand", query.brand);
  if (query.minWarranty !== undefined) p.set("minWarranty", String(query.minWarranty));
  if (query.coverage !== undefined) p.set("coverage", query.coverage);
  if (query.has.length > 0) p.set("has", query.has.join(","));
  if (query.maxMinOrder !== undefined) p.set("maxMinOrder", String(query.maxMinOrder));
}

/** 검색 API(GET /api/v1/listings) 쿼리 문자열. status 는 API 기본값(all)과 화면 기본값이 달라 항상 보낸다 */
export function searchApiParams(query: SearchQuery, cursor?: string, scope: SearchScope = "search"): string {
  const p = new URLSearchParams();
  // 서버가 인증 정보로 본인 글만 거른다 (본인 id 를 보내지 않는다)
  if (scope === "mine" || query.mine) p.set("mine", "true");
  if (query.q) p.set("q", query.q);
  if (query.field !== "all") p.set("field", query.field);
  p.set("status", query.status);
  setFilterParams(p, query);
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

/** 상세 필터(펼쳐야 보이는 칸) 중 걸린 개수 — [상세 필터] 버튼에 표시 */
export function detailFilterCount(query: SearchQuery): number {
  return [
    query.deliveryBy !== undefined,
    query.state !== undefined,
    query.brand !== undefined,
    query.minWarranty !== undefined,
    query.coverage !== undefined,
    query.has.length > 0,
    query.maxMinOrder !== undefined,
  ].filter(Boolean).length;
}

export function activeFilterCount(query: SearchQuery, scope: SearchScope = "search"): number {
  return (
    [
      query.status !== defaultStatus(scope),
      query.category !== "",
      query.minStock !== undefined,
      query.minPrice !== undefined,
      query.maxPrice !== undefined,
    ].filter(Boolean).length + detailFilterCount(query)
  );
}

export function clearFilters(query: SearchQuery, scope: SearchScope = "search"): SearchQuery {
  return { q: query.q, field: query.field, category: "", status: defaultStatus(scope), mine: query.mine, has: [] };
}

export function listingHref(item: Pick<ListingSearchItem, "userId" | "regDate">): string {
  return `/listings/${item.userId}/${item.regDate}`;
}
