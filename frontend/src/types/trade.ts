// 거래 API 타입. 백엔드 trade/dto 와 1:1

export type TradeStats = "requested" | "confirmed" | "canceled";

/** 거래 목록에서 내가 어느 쪽인지 — buyer: 내 구매목록, seller: 받은 구매요청 */
export type TradeRole = "buyer" | "seller";

/** POST /api/v1/trades 요청. 단가는 보내지 않는다 (등록단가 고정). reqDeliDate 를 빼면 매물 납기일 */
export interface TradeCreateRequest {
  sellerId: string;
  regDate: string;
  orderQuantity: number;
  /** YYYY-MM-DD */
  reqDeliDate?: string;
  remarks?: string;
}

/** 백엔드 TradeResponse. counterpartNickname = 보는 사람의 상대방(구매자에겐 판매자) */
export interface Trade {
  tradeId: string;
  tradeStats: TradeStats;
  sellerId: string;
  regDate: string;
  prodName: string;
  orderQuantity: number;
  orderUnitPrice: number;
  amount: number;
  reqDeliDate: string;
  remarks: string | null;
  counterpartNickname: string | null;
  /** 대표 사진 공개 키 */
  photo: string | null;
}

export interface TradePage {
  items: Trade[];
  nextCursor: string | null;
}

/** GET /api/v1/trades/pending-counts — { 매물 regDate: 구매요청 건수 } */
export type PendingCounts = Record<string, number>;
