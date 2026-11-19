package com.company.market.inquiry.dto;

import java.time.Instant;
import java.util.UUID;

/** 목록 한 줄. 내용은 싣지 않는다 */
public record InquiryListItem(UUID id, String title, Instant createdAt, long replyCount) {
}
