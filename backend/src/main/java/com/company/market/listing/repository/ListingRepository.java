package com.company.market.listing.repository;

import java.util.Optional;
import java.util.UUID;

import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

// 목록·검색 페이지 조회는 ListingSearchRepository (조건이 동적이라)
public interface ListingRepository extends JpaRepository<Listing, ListingId> {

	/** 이 상품마스터를 쓰는 매물 수 (공유 상품 보호) */
	long countByProdId(String prodId);

	/**
	 * 구매요청의 재고 차감. 읽고-빼고-쓰기를 한 문장으로 해서 락 없이도 동시 요청이 재고를 음수로 만들지 못한다.
	 * 0이 되면 거래완료일시를 넣는다. 바뀐 행 수 0 = 재고 부족이거나 이미 거래완료.
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			update trd_prod_reg
			   set stock_quantity = stock_quantity - :quantity,
			       dt_expire = case when stock_quantity - :quantity = 0 then :now else dt_expire end
			 where user_id = :sellerId and reg_date = :regDate
			   and dt_expire is null and stock_quantity >= :quantity
			""", nativeQuery = true)
	int reserveStock(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate,
			@Param("quantity") int quantity, @Param("now") String now);

	/** 거래 취소로 재고를 돌려준다. 재고가 생기니 거래완료일시도 지운다 (다시 판매 중·수정 가능) */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			update trd_prod_reg
			   set stock_quantity = stock_quantity + :quantity, dt_expire = null
			 where user_id = :sellerId and reg_date = :regDate
			""", nativeQuery = true)
	int releaseStock(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate,
			@Param("quantity") int quantity);

	/**
	 * 수정·삭제용 — 행을 잠그고 읽는다. 매물 저장은 전체 컬럼 UPDATE 라, 잠금 없이 읽으면 그 사이 구매요청이 줄인
	 * 재고·거래완료일시를 옛 값으로 덮어쓴다(초과판매). 잠그면 재고 차감(reserveStock)과 차례로 실행된다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select l from Listing l where l.userId = :userId and l.regDate = :regDate")
	Optional<Listing> findForUpdate(@Param("userId") UUID userId, @Param("regDate") String regDate);
}
