package com.company.market.inquiry.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.company.market.inquiry.domain.Inquiry;

public record InquiryDetailResponse(UUID id, String title, String content, Instant createdAt, List<InquiryReplyResponse> replies) {

	public static InquiryDetailResponse of(Inquiry inquiry, List<InquiryReplyResponse> replies) {
		return new InquiryDetailResponse(inquiry.getId(), inquiry.getTitle(), inquiry.getContent(), inquiry.getCreatedAt(), replies);
	}

}
