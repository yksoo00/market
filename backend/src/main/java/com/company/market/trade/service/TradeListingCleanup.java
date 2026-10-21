package com.company.market.trade.service;

import com.company.market.listing.service.ListingDeletingEvent;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 매물을 지울 때 그 매물의 견적 행을 같이 지운다 (사용자 결정 2026-10-21). 견적 행은 회신 뒤에도 남아 매물 FK 가
 * 삭제를 막는데, 누구나 보낼 수 있어서다. 구매요청·거래 행은 지우지 않아 기존대로 LISTING_HAS_TRADES 로 막는다.
 */
@Component
@RequiredArgsConstructor
class TradeListingCleanup {

	private final TradeInfoRepository trades;

	@EventListener
	void onListingDeleting(ListingDeletingEvent event) {
		trades.deleteByListingAndType(event.sellerId(), event.regDate(), TradeType.QUOTE);
	}

}
