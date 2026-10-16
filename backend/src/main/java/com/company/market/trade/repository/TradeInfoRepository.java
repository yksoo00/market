package com.company.market.trade.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeInfoId;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeInfoRepository extends JpaRepository<TradeInfo, TradeInfoId> {

	/** trade_id 는 unique 라 구매자 없이 하나로 찾는다 */
	Optional<TradeInfo> findByTradeId(String tradeId);

	/** 같은 시간대(yyMMddHH) 거래 수 — 거래ID 순번 */
	long countByTradeIdStartingWith(String prefix);

	/**
	 * from 상태일 때만 바꾼다. 확정·취소가 동시에 와도 행 잠금 뒤 조건을 다시 보므로 한쪽만 1행, 다른 쪽은 0행.
	 * 0 이면 이미 다른 상태 (호출자가 409).
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update TradeInfo t set t.tradeStats = :to, t.tradeType = :type
			 where t.tradeId = :tradeId and t.tradeStats = :from
			""")
	int updateStatus(@Param("tradeId") String tradeId, @Param("from") TradeStats from, @Param("to") TradeStats to,
			@Param("type") TradeType type);

	/** 내가 구매자인 거래, trade_id 내림차순(= 최신순, 11자 고정 길이라 문자열 순서가 시간 순서). cursor 보다 앞만 */
	@Query("""
			select t from TradeInfo t
			 where t.userId = :buyerId and (:cursor is null or t.tradeId < :cursor)
			 order by t.tradeId desc
			""")
	List<TradeInfo> findBuyerPage(@Param("buyerId") UUID buyerId, @Param("cursor") String cursor, Pageable page);

	/** 내가 판매자인 거래. regDate 가 있으면 그 매물만 */
	@Query("""
			select t from TradeInfo t
			 where t.sellerId = :sellerId and (:regDate is null or t.regDate = :regDate)
			   and (:cursor is null or t.tradeId < :cursor)
			 order by t.tradeId desc
			""")
	List<TradeInfo> findSellerPage(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate,
			@Param("cursor") String cursor, Pageable page);

	/** 판매자 매물별 그 상태 건수 → [regDate, count] */
	@Query("""
			select t.regDate, count(t) from TradeInfo t
			 where t.sellerId = :sellerId and t.tradeStats = :stats
			 group by t.regDate
			""")
	List<Object[]> countBySellerGroupByListing(@Param("sellerId") UUID sellerId, @Param("stats") TradeStats stats);

}
