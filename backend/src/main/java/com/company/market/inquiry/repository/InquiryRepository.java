package com.company.market.inquiry.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.company.market.inquiry.domain.Inquiry;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InquiryRepository extends JpaRepository<Inquiry, UUID> {

	@Query("select i from Inquiry i order by i.createdAt desc, i.id desc")
	List<Inquiry> findFirstPage(Pageable page);

	/** 커서(createdAt, id) 뒤의 글. 같은 시각 글도 id 로 갈라 하나도 빠지지 않는다 */
	@Query("""
			select i from Inquiry i
			where i.createdAt < :at or (i.createdAt = :at and i.id < :id)
			order by i.createdAt desc, i.id desc
			""")
	List<Inquiry> findPageAfter(@Param("at") Instant at, @Param("id") UUID id, Pageable page);

}
