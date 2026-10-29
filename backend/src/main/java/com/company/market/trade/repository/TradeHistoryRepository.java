package com.company.market.trade.repository;

import java.util.List;
import java.util.UUID;

import com.company.market.trade.domain.TradeHistory;
import com.company.market.trade.domain.TradeHistoryId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, TradeHistoryId> {

	/** 내가 구매자인 이력이 하나라도 있나 (검색 "내 구매" 탭 판정) */
	boolean existsByUserId(UUID userId);

	/**
	 * 내 거래이력, 확정일시·거래ID 내림차순. buy 면 내가 구매자인 줄, sell 이면 내가 판매자인 줄 (둘 다 true 면 전체).
	 * 커서는 마지막 줄의 (확정일시, 거래ID) — 둘 다 고정 길이 숫자 문자열이라 문자열 순서가 시간 순서
	 */
	@Query("""
			select h from TradeHistory h
			 where ((:buy = true and h.userId = :me) or (:sell = true and h.sellerId = :me))
			   and (:cursorDate is null or h.tradeDate < :cursorDate or (h.tradeDate = :cursorDate and h.tradeId < :cursorId))
			 order by h.tradeDate desc, h.tradeId desc
			""")
	List<TradeHistory> findPage(@Param("me") UUID me, @Param("buy") boolean buy, @Param("sell") boolean sell,
			@Param("cursorDate") String cursorDate, @Param("cursorId") String cursorId, Pageable page);

	/** findPage 와 같은 조건·순서의 [확정일시, 거래ID] 만 전부 — 페이지 번호의 경계와 전체 건수 (PageKeys) */
	@Query("""
			select h.tradeDate, h.tradeId from TradeHistory h
			 where ((:buy = true and h.userId = :me) or (:sell = true and h.sellerId = :me))
			 order by h.tradeDate desc, h.tradeId desc
			""")
	List<Object[]> findKeys(@Param("me") UUID me, @Param("buy") boolean buy, @Param("sell") boolean sell);

}
