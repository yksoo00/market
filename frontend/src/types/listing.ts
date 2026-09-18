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
