import type { ListingSearchItem } from "@/types/listing";

/** 장바구니 한 줄 (백엔드 CartItemResponse). listing 은 검색 결과와 같은 칸 = 지금 매물 값 */
export interface CartItem {
  tradeId: string;
  listing: ListingSearchItem;
}

export interface CartCount {
  count: number;
}
