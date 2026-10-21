package com.company.market.trade.service;

import java.util.UUID;

/**
 * 견적·거래 단계 하나 = 메일 이벤트 하나. 커밋 뒤 TradeMailListener 가 받는 사람을 골라 보낸다.
 * actorId 는 그 동작을 한 사람(거래 취소처럼 받는 사람이 누가 했느냐로 갈릴 때).
 */
record TradeMailEvent(Kind kind, String tradeId, UUID buyerId, UUID sellerId, UUID actorId, String prodName,
		Integer salesUnitPrice, int unitPrice, int quantity) {

	enum Kind {
		/** → 판매자 */
		QUOTE_REQUESTED,
		/** → 구매자 */
		QUOTE_ACCEPTED,
		/** → 구매자 */
		QUOTE_REJECTED,
		/** → 판매자 */
		QUOTE_CANCELED,
		/** → 판매자 */
		PURCHASE_REQUESTED,
		/** → 취소하지 않은 쪽 */
		PURCHASE_CANCELED,
		/** → 둘 다 */
		PURCHASE_CONFIRMED
	}

}
