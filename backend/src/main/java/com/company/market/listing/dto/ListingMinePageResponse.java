package com.company.market.listing.dto;

import java.util.List;

public record ListingMinePageResponse(List<ListingMineItemResponse> items, String nextCursor) {
}
