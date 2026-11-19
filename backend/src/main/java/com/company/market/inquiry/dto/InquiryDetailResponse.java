package com.company.market.inquiry.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.company.market.inquiry.domain.Inquiry;

/** canEdit: 본인 글. canDelete: 본인 글 또는 관리자. 보는 사람 기준이다 */
public record InquiryDetailResponse(UUID id, String title, String content, Instant createdAt, boolean canEdit, boolean canDelete,
		List<InquiryReplyResponse> replies) {

	public static InquiryDetailResponse of(Inquiry inquiry, boolean canEdit, boolean canDelete, List<InquiryReplyResponse> replies) {
		return new InquiryDetailResponse(inquiry.getId(), inquiry.getTitle(), inquiry.getContent(), inquiry.getCreatedAt(), canEdit, canDelete,
				replies);
	}

}
