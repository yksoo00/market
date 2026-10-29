package com.company.market.trade.repository;

import java.util.Collection;
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

	/** 거래ID 는 생성기(시간대 + 순번, 잠금)가 겹치지 않게 만들어 구매자 없이 하나로 찾는다 (DB unique 는 2026-10-27 에 뺐다) */
	Optional<TradeInfo> findByTradeId(String tradeId);

	/** 구매자·매물당 견적 단계 행은 하나(ux_trd_trade_info_one_quote) — 재요청이 덮어쓸 행. 구매 단계로 넘어간 행은 찾지 않는다 */
	Optional<TradeInfo> findByUserIdAndSellerIdAndProdRegDateAndProdIdAndTradeTypeAndTradeStatsIn(UUID userId,
			UUID sellerId, String prodRegDate, String prodId, TradeType tradeType, Collection<TradeStats> stats);

	/** 이 매물에 거래 행이 남아 있는지 — 매물 삭제를 막을 때 (FK 가 없어 DB 가 막지 않는다) */
	boolean existsBySellerIdAndProdRegDateAndProdId(UUID sellerId, String prodRegDate, String prodId);

	/**
	 * 구매검토 1행 — 장바구니(거래상태 '장바구니')나 비교용('비교용'). 이미 있으면(동시에 담은 다른 요청 포함) 아무것도 안 한다 → 0.
	 * 예외를 잡아 넘기지 않는 이유: Postgres 는 실패한 문장 뒤로 그 트랜잭션을 못 쓴다.
	 * on conflict 절은 ux_trd_trade_info_one_cart(V202610291000)와 같아야 한다
	 */
	@Modifying
	@Query(nativeQuery = true, value = """
			insert into trd_trade_info (user_id, trade_id, trade_type, seller_id, prod_reg_date, reg_date, prod_id,
				prod_state, sales_unit_price, stock_quantity, min_order_quantity, order_unit, prov_date, order_unit_price,
				order_quantity, req_deli_date, remarks, trade_stats)
			values (:userId, :tradeId, '구매검토', :sellerId, :prodRegDate, :regDate, :prodId, :prodState, :salesUnitPrice,
				:stockQuantity, :minOrderQuantity, :orderUnit, :provDate, :orderUnitPrice, :orderQuantity, :reqDeliDate, cast(:remarks as varchar),
				:tradeStats)
			on conflict (user_id, seller_id, prod_reg_date, prod_id, trade_stats) where trade_type = '구매검토' do nothing
			""")
	int insertReviewIfAbsent(@Param("userId") UUID userId, @Param("tradeId") String tradeId, @Param("sellerId") UUID sellerId,
			@Param("prodRegDate") String prodRegDate, @Param("regDate") String regDate, @Param("prodId") String prodId,
			@Param("prodState") String prodState,
			@Param("salesUnitPrice") Integer salesUnitPrice, @Param("stockQuantity") Integer stockQuantity,
			@Param("minOrderQuantity") Integer minOrderQuantity, @Param("orderUnit") Integer orderUnit,
			@Param("provDate") String provDate, @Param("orderUnitPrice") int orderUnitPrice,
			@Param("orderQuantity") int orderQuantity, @Param("reqDeliDate") String reqDeliDate,
			@Param("remarks") String remarks, @Param("tradeStats") String tradeStats);

	/** 장바구니 빼기 — 내 행만 지운다. 지운 수가 요청 수보다 적으면 호출자가 404 로 되돌린다 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from TradeInfo t where t.userId = :buyerId and t.tradeId in :tradeIds and t.tradeStats = :stats")
	int deleteCartRows(@Param("buyerId") UUID buyerId, @Param("tradeIds") Collection<String> tradeIds,
			@Param("stats") TradeStats stats);

	/** 이 매물의 내 장바구니 거래 행 (구매·견적이 이 행을 바꿔 쓴다). 구매자·매물당 장바구니 행은 하나 */
	@Query("""
			select t from TradeInfo t
			 where t.userId = :buyerId and t.sellerId = :sellerId and t.prodRegDate = :prodRegDate and t.prodId = :prodId
			   and t.tradeType = :type and t.tradeStats = :stats
			""")
	Optional<TradeInfo> findReviewRow(@Param("buyerId") UUID buyerId, @Param("sellerId") UUID sellerId,
			@Param("prodRegDate") String prodRegDate, @Param("prodId") String prodId, @Param("type") TradeType type,
			@Param("stats") TradeStats stats);

	/** 내 구매검토 행 중 그 거래상태(비교용) 전부 삭제 — 비교는 누를 때마다 목록을 바꾼다 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from TradeInfo t where t.userId = :buyerId and t.tradeType = :type and t.tradeStats = :stats")
	int deleteByUserAndTypeAndStats(@Param("buyerId") UUID buyerId, @Param("type") TradeType type, @Param("stats") TradeStats stats);

	/** 구매자별 비교 목록 교체를 줄 세운다 (트랜잭션 끝까지) — 지우고 담는 사이에 같은 구매자의 다른 요청이 끼지 않게 */
	@Query(value = "select 1 from (select pg_advisory_xact_lock(hashtext('compare:' || cast(:userId as text)))) l", nativeQuery = true)
	Integer lockCompare(@Param("userId") UUID userId);

	/** 매물 삭제 때 그 매물의 견적 단계 행을 모두 지운다 (구매요청·구매확정 행은 그대로 — 남아 있으면 TradeListingCleanup 이 삭제를 막는다) */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			delete from TradeInfo t
			 where t.sellerId = :sellerId and t.prodRegDate = :prodRegDate and t.prodId = :prodId and t.tradeType = :type
			   and t.tradeStats in :stats
			""")
	int deleteByListingAndTypeAndStats(@Param("sellerId") UUID sellerId, @Param("prodRegDate") String prodRegDate,
			@Param("prodId") String prodId,
			@Param("type") TradeType type, @Param("stats") Collection<TradeStats> stats);

	/**
	 * 같은 시간대의 가장 큰 거래ID — 거래ID 순번. LIKE 'prefix%' 는 기본 collation 의 trade_id 인덱스(ix_trd_trade_info_trade_id)를 못 타지만
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

	/**
	 * 내가 구매자인 거래, trade_id 내림차순(= 최신순, 11자 고정 길이라 문자열 순서가 시간 순서). cursor 보다 앞만.
	 * hidden 종류(구매검토 = 장바구니)는 뺀다 — 장바구니는 따로 된 화면에서만 본다
	 */
	@Query("""
			select t from TradeInfo t
			 where t.userId = :buyerId and t.tradeType <> :hidden and (:cursor is null or t.tradeId < :cursor)
			 order by t.tradeId desc
			""")
	List<TradeInfo> findBuyerPage(@Param("buyerId") UUID buyerId, @Param("hidden") TradeType hidden,
			@Param("cursor") String cursor, Pageable page);

	/** 내가 판매자인 거래. regDate 가 있으면 그 매물만. hidden 종류(구매검토 = 구매자의 장바구니)는 판매자에게 안 보인다 */
	@Query("""
			select t from TradeInfo t
			 where t.sellerId = :sellerId and t.tradeType <> :hidden and (:regDate is null or t.prodRegDate = :regDate)
			   and (:cursor is null or t.tradeId < :cursor)
			 order by t.tradeId desc
			""")
	List<TradeInfo> findSellerPage(@Param("sellerId") UUID sellerId, @Param("hidden") TradeType hidden,
			@Param("regDate") String regDate, @Param("cursor") String cursor, Pageable page);

	/** 판매자 매물별 그 상태들 건수 → [매물 등록일시, count]. 한 판매자 안에서 등록일시는 매물 하나 (같은 초 등록 409) */
	@Query("""
			select t.prodRegDate, count(t) from TradeInfo t
			 where t.sellerId = :sellerId and t.tradeStats in :stats
			 group by t.prodRegDate
			""")
	List<Object[]> countBySellerGroupByListing(@Param("sellerId") UUID sellerId, @Param("stats") Collection<TradeStats> stats);

	/** 내가 구매자인 거래 중 hidden 종류(구매검토)가 아닌 행이 있나 (검색 "내 구매" 탭 판정) */
	boolean existsByUserIdAndTradeTypeNot(UUID userId, TradeType hidden);

	/** 내가 구매자인 거래(hidden 종류 제외)의 매물 → [판매자 id, 매물 등록일시], 최신 거래부터. 같은 매물은 한 번 (내 구매 범위) */
	@Query("""
			select t.sellerId, t.prodRegDate, max(t.tradeId) from TradeInfo t
			 where t.userId = :buyerId and t.tradeType <> :hidden
			 group by t.sellerId, t.prodRegDate
			 order by max(t.tradeId) desc
			""")
	List<Object[]> findPurchasedListings(@Param("buyerId") UUID buyerId, @Param("hidden") TradeType hidden, Pageable page);


	/** 매물 수정으로 상품이 바뀌면 그 매물을 가리키는 거래 행도 새 prod_id 로 — 세 값으로 계속 찾게 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update TradeInfo t set t.prodId = :newProdId
			 where t.sellerId = :sellerId and t.prodRegDate = :prodRegDate and t.prodId = :oldProdId
			""")
	int changeListingProdId(@Param("sellerId") UUID sellerId, @Param("prodRegDate") String prodRegDate,
			@Param("oldProdId") String oldProdId, @Param("newProdId") String newProdId);

}
