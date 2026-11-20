package com.company.market.trade.repository;

import java.util.Collection;
import java.util.List;

import com.company.market.trade.domain.CartInfo;
import com.company.market.trade.domain.CartInfoId;
import com.company.market.trade.domain.CartType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CartInfoRepository extends JpaRepository<CartInfo, CartInfoId> {

	/** 일렬번호 = 그 구매자 행 중 최대 + 1 (정의서). 동시에 두 요청이 같은 값을 받아도 PK 에 trade_id 가 있어 충돌하지 않는다 */
	@Query("select coalesce(max(c.serNo), 0) + 1 from CartInfo c where c.userId = :userId")
	int nextSerNo(@Param("userId") String userId);

	/** 최근에 담은 것부터 — trade_id 내림차순 (11자 고정 길이라 문자열 순서 = 시간 순서) */
	List<CartInfo> findByUserIdAndCartTypeOrderByTradeIdDesc(String userId, CartType cartType);

	/** 담은 순서 (일렬번호 오름차순) — 비교 화면의 열 순서 */
	List<CartInfo> findByUserIdAndCartTypeOrderBySerNo(String userId, CartType cartType);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from CartInfo c where c.userId = :userId and c.cartType = :type")
	int deleteByUserAndType(@Param("userId") String userId, @Param("type") CartType type);

	long countByUserIdAndCartType(String userId, CartType cartType);

	/** 이 매물이 이미 그 구분(장바구니|비교용)으로 담겨 있나 */
	boolean existsByUserIdAndCartTypeAndSellerIdAndProdDateAndProdNo(String userId, CartType cartType, String sellerId,
			String prodDate, String prodNo);

	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from CartInfo c where c.userId = :userId and c.tradeId in :tradeIds")
	int deleteByUserAndTradeIds(@Param("userId") String userId, @Param("tradeIds") Collection<String> tradeIds);

	/** 그 거래ID 의 행 (한 거래ID 는 한 구매자 것) */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from CartInfo c where c.tradeId = :tradeId")
	int deleteByTradeId(@Param("tradeId") String tradeId);

	/** 담은 수량 바꾸기 — trd_trade_info 의 같은 줄과 함께 바꾼다 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("update CartInfo c set c.orderQuantity = :quantity where c.tradeId = :tradeId")
	int updateQuantity(@Param("tradeId") String tradeId, @Param("quantity") int quantity);

	/** 매물 삭제 때 그 매물의 장바구니·비교 행 전부 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("delete from CartInfo c where c.sellerId = :sellerId and c.prodDate = :prodDate and c.prodNo = :prodNo")
	int deleteByListing(@Param("sellerId") String sellerId, @Param("prodDate") String prodDate, @Param("prodNo") String prodNo);

	/** 매물 상품이 바뀌면 상품번호(= prod_id)도 따라가 매물을 계속 찾게 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query("""
			update CartInfo c set c.prodNo = :newProdNo
			 where c.sellerId = :sellerId and c.prodDate = :prodDate and c.prodNo = :oldProdNo
			""")
	int changeProdNo(@Param("sellerId") String sellerId, @Param("prodDate") String prodDate,
			@Param("oldProdNo") String oldProdNo, @Param("newProdNo") String newProdNo);

}
