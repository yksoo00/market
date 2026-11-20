package com.company.market.trade.repository;

import java.util.Collection;
import java.util.List;

import com.company.market.trade.domain.TradeHistory;
import com.company.market.trade.domain.TradeHistoryId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TradeHistoryRepository extends JpaRepository<TradeHistory, TradeHistoryId> {

	/** 내가 구매자인 이력이 하나라도 있나 (검색 "내 구매" 탭 판정) */
	boolean existsByUserId(String userId);

	/**
	 * 내 거래이력, 확정일시·거래ID 내림차순. buy 면 내가 구매자인 줄, sell 이면 내가 판매자인 줄 (둘 다 true 면 전체).
	 * 커서는 마지막 줄의 (확정일시, 거래ID) — 둘 다 고정 길이 숫자 문자열이라 문자열 순서가 시간 순서.
	 * 필터 값은 null 대신 "걸지 않는 값"(기간 00000000000000~99999999999999, 금액 0~int 최대, useProds=false)으로 받는다 —
	 * null 파라미터는 Postgres 가 타입을 못 정해 실패할 수 있다. 금액이 없는 줄은 0 으로 본다
	 */
	@Query("""
			select h from TradeHistory h
			 where ((:buy = true and h.userId = :me) or (:sell = true and h.sellerId = :me))
			   and h.tradeDate >= :fromDate and h.tradeDate <= :toDate
			   and coalesce(h.tradeAmount, 0) >= :minAmount and coalesce(h.tradeAmount, 0) <= :maxAmount
			   and (:useProds = false or h.prodId in :prodIds)
			   and (:cursorDate is null or h.tradeDate < :cursorDate or (h.tradeDate = :cursorDate and h.tradeId < :cursorId))
			 order by h.tradeDate desc, h.tradeId desc
			""")
	List<TradeHistory> findPage(@Param("me") String me, @Param("buy") boolean buy, @Param("sell") boolean sell,
			@Param("fromDate") String fromDate, @Param("toDate") String toDate, @Param("minAmount") int minAmount,
			@Param("maxAmount") int maxAmount, @Param("useProds") boolean useProds, @Param("prodIds") Collection<String> prodIds,
			@Param("cursorDate") String cursorDate, @Param("cursorId") String cursorId, Pageable page);

	/**
	 * findPage 와 같은 조건의 정렬 키만 전부 — 페이지 번호의 경계와 전체 건수 (PageKeys). 순서는 호출자(서비스)가 자바에서 정한다
	 * (열 머리 정렬 2026-11-03: 상품명·상대 이름은 이력 테이블 밖 값이라 DB 정렬 키로 못 쓴다).
	 * 행 = [확정일시, 거래ID, 구매자ID, 판매자ID, 상품ID, 수량, 단가, 금액] — 앞 셋이 PK, 나머지는 정렬용
	 */
	@Query("""
			select h.tradeDate, h.tradeId, h.userId, h.sellerId, h.prodId, h.tradeQuantity, h.tradeUnitPrice, h.tradeAmount from TradeHistory h
			 where ((:buy = true and h.userId = :me) or (:sell = true and h.sellerId = :me))
			   and h.tradeDate >= :fromDate and h.tradeDate <= :toDate
			   and coalesce(h.tradeAmount, 0) >= :minAmount and coalesce(h.tradeAmount, 0) <= :maxAmount
			   and (:useProds = false or h.prodId in :prodIds)
			""")
	List<Object[]> findKeys(@Param("me") String me, @Param("buy") boolean buy, @Param("sell") boolean sell,
			@Param("fromDate") String fromDate, @Param("toDate") String toDate, @Param("minAmount") int minAmount,
			@Param("maxAmount") int maxAmount, @Param("useProds") boolean useProds, @Param("prodIds") Collection<String> prodIds);

	/**
	 * 내 이력에 나온 상품ID (겹침 없이). 검색어는 이 상품들 안에서만 상품마스터에 맞춰 본다 — 전체 상품에서 찾으면
	 * 상한을 둬야 해 결과가 빠졌다 (decisions.md 2026-11-02)
	 */
	@Query("""
			select distinct h.prodId from TradeHistory h
			 where ((:buy = true and h.userId = :me) or (:sell = true and h.sellerId = :me)) and h.prodId is not null
			""")
	List<String> findProdIds(@Param("me") String me, @Param("buy") boolean buy, @Param("sell") boolean sell);

}
