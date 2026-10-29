import type { ListingSearchItem } from "@/types/listing";

/**
 * 장바구니·비교 한 줄 (백엔드 CartItemResponse). 담을 때 입력(수량·납품희망일·요청사항 — 구매·견적 모달의 기본값)과
 * listing = 검색 결과와 같은 칸 = 지금 매물 값
 */
export interface CartItem {
  tradeId: string;
  orderQuantity: number;
  reqDeliDate: string;
  remarks: string | null;
  listing: ListingSearchItem;
}

export interface CartCount {
  count: number;
}

/** 담기 결과 (백엔드 CartAddResponse): 지금 합계, 새로 담은 수, 이미 담겨 있어 건너뛴 수 */
export interface CartAddResult {
  count: number;
  added: number;
  skipped: number;
}

/** 담을 매물 한 건 + 그 입력 */
export interface CartAddItem {
  sellerId: string;
  regDate: string;
  orderQuantity: number;
  reqDeliDate: string;
  remarks?: string;
}
