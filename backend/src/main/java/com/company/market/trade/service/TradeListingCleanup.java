package com.company.market.trade.service;

import java.util.List;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.service.ListingDeletingEvent;
import com.company.market.listing.service.ListingProductChangedEvent;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * 매물 쪽 변경에 거래 행을 맞춘다. 같은 트랜잭션에서 동기로 들린다.
 * - 매물 삭제: 그 매물의 견적(요청·거절)·장바구니 행을 같이 지운다 (사용자 결정 2026-10-21 — 누구나 보낼 수 있는 행이라 판매자 삭제를
 *   막으면 안 된다). 수락된 견적·구매요청·거래 행이 남아 있으면 LISTING_HAS_TRADES 로 삭제를 막는다 — FK 가 없어(2026-10-27) DB 대신 여기서.
 * - 매물 상품 변경: 거래 행의 prod_id 를 새 값으로 (거래는 매물 PK 세 값으로 매물을 찾는다).
 */
@Component
@RequiredArgsConstructor
class TradeListingCleanup {

	private final TradeInfoRepository trades;

	private final CartInfoRepository cartInfos;

	@EventListener
	void onListingDeleting(ListingDeletingEvent event) {
		// 수락된 견적은 구매자 몫으로 수량이 묶여 있다 — 조용히 지우지 않고 남겨 아래 검사가 삭제를 막는다 (2026-11-02)
		trades.deleteByListingAndTypeAndStats(event.sellerId(), event.regDate(), event.prodId(), TradeType.QUOTE,
				List.of(TradeStats.QUOTE_REQUESTED, TradeStats.QUOTE_REJECTED));
		trades.deleteByListingAndTypeAndStats(event.sellerId(), event.regDate(), event.prodId(), TradeType.REVIEW,
				List.of(TradeStats.CART, TradeStats.COMPARE));
		cartInfos.deleteByListing(event.sellerId(), event.regDate(), event.prodId());
		if (trades.existsBySellerIdAndProdRegDateAndProdId(event.sellerId(), event.regDate(), event.prodId())) {
			throw new ApiException(ErrorCode.LISTING_HAS_TRADES);
		}
	}

	@EventListener
	void onListingProductChanged(ListingProductChangedEvent event) {
		trades.changeListingProdId(event.sellerId(), event.regDate(), event.oldProdId(), event.newProdId());
		cartInfos.changeProdNo(event.sellerId(), event.regDate(), event.oldProdId(), event.newProdId());
	}

}
