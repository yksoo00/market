// 장바구니 비교 규칙 (계획 docs/superpowers/plans/2026-10-22-cart-compare.md). 비교는 화면만 — 서버에 남기지 않는다
import { formatPrice } from "@/lib/format";
import { formatRegDate, isValidListingPath } from "@/lib/listingDetail";
import { compare as c } from "@/messages/compare";
import { listing } from "@/messages/listing";
import type { ListingDetail, ListingSearchItem } from "@/types/listing";

export const MIN_COMPARE = 2;
// 칸(iframe) 폭에서도 열이 읽히는 개수 (사용자 결정 2026-10-22)
export const MAX_COMPARE = 4;

export interface CompareKey {
  userId: string;
  regDate: string;
}

/** 장바구니 [비교]를 못 여는 이유. 소분류 = 카테고리 코드 전체가 같음 (상품은 모두 소분류 코드에 붙는다) */
export function compareBlock(items: Pick<ListingSearchItem, "category">[]): null | "tooFew" | "tooMany" | "category" {
  if (items.length < MIN_COMPARE) return "tooFew";
  if (items.length > MAX_COMPARE) return "tooMany";
  if (new Set(items.map((i) => i.category)).size > 1) return "category";
  return null;
}

// uuid 에 "-" 가 있어 매물 키는 "_" 로, 매물 사이는 "," 로 잇는다
export function compareHref(items: CompareKey[]): string {
  return `/my/cart/compare?items=${items.map((i) => `${i.userId}_${i.regDate}`).join(",")}`;
}

/** 주소의 items. 형식·개수(2~4)·중복이 틀리면 null — 손으로 고친 주소는 장바구니에서 다시 고르게 한다 */
export function parseCompareItems(raw: string | null): CompareKey[] | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length < MIN_COMPARE || parts.length > MAX_COMPARE || new Set(parts).size !== parts.length) return null;
  const keys: CompareKey[] = [];
  for (const part of parts) {
    const [userId, regDate, ...rest] = part.split("_");
    if (rest.length > 0 || !userId || !regDate || !isValidListingPath(userId, regDate)) return null;
    keys.push({ userId, regDate });
  }
  return keys;
}

export const sameKey = (a: CompareKey, b: CompareKey) => a.userId.toLowerCase() === b.userId.toLowerCase() && a.regDate === b.regDate;

export function withoutItem(items: CompareKey[], gone: CompareKey): CompareKey[] {
  return items.filter((i) => !sameKey(i, gone));
}

export interface CompareRow {
  key: string;
  label: string;
  values: string[];
  /** 상품끼리 값이 다름 — 줄 강조, [다른 항목만 보기] */
  differs: boolean;
  /** 가장 좋은 값인 열 번호 (동점 모두) */
  best: ReadonlySet<number>;
  badge?: string;
  mono?: boolean;
  /** 여러 줄 글 (제품 개요) */
  long?: boolean;
}

const t = listing.detail;
const r = t.rows;
const num = new Intl.NumberFormat("ko-KR");
const orEmpty = (v: string | null) => v ?? t.empty;
const count = (n: number | null) => (n === null ? t.empty : num.format(n));
const has = (v: string | null) => (v ? c.rows.has : c.rows.none);

interface RowSpec {
  key: string;
  label: string;
  value: (d: ListingDetail) => string;
  mono?: boolean;
  long?: boolean;
  /** 가장 좋은 값: 비교할 숫자·날짜(값 없으면 null)와 방향 */
  best?: { of: (d: ListingDetail) => number | string | null; pick: "min" | "max"; badge: string };
}

// 상세 화면 정보 표 순서(infoRows) 그대로, 그 뒤에 상세의 나머지 칸 (사용자 결정: 상세의 모든 칸)
const SPECS: RowSpec[] = [
  { key: "brand", label: r.brand, value: (d) => d.prodBrand },
  { key: "specInfo", label: c.rows.specInfo, value: (d) => orEmpty(d.prodSpecInfo) },
  { key: "prodId", label: r.prodId, value: (d) => d.prodId, mono: true },
  { key: "leadTime", label: r.leadTime, value: (d) => orEmpty(d.deliveryDate), mono: true, best: { of: (d) => d.deliveryDate, pick: "min", badge: c.best.leadTime } },
  { key: "state", label: r.state, value: (d) => d.prodState },
  { key: "unitPrice", label: r.unitPrice, value: (d) => t.won(formatPrice(d.salesUnitPrice)), mono: true, best: { of: (d) => d.salesUnitPrice, pick: "min", badge: c.best.unitPrice } },
  { key: "stock", label: r.stock, value: (d) => count(d.stockQuantity), mono: true, best: { of: (d) => d.stockQuantity, pick: "max", badge: c.best.stock } },
  { key: "category", label: r.category, value: (d) => d.categoryPath ?? d.category },
  { key: "tradeType", label: r.tradeType, value: (d) => d.tradeType },
  { key: "mufcDate", label: r.mufcDate, value: (d) => orEmpty(d.mufcDate), mono: true },
  { key: "minOrder", label: r.minOrder, value: (d) => count(d.minOrderQuantity), mono: true, best: { of: (d) => d.minOrderQuantity, pick: "min", badge: c.best.minOrder } },
  { key: "orderUnit", label: r.orderUnit, value: (d) => count(d.orderUnit), mono: true },
  { key: "salesQuantity", label: r.salesQuantity, value: (d) => count(d.salesQuantity), mono: true },
  { key: "warranty", label: r.warranty, value: (d) => orEmpty(d.warrantyUntil), mono: true, best: { of: (d) => d.warrantyUntil, pick: "max", badge: c.best.warranty } },
  { key: "coverage", label: r.coverage, value: (d) => orEmpty(d.warrantyCoverage) },
  { key: "replaceProd", label: c.rows.replaceProd, value: (d) => orEmpty(d.replaceProd) },
  // 서류는 비공개 파일이라 있음/없음만 — 내용은 상세에서 연다
  { key: "dataSheet", label: t.dataSheet, value: (d) => has(d.listingDataSheet) },
  { key: "testReport", label: t.docs.testReport, value: (d) => has(d.testReport) },
  { key: "certificate", label: t.docs.certificate, value: (d) => has(d.certificateOfAuthen) },
  { key: "photoCount", label: c.rows.photoCount, value: (d) => c.rows.photos(d.photos.length) },
  { key: "tradeStatus", label: c.rows.tradeStatus, value: (d) => (d.tradeStatus === "completed" ? c.rows.completed : c.rows.available) },
  { key: "regDate", label: r.regDate, value: (d) => formatRegDate(d.regDate), mono: true },
  { key: "description", label: c.rows.description, value: (d) => orEmpty(d.description), long: true },
];

/**
 * 가장 좋은 값의 열. 값이 모두 같으면 표시하지 않는다(고를 게 없음). 거래완료·값 없는 상품은 후보가 아니다 —
 * 살 수 없거나 비교할 값이 없어서
 */
function bestOf(details: ListingDetail[], spec: NonNullable<RowSpec["best"]>, differs: boolean): ReadonlySet<number> {
  if (!differs) return new Set();
  const candidates = details
    .map((d, i) => ({ i, v: d.tradeStatus === "completed" ? null : spec.of(d) }))
    .filter((x): x is { i: number; v: number | string } => x.v !== null);
  if (candidates.length === 0) return new Set();
  const better = (a: number | string, b: number | string) => (spec.pick === "min" ? a < b : a > b);
  const top = candidates.reduce((acc, x) => (better(x.v, acc) ? x.v : acc), candidates[0].v);
  return new Set(candidates.filter((x) => x.v === top).map((x) => x.i));
}

export function compareRows(details: ListingDetail[]): CompareRow[] {
  return SPECS.map((spec) => {
    const values = details.map(spec.value);
    const differs = new Set(values).size > 1;
    return {
      key: spec.key,
      label: spec.label,
      values,
      differs,
      best: spec.best ? bestOf(details, spec.best, differs) : new Set<number>(),
      badge: spec.best?.badge,
      mono: spec.mono,
      long: spec.long,
    };
  });
}
