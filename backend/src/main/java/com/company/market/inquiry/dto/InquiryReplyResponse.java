package com.company.market.inquiry.dto;

import java.time.Instant;
import java.util.UUID;

import com.company.market.inquiry.domain.InquiryReply;

/** canEdit: 본인 답글. canDelete: 본인 답글 또는 관리자. 보는 사람 기준이다 */
public record InquiryReplyResponse(UUID id, String content, Instant createdAt, boolean canEdit, boolean canDelete) {

	public static InquiryReplyResponse of(InquiryReply reply, boolean canEdit, boolean canDelete) {
		return new InquiryReplyResponse(reply.getId(), reply.getContent(), reply.getCreatedAt(), canEdit, canDelete);
	}

}
