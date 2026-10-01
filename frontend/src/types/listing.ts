export type ListingType = "sell" | "buy";
export type SellerKind = "individual" | "business";

export interface ListingSummary {
  id: string;
  type: ListingType;
  title: string;
  category: string;
  quantity: number;
  /** 원 단위. 가격 미정(제안·견적 요청)은 null */
  price: number | null;
  priceUnit?: string;
  sellerKind: SellerKind;
  createdAt: string;
}

export type TradeStatus = "available" | "completed";

/** 검색 결과 행. 백엔드 검색 API를 만들 때 DTO를 이와 1:1로 맞춘다 */
export interface ListingSearchItem {
  userId: string;
  /** yyyyMMddHHmmss. userId와 함께 매물 식별자 */
  regDate: string;
  /** 상품번호(제조사 번호) */
  prodNo: string | null;
  prodName: string;
  prodBrand: string;
  category: string;
  /** 부품상세내역 */
  description: string | null;
  hasDataSheet: boolean;
  hasPhoto: boolean;
  /** 상품상태 자유 텍스트 (예: 양호, 신품대비 90%) */
  prodState: string;
  stockQuantity: number;
  salesUnitPrice: number;
  /** YYYY-MM-DD */
  deliveryDate: string | null;
  /** 백엔드는 dt_expire가 비면 available, 있으면 completed (decisions.md 2026-10-01) */
  tradeStatus: TradeStatus;
}
