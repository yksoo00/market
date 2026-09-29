package com.company.market.listing.repository;

import java.util.List;
import java.util.UUID;

import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ListingRepository extends JpaRepository<Listing, ListingId> {

	/** 첫 페이지. reg_date 만으로는 동률(다른 사용자, 같은 초)이 섞일 수 있어 user_id 로도 정렬해 다음 페이지와 순서가 맞물리게 한다 */
	List<Listing> findTop21ByOrderByRegDateDescUserIdDesc();

	/** 커서 이후 페이지. (reg_date, user_id) 튜플 비교 — reg_date 만 비교하면 같은 reg_date의 다른 사용자 매물을 건너뛴다 */
	@Query("select l from Listing l where l.regDate < :regDate or (l.regDate = :regDate and l.userId < :userId) "
			+ "order by l.regDate desc, l.userId desc")
	List<Listing> findPageBefore(@Param("regDate") String regDate, @Param("userId") UUID userId, Pageable pageable);

}
