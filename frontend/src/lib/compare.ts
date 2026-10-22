// 장바구니 비교 규칙 (계획 docs/superpowers/plans/2026-10-22-cart-compare.md). 비교는 화면만 — 서버에 남기지 않는다
import { infoRows, isValidListingPath, type InfoRow } from "@/lib/listingDetail";
import { todayInSeoul } from "@/lib/listingForm";
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

/**
 * 주소의 items. 형식·개수·중복이 틀리면 null — 손으로 고친 주소는 장바구니에서 다시 고르게 한다.
 * 1개는 받는다: 비교 화면에서 빼고 하나 남은 주소를 새로고침해도 빼기 직후와 같은 "2개 이상" 안내가 나오게 (화면이 막는다).
 * 중복은 uuid 대소문자를 무시하고 본다 — 서버는 같은 매물로 읽는다
 */
export function parseCompareItems(raw: string | null): CompareKey[] | null {
  if (!raw) return null;
  const parts = raw.split(",");
  if (parts.length > MAX_COMPARE || new Set(parts.map((p) => p.toLowerCase())).size !== parts.length) return null;
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
const orEmpty = (v: string | null) => v ?? t.empty;
const has = (v: string | null) => (v ? c.rows.has : c.rows.none);
// 숫자·날짜 칸은 고정폭 숫자 (상세 정보 표는 상품코드만 mono — 여기선 열끼리 자릿수를 맞춰 보게)
const MONO = new Set(["prodId", "leadTime", "unitPrice", "stock", "mufcDate", "minOrder", "orderUnit", "salesQuantity", "warranty", "regDate"]);

/** 상세 정보 표(infoRows)에 없는 상세 화면의 나머지 칸 — 사용자 결정: 상세의 모든 칸을 비교 */
function extraRows(d: ListingDetail): InfoRow[] {
  return [
    { key: "specInfo", label: c.rows.specInfo, value: orEmpty(d.prodSpecInfo) },
    { key: "replaceProd", label: c.rows.replaceProd, value: orEmpty(d.replaceProd) },
    // 서류는 비공개 파일이라 있음/없음만 — 내용은 상세에서 연다
    { key: "dataSheet", label: t.dataSheet, value: has(d.listingDataSheet) },
    { key: "testReport", label: t.docs.testReport, value: has(d.testReport) },
    { key: "certificate", label: t.docs.certificate, value: has(d.certificateOfAuthen) },
    { key: "photoCount", label: c.rows.photoCount, value: c.rows.photos(d.photos.length) },
    { key: "tradeStatus", label: c.rows.tradeStatus, value: d.tradeStatus === "completed" ? c.rows.completed : c.rows.available },
    { key: "description", label: c.rows.description, value: orEmpty(d.description) },
  ];
}

interface Best {
  /** 비교할 숫자·날짜. 값이 없거나 비교 대상이 아니면 null */
  of: (d: ListingDetail, today: string) => number | string | null;
  pick: "min" | "max";
  badge: string;
}

const BEST: Record<string, Best> = {
  // 납기일이 지났으면 이미 받을 수 있는 것이라 그대로 가장 빠른 후보
  leadTime: { of: (d) => d.deliveryDate, pick: "min", badge: c.best.leadTime },
  unitPrice: { of: (d) => d.salesUnitPrice, pick: "min", badge: c.best.unitPrice },
  stock: { of: (d) => d.stockQuantity, pick: "max", badge: c.best.stock },
  minOrder: { of: (d) => d.minOrderQuantity, pick: "min", badge: c.best.minOrder },
  // 끝나는 날이 늦을수록 남은 보증이 길다. 이미 끝난 보증은 후보가 아니다
  warranty: { of: (d, today) => (d.warrantyUntil && d.warrantyUntil >= today ? d.warrantyUntil : null), pick: "max", badge: c.best.warranty },
};

/** 살 수 없는 상품 — 거래완료, 또는 최소주문량만큼도 재고가 없음 (purchaseBlockReason 의 completed·lowStock) */
const buyable = (d: ListingDetail) => d.tradeStatus !== "completed" && d.stockQuantity !== null && d.stockQuantity >= d.minOrderQuantity;

/**
 * 가장 좋은 값의 열. 값이 모두 같으면 표시하지 않는다(고를 게 없음). 살 수 없는 상품·값 없는 상품은 후보가 아니다 —
 * 배지가 살 수 없는 상품을 가리키지 않게
 */
function bestOf(details: ListingDetail[], spec: Best, differs: boolean, today: string): ReadonlySet<number> {
  if (!differs) return new Set();
  const candidates = details
    .map((d, i) => ({ i, v: buyable(d) ? spec.of(d, today) : null }))
    .filter((x): x is { i: number; v: number | string } => x.v !== null);
  if (candidates.length === 0) return new Set();
  const better = (a: number | string, b: number | string) => (spec.pick === "min" ? a < b : a > b);
  const top = candidates.reduce((acc, x) => (better(x.v, acc) ? x.v : acc), candidates[0].v);
  return new Set(candidates.filter((x) => x.v === top).map((x) => x.i));
}

/** 줄 = 상세 정보 표(infoRows) 순서 그대로 + 나머지 칸. today: 한국 날짜 YYYY-MM-DD (보증 만료 판단) */
export function compareRows(details: ListingDetail[], today: string = todayInSeoul()): CompareRow[] {
  const perItem = details.map((d) => [...infoRows(d), ...extraRows(d)]);
  if (perItem.length === 0) return [];
  return perItem[0].map((first, rowIndex) => {
    const values = perItem.map((rows) => rows[rowIndex].value);
    const differs = new Set(values).size > 1;
    const best = BEST[first.key];
    return {
      key: first.key,
      label: first.label,
      values,
      differs,
      best: best ? bestOf(details, best, differs, today) : new Set<number>(),
      badge: best?.badge,
      mono: MONO.has(first.key),
      long: first.key === "description",
    };
  });
}
