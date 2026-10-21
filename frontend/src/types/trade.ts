// 거래 API 타입. 백엔드 trade/dto 와 1:1

/** 거래상태 = 지금 어디까지 왔나 (백엔드 TradeStats.code). cart·compare 는 아직 안 씀 */
export type TradeStats = "cart" | "compare" | "quoteRequested" | "quoteAccepted" | "quoteRejected" | "requested" | "confirmed";

/** 거래종류 = 무슨 기록인가 (백엔드 TradeType.code). quote = 견적, purchase = 구매 */
export type TradeType = "review" | "quote" | "purchase";

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

/** POST /api/v1/trades/quotes 한 줄. 납품희망일은 받지 않는다 */
export interface QuoteItem {
  sellerId: string;
  regDate: string;
  orderUnitPrice: number;
  orderQuantity: number;
  remarks?: string;
}

/** 백엔드 TradeResponse. counterpartNickname = 보는 사람의 상대방(구매자에겐 판매자) */
export interface Trade {
  tradeId: string;
  tradeType: TradeType;
  tradeStats: TradeStats;
  sellerId: string;
  regDate: string;
  prodName: string;
  orderQuantity: number;
  /** 요청 때 등록단가 */
  salesUnitPrice: number | null;
  /** 거래 단가 — 견적이면 희망단가 */
  orderUnitPrice: number;
  amount: number;
  /** 견적은 null */
  reqDeliDate: string | null;
  remarks: string | null;
  counterpartNickname: string | null;
  /** 대표 사진 공개 키 */
  photo: string | null;
}

export interface TradePage {
  items: Trade[];
  nextCursor: string | null;
}

/** GET /api/v1/trades/pending-counts — { 매물 regDate: 판매자가 처리할 견적요청 + 구매요청 건수 } */
export type PendingCounts = Record<string, number>;
