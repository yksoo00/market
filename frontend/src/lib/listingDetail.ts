// 매물 상세 화면의 표시 규칙. 스펙: docs/superpowers/specs/2026-10-02-listing-detail-design.md
import { formatPrice } from "@/lib/format";
import { listing } from "@/messages/listing";
import type { ListingDetail } from "@/types/listing";

const t = listing.detail;
const num = new Intl.NumberFormat("ko-KR");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REG_DATE_RE = /^\d{14}$/;

/** 형식이 틀린 경로는 API 를 부르지 않고 바로 "찾을 수 없음"으로 */
export function isValidListingPath(userId: string, regDate: string): boolean {
  return UUID_RE.test(userId) && REG_DATE_RE.test(regDate);
}

export function formatRegDate(regDate: string): string {
  const d = regDate;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
}

// 사진·데이터시트는 이 매물에 올린 것만. 상품마스터 파일로 대신하지 않는다 — 처음 등록한 다른 판매자의 실물 사진·파일이라
// 구매자가 다른 물건을 보고 판단하게 된다 (decisions.md 2026-10-02 매물 상세)
export function mainPhoto(d: ListingDetail): string | null {
  return d.photos[0] ?? null;
}

export function dataSheetKey(d: ListingDetail): string | null {
  return d.listingDataSheet;
}

// refresh 까지 실패한 401 만 로그인이 풀린 것. 네트워크·5xx·429 는 로그인 여부를 모르는 것
const AUTH_LOST = new Set(["UNAUTHENTICATED", "SESSION_EXPIRED", "UNAUTHORIZED"]);

export function isAuthLost(code: string): boolean {
  return AUTH_LOST.has(code);
}

/** 버튼 표시용. 실제 권한은 서버가 403 으로 막는다 */
export function isOwner(meId: string | null, userId: string): boolean {
  return meId !== null && meId.toLowerCase() === userId.toLowerCase();
}

export function buyerActionsDisabled(d: ListingDetail): boolean {
  return d.tradeStatus === "completed";
}

export interface InfoRow {
  label: string;
  value: string;
  mono?: boolean;
}

const orEmpty = (v: string | null) => v ?? t.empty;
const count = (n: number | null) => (n === null ? t.empty : num.format(n));

/** 사용자가 준 화면에 있던 행을 먼저, 그 외 테이블 컬럼을 뒤에 (스펙 "이미지 항목 ↔ 컬럼") */
export function infoRows(d: ListingDetail): InfoRow[] {
  const r = t.rows;
  return [
    { label: r.brand, value: d.prodBrand },
    { label: r.prodId, value: d.prodId, mono: true },
    { label: r.leadTime, value: orEmpty(d.deliveryDate) },
    { label: r.state, value: d.prodState },
    { label: r.unitPrice, value: t.won(formatPrice(d.salesUnitPrice)) },
    { label: r.stock, value: count(d.stockQuantity) },
    { label: r.category, value: d.category },
    { label: r.tradeType, value: d.tradeType },
    { label: r.mufcDate, value: orEmpty(d.mufcDate) },
    { label: r.minOrder, value: count(d.minOrderQuantity) },
    { label: r.orderUnit, value: count(d.orderUnit) },
    { label: r.salesQuantity, value: count(d.salesQuantity) },
    { label: r.warranty, value: orEmpty(d.warrantyUntil) },
    { label: r.coverage, value: orEmpty(d.warrantyCoverage) },
    { label: r.regDate, value: formatRegDate(d.regDate) },
  ];
}
