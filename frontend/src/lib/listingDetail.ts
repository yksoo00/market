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

/** 매물 사진이 없으면 상품마스터 대표 사진 */
export function mainPhoto(d: ListingDetail): string | null {
  return d.photos[0] ?? d.productPhoto;
}

/** 매물 데이터시트가 없으면 상품마스터 데이터시트 */
export function dataSheetKey(d: ListingDetail): string | null {
  return d.listingDataSheet ?? d.productDataSheet;
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
