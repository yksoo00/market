package com.company.market.listing.dto;

/**
 * 상품마스터 검색(페이지 번호) 결과 한 줄. ProductSearchItemResponse 의 칸 + listingCount(재고가 있고 거래완료가 아닌 매물 수 —
 * 구매 쪽에서 살 수 있는 상품을 알아보게). 파일 칸은 업로드 키(없으면 null)
 */
public record ProductPageItemResponse(String prodId, String categoryCode, String categoryName, String prodName,
		String prodNo, String prodBrand, String prodClassNo, String prodSpecInfo, Integer prodUsefulLife,
		String warrantyMethod, String alterProdName, String prodDataSheet, String prodPhoto1, int listingCount) {
}
