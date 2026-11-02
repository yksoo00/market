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
  /** 담은 시각 yyyyMMddHHmmss (UTC). 장바구니는 담은 지 1시간 뒤 자동으로 빠진다 */
  addedAt: string;
  listing: ListingSearchItem;
}

export interface CartCount {
  count: number;
}

/** 담기 결과 (백엔드 CartAddResponse): 지금 합계, 이번에 담은 줄 수 (같은 매물도 담을 때마다 새 줄이라 건너뛰지 않는다) */
export interface CartAddResult {
  count: number;
  added: number;
}

/** 담을 매물 한 건 + 그 입력 */
export interface CartAddItem {
  sellerId: string;
  regDate: string;
  orderQuantity: number;
  reqDeliDate: string;
  remarks?: string;
}
