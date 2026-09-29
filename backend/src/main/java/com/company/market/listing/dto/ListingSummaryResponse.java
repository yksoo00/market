package com.company.market.listing.dto;

import java.util.UUID;

public record ListingSummaryResponse(
		UUID userId,
		String regDate,
		String prodId,
		String prodName,
		String prodBrand,
		Integer salesUnitPrice,
		Integer salesQuantity,
		String prodState,
		String thumbnail) {
}
