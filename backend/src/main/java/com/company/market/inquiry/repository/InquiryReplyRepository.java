package com.company.market.inquiry.repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

import com.company.market.inquiry.domain.InquiryReply;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InquiryReplyRepository extends JpaRepository<InquiryReply, UUID> {

	List<InquiryReply> findByInquiryIdOrderByCreatedAtAscIdAsc(UUID inquiryId);

	/** 목록의 답글 수를 한 쿼리로 (N+1 방지). 행 = [inquiryId(UUID), count(Long)], 답글 없는 글은 행이 없다 */
	@Query("select r.inquiryId, count(r) from InquiryReply r where r.inquiryId in :ids group by r.inquiryId")
	List<Object[]> countByInquiryIds(@Param("ids") Collection<UUID> ids);

}
