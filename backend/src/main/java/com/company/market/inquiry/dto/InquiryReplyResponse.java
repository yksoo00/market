package com.company.market.inquiry.dto;

import java.time.Instant;
import java.util.UUID;

import com.company.market.inquiry.domain.InquiryReply;

public record InquiryReplyResponse(UUID id, String content, Instant createdAt) {

	public static InquiryReplyResponse of(InquiryReply reply) {
		return new InquiryReplyResponse(reply.getId(), reply.getContent(), reply.getCreatedAt());
	}

}
