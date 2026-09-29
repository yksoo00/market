package com.company.market.listing.dto;

import java.util.List;

public record ListingPageResponse(List<ListingSummaryResponse> items, String nextCursor) {
}
