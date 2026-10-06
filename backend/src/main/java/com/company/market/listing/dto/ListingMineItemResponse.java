package com.company.market.listing.dto;

import java.util.UUID;

/**
 * 내 매물 한 줄 (추가등록 대상 고르기·마이페이지 목록). extraFilled = 보증기간·불량지원·대체품·테스트리포트·인증서 중 채운 개수(0~5).
 * photo = 대표 사진 키(prodPhoto1). 사진은 공개 경로(public/…)라 키를 내보내도 된다 — 비공개 파일(데이터시트 등)은 담지 않는다
 */
public record ListingMineItemResponse(
		UUID userId,
		String regDate,
		String prodNo,
		String prodName,
		String prodBrand,
		int extraFilled,
		Integer salesUnitPrice,
		Integer salesQuantity,
		String tradeStatus,
		String photo) {
}
