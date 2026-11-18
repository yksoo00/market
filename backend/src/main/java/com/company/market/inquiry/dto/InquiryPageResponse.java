package com.company.market.inquiry.dto;

import java.util.List;

public record InquiryPageResponse(List<InquiryListItem> items, String nextCursor) {
}
