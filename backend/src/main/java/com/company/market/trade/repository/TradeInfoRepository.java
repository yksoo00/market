package com.company.market.trade.repository;

import java.util.Optional;

import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeInfoId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TradeInfoRepository extends JpaRepository<TradeInfo, TradeInfoId> {

	/** trade_id 는 unique 라 구매자 없이 하나로 찾는다 */
	Optional<TradeInfo> findByTradeId(String tradeId);

	/** 같은 시간대(yyMMddHH) 거래 수 — 거래ID 순번 */
	long countByTradeIdStartingWith(String prefix);

}
