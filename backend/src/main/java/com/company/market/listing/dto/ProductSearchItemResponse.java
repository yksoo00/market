package com.company.market.listing.dto;

/** 등록 폼의 상품마스터 찾기 결과 한 줄. 파일 칸은 업로드 키(없으면 null) — 등록하면 매물이 그 키를 복사한다 */
public record ProductSearchItemResponse(String prodId, String categoryCode, String categoryName, String prodName,
		String prodNo, String prodBrand, String prodMufcDate, String prodSpecInfo, String prodDataSheet,
		String prodPhoto1) {
}
