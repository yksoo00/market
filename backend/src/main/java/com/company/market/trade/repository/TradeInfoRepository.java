package com.company.market.trade.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeInfoId;
import com.company.market.trade.domain.TradeStats;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeInfoRepository extends JpaRepository<TradeInfo, TradeInfoId> {

	/** trade_id 는 unique 라 구매자 없이 하나로 찾는다 */
	Optional<TradeInfo> findByTradeId(String tradeId);

	/** 같은 구매자가 같은 매물에 그 상태의 거래가 있는지 — 판매자 답을 기다리는 견적은 매물당 하나 */
	boolean existsByUserIdAndSellerIdAndRegDateAndTradeStats(UUID userId, UUID sellerId, String regDate, TradeStats stats);

	/**
	 * 같은 시간대의 가장 큰 거래ID — 거래ID 순번. LIKE 'prefix%' 는 기본 collation 의 unique 인덱스를 못 타지만
	 * 범위(between)는 탄다 (11자 고정 길이 숫자라 문자열 순서 = 숫자 순서)
	 */
	@Query("select max(t.tradeId) from TradeInfo t where t.tradeId between :from and :to")
	Optional<String> findMaxTradeIdBetween(@Param("from") String from, @Param("to") String to);

	/**
	 * from 상태일 때만 바꾼다. 확정·취소가 동시에 와도 행 잠금 뒤 조건을 다시 보므로 한쪽만 1행, 다른 쪽은 0행.
	 * 0 이면 이미 다른 상태 (호출자가 409).
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update TradeInfo t set t.tradeStats = :to
			 where t.tradeId = :tradeId and t.tradeStats = :from
			""")
	int updateStatus(@Param("tradeId") String tradeId, @Param("from") TradeStats from, @Param("to") TradeStats to);

	/** 취소 = 행 삭제. updateStatus 와 같은 이유로 그 상태일 때만 지운다 — 0 이면 이미 다른 상태 (호출자가 409) */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from TradeInfo t where t.tradeId = :tradeId and t.tradeStats = :stats")
	int deleteIfStatus(@Param("tradeId") String tradeId, @Param("stats") TradeStats stats);

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

	/** 판매자 매물별 그 상태들 건수 → [regDate, count] */
	@Query("""
			select t.regDate, count(t) from TradeInfo t
			 where t.sellerId = :sellerId and t.tradeStats in :stats
			 group by t.regDate
			""")
	List<Object[]> countBySellerGroupByListing(@Param("sellerId") UUID sellerId, @Param("stats") Collection<TradeStats> stats);

}
