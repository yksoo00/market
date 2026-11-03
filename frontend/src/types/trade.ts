// 거래 API 타입. 백엔드 trade/dto 와 1:1

/** 거래상태 = 지금 어디까지 왔나 (백엔드 TradeStats.code). cart·compare 는 아직 안 씀 */
export type TradeStats = "cart" | "compare" | "quoteRequested" | "quoteAccepted" | "quoteRejected" | "requested" | "confirmed";

/** 거래종류 = 무슨 기록인가 (백엔드 TradeType.code). quote = 견적, purchase = 구매 */
export type TradeType = "review" | "quote" | "purchase";

/** 거래 목록에서 내가 어느 쪽인지 — buyer: 내 구매목록, seller: 받은 구매요청 */
export type TradeRole = "buyer" | "seller";

/** POST /api/v1/trades 요청. 단가는 보내지 않는다 (등록단가 고정). 납품희망일 필수 (2026-10-27) */
export interface TradeCreateRequest {
  sellerId: string;
  regDate: string;
  orderQuantity: number;
  /** YYYY-MM-DD */
  reqDeliDate: string;
  remarks?: string;
  /** 장바구니에서 누른 구매면 그 줄의 거래ID — 있으면 그 줄이 구매요청이 된다 */
  cartTradeId?: string;
}

/** POST /api/v1/trades/quotes 한 줄. 납품희망일 필수 (2026-10-27) */
export interface QuoteItem {
  sellerId: string;
  regDate: string;
  orderUnitPrice: number;
  orderQuantity: number;
  /** YYYY-MM-DD */
  reqDeliDate: string;
  remarks?: string;
  /** 장바구니에서 누른 견적이면 그 줄의 거래ID — 있으면 그 줄이 견적요청이 된다 */
  cartTradeId?: string;
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

/** 받은 견적요청 한 줄 (백엔드 QuoteRequestListResponse.Item) — 한꺼번에 처리 모달용. stockQuantity = 그 매물의 지금 재고 */
export interface QuoteRequestItem {
  tradeId: string;
  regDate: string;
  prodName: string;
  buyerNickname: string | null;
  orderQuantity: number;
  salesUnitPrice: number | null;
  orderUnitPrice: number;
  amount: number;
  reqDeliDate: string | null;
  remarks: string | null;
  stockQuantity: number | null;
}

/** GET /api/v1/trades/quote-requests — 오래된 순 최대 30건, total = 전체 건수 */
export interface QuoteRequestList {
  items: QuoteRequestItem[];
  total: number;
}

/** 건별 결과 (백엔드 QuoteReplyResponse.Result). 성공이면 tradeStats, 실패면 code·message */
export interface QuoteReplyResult {
  tradeId: string;
  ok: boolean;
  tradeStats: "quoteAccepted" | "quoteRejected" | null;
  code: string | null;
  message: string | null;
}

export interface TradePage {
  items: Trade[];
  page: number;
  totalPages: number;
  total: number;
}

/** GET /api/v1/trades/pending-counts — { 매물 regDate: 판매자가 처리할 견적요청 + 구매요청 건수 } */
export type PendingCounts = Record<string, number>;

/** 백엔드 TradeHistoryItemResponse — 내 거래이력 한 줄. side = 내가 구매자(buy)냐 판매자(sell)냐, 확정일시 tradeDate 는 yyyyMMddHHmmss */
export interface TradeHistoryItem {
  tradeId: string;
  tradeDate: string;
  side: "buy" | "sell";
  prodName: string | null;
  counterpartNickname: string | null;
  unitPrice: number | null;
  quantity: number | null;
  amount: number | null;
}

export interface TradeHistoryPage {
  items: TradeHistoryItem[];
  page: number;
  totalPages: number;
  total: number;
}

export type HistorySide = "all" | "buy" | "sell";

/** GET /api/v1/trades/scopes — 검색 화면에 [내 판매]·[내 구매] 탭을 보일지 */
export interface TradeScopes {
  sales: boolean;
  purchases: boolean;
}
