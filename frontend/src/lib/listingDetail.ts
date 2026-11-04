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

// refresh 까지 실패한 401 만 로그인이 풀린 것. 네트워크·5xx·429 는 로그인 여부를 모르는 것
const AUTH_LOST = new Set(["UNAUTHENTICATED", "SESSION_EXPIRED", "UNAUTHORIZED"]);

export function isAuthLost(code: string): boolean {
  return AUTH_LOST.has(code);
}

/** 버튼 표시용. 실제 권한은 서버가 403 으로 막는다 */
export function isOwner(meId: string | null, userId: string): boolean {
  return meId !== null && meId.toLowerCase() === userId.toLowerCase();
}


/**
 * 내 매물 버튼. 거래완료 = 거래가 있으니 서버가 수정·추가등록(409 LISTING_COMPLETED)·삭제(409 LISTING_HAS_TRADES)를
 * 막는다. 누를 수 없는 버튼은 숨긴다
 */
export function ownerActions(d: Pick<ListingDetail, "tradeStatus">): { edit: boolean; extra: boolean; remove: boolean } {
  const open = d.tradeStatus !== "completed";
  return { edit: open, extra: open, remove: open };
}

/** [구매]를 못 누르는 이유. login 만 버튼을 켜 두고 누르면 로그인으로 보낸다. 표시용 — 서버가 403·409 로 다시 막는다 */
export type PurchaseBlock = "completed" | "own" | "lowStock" | "login";

/** heldQuantity = 장바구니 줄에서 열었다면 그 줄이 이미 묶은 수량 — 쓸 수 있는 재고에 더한다 (서버도 줄 수량을 재고에 더해 본다, 2026-11-02) */
export function purchaseBlockReason(d: ListingDetail, meId: string | null, heldQuantity = 0): PurchaseBlock | null {
  if (d.tradeStatus === "completed") return "completed";
  if (isOwner(meId, d.userId)) return "own";
  // 최소주문량만큼도 남지 않으면 어떤 주문량도 규칙을 못 맞춘다
  if (d.stockQuantity === null || d.stockQuantity + heldQuantity < d.minOrderQuantity) return "lowStock";
  if (meId === null) return "login";
  return null;
}

/** [장바구니]는 거래완료·내 매물을 막는다. 재고가 모자란 건 담기 창이 수량 칸에서 알린다(담으면 그 수량이 묶이므로 재고 안에서만 담긴다) */
export function cartBlocked(d: ListingDetail, meId: string | null): boolean {
  return d.tradeStatus === "completed" || isOwner(meId, d.userId);
}

export interface InfoRow {
  /** 비교 화면(lib/compare)이 줄을 찾는 이름 */
  key: string;
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
    { key: "brand", label: r.brand, value: d.prodBrand },
    { key: "prodId", label: r.prodId, value: d.prodId, mono: true },
    { key: "leadTime", label: r.leadTime, value: orEmpty(d.deliveryDate) },
    { key: "state", label: r.state, value: d.prodState },
    { key: "unitPrice", label: r.unitPrice, value: t.won(formatPrice(d.salesUnitPrice)) },
    { key: "stock", label: r.stock, value: count(d.stockQuantity) },
    { key: "category", label: r.category, value: d.categoryPath ?? d.category },
    { key: "tradeType", label: r.tradeType, value: d.tradeType },
    { key: "classNo", label: r.classNo, value: orEmpty(d.prodClassNo) },
    { key: "usefulLife", label: r.usefulLife, value: d.prodUsefulLife === null ? t.empty : t.months(d.prodUsefulLife) },
    { key: "warrantyMethod", label: r.warrantyMethod, value: orEmpty(d.warrantyMethod) },
    { key: "alterProdName", label: r.alterProdName, value: orEmpty(d.alterProdName) },
    { key: "minOrder", label: r.minOrder, value: count(d.minOrderQuantity) },
    { key: "orderUnit", label: r.orderUnit, value: count(d.orderUnit) },
    { key: "salesQuantity", label: r.salesQuantity, value: count(d.salesQuantity) },
    { key: "warranty", label: r.warranty, value: orEmpty(d.warrantyUntil) },
    { key: "coverage", label: r.coverage, value: orEmpty(d.warrantyCoverage) },
    { key: "regDate", label: r.regDate, value: formatRegDate(d.regDate) },
  ];
}
