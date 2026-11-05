package com.company.market.listing.dto;

import java.util.List;

public record BulkCheckResponse(List<BulkRowResult> results) {
}
