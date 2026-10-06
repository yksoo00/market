package com.company.market.listing.dto;

import java.util.UUID;

/** 내 매물 한 줄 (추가등록 대상 고르기). extraFilled = 보증기간·불량지원·대체품·테스트리포트·인증서 중 채운 개수(0~5) */
public record ListingMineItemResponse(
		UUID userId,
		String regDate,
		String prodNo,
		String prodName,
		String prodBrand,
		int extraFilled) {
}
