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

	/** 매물 주소(/listings/{userId}/{regDate})로 찾는다. 같은 사용자 같은 초 등록을 막아 두 값으로도 하나 */
	Optional<Listing> findByUserIdAndRegDate(UUID userId, String regDate);

	boolean existsByUserIdAndRegDate(UUID userId, String regDate);

	/** 내 매물이 하나라도 있나 (검색 "내 판매" 탭 판정) */
	boolean existsByUserId(UUID userId);

	/**
	 * 사용자별 매물 등록 잠금 (트랜잭션 끝까지). 정의서 PK 가 (user_id, reg_date, prod_id) 라 같은 초 다른 상품은 DB 가 막지 않아,
	 * 같은 사용자의 등록을 줄 세운 뒤 같은 초 행이 있는지 본다 (탭 두 개 동시 등록)
	 */
	@Query(value = "select 1 from (select pg_advisory_xact_lock(hashtext('listing-reg:' || cast(:userId as text)))) l",
			nativeQuery = true)
	Integer lockRegistration(@Param("userId") UUID userId);

	/** 이 상품마스터를 쓰는 매물 수 (공유 상품 보호) */
	long countByProdId(String prodId);

	/**
	 * 재고 묶기(구매요청·견적 수락). 읽고-빼고-쓰기를 한 문장으로 해서 락 없이도 동시 요청이 재고를 음수로 만들지 못한다.
	 * 재고가 0이 돼도 거래완료일시는 넣지 않는다 — 판매완료는 구매 확정 때 markSoldOut 이 정한다 (2026-11-02).
	 * 바뀐 행 수 0 = 재고 부족이거나 이미 거래완료.
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			update trd_prod_reg
			   set stock_quantity = stock_quantity - :quantity
			 where user_id = :sellerId and reg_date = :regDate and prod_id = :prodId
			   and dt_expire is null and stock_quantity >= :quantity
			""", nativeQuery = true)
	int reserveStock(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate, @Param("prodId") String prodId,
			@Param("quantity") int quantity);

	/** 판매완료 표시 — 재고가 0 이고 아직 거래 중일 때만. 바뀐 행 수 0 = 재고가 남았거나 이미 거래완료 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			update trd_prod_reg
			   set dt_expire = :now
			 where user_id = :sellerId and reg_date = :regDate and prod_id = :prodId
			   and dt_expire is null and stock_quantity = 0
			""", nativeQuery = true)
	int markSoldOut(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate, @Param("prodId") String prodId,
			@Param("now") String now);

	/** 거래 취소로 재고를 돌려준다. 재고가 생기니 거래완료일시도 지운다 (다시 판매 중·수정 가능) */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = """
			update trd_prod_reg
			   set stock_quantity = stock_quantity + :quantity, dt_expire = null
			 where user_id = :sellerId and reg_date = :regDate and prod_id = :prodId
			""", nativeQuery = true)
	int releaseStock(@Param("sellerId") UUID sellerId, @Param("regDate") String regDate, @Param("prodId") String prodId,
			@Param("quantity") int quantity);

	/**
	 * 매물 수정에서 상품을 바꿀 때. prod_id 는 PK 라 엔티티로는 못 바꾼다 — 다른 칸을 flush 한 뒤 호출하고,
	 * 영속성 컨텍스트를 비워 옛 PK 의 엔티티가 다시 쓰이지 않게 한다
	 */
	@Modifying(flushAutomatically = true, clearAutomatically = true)
	@Query(value = "update trd_prod_reg set prod_id = :newProdId where user_id = :userId and reg_date = :regDate",
			nativeQuery = true)
	int changeProdId(@Param("userId") UUID userId, @Param("regDate") String regDate, @Param("newProdId") String newProdId);

	/**
	 * 수정·삭제용 — 행을 잠그고 읽는다. 매물 저장은 전체 컬럼 UPDATE 라, 잠금 없이 읽으면 그 사이 구매요청이 줄인
	 * 재고·거래완료일시를 옛 값으로 덮어쓴다(초과판매). 잠그면 재고 차감(reserveStock)과 차례로 실행된다.
	 */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select l from Listing l where l.userId = :userId and l.regDate = :regDate")
	Optional<Listing> findForUpdate(@Param("userId") UUID userId, @Param("regDate") String regDate);

	/**
	 * 견적·장바구니 담기용 — 공유 잠금(FOR SHARE)으로 읽는다. FK 가 있을 땐 거래 행 INSERT 가 매물 행을 잠가 삭제·상품 변경과 차례가
	 * 정해졌는데, FK 를 없애(2026-10-27) 그 일을 여기서 한다. 공유 잠금끼리는 막지 않아 여러 구매자의 담기는 서로 기다리지 않는다
	 */
	@Lock(LockModeType.PESSIMISTIC_READ)
	@Query("select l from Listing l where l.userId = :userId and l.regDate = :regDate")
	Optional<Listing> findForShare(@Param("userId") UUID userId, @Param("regDate") String regDate);

	/** 거래 행에서 매물을 잠그고 읽는다 (거래 행의 seller_id, prod_reg_date, prod_id) */
	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("select l from Listing l where l.userId = :userId and l.regDate = :regDate and l.prodId = :prodId")
	Optional<Listing> findForUpdate(@Param("userId") UUID userId, @Param("regDate") String regDate,
			@Param("prodId") String prodId);
}
