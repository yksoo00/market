import type { ListingCreateRequest } from "@/types/listing";
import type { ListingFormOutput } from "@/lib/validation/listing";

// 거래종류는 "등록" 고정 (사용자 결정, decisions.md 2026-10-02 거래종류 "등록" 고정)
const TRADE_TYPE = "등록";

const seoulDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/** 한국 날짜 YYYY-MM-DD. 백엔드도 제조일·납기일 범위를 한국 날짜로 본다 */
export function todayInSeoul(now: Date = new Date()): string {
  return seoulDate.format(now);
}

/** 검증을 통과한 폼 값 → 등록 요청. 비운 선택 칸은 키를 빼서 서버 기본값을 쓰게 한다 */
export function toCreateRequest(v: ListingFormOutput): ListingCreateRequest {
  const req: ListingCreateRequest = {
    categoryCode: v.categoryCode,
    prodName: v.prodName,
    prodBrand: v.prodBrand,
    tradeType: TRADE_TYPE,
    prodState: v.condition === "used" ? `신품대비 ${v.usedPercent}%` : "신품",
    salesUnitPrice: v.salesUnitPrice,
    salesQuantity: v.salesQuantity,
  };
  const optional: Partial<ListingCreateRequest> = {
    prodNo: v.prodNo,
    prodMufcDate: v.prodMufcDate?.replaceAll("-", ""),
    prodSpecInfo: v.prodSpecInfo,
    stockQuantity: v.stockQuantity,
    minOrderQuantity: v.minOrderQuantity,
    orderUnit: v.orderUnit,
    deliveryDate: v.deliveryDate,
    description: v.description,
    photos: v.photos.length > 0 ? v.photos : undefined,
    listingDataSheet: v.listingDataSheet,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(req, { [key]: value });
  }
  return req;
}
