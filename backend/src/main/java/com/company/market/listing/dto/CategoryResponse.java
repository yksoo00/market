package com.company.market.listing.dto;

import com.company.market.listing.domain.Category;

/** 카테고리 한 줄. parentCode 는 엑셀 정의대로 조각(`Q01`)이라 부모를 찾을 땐 코드 앞부분(`E01-F01`)을 쓴다 */
public record CategoryResponse(String categoryCode, String categoryName, String categoryDepth, String categoryClass,
		String parentCode) {

	public static CategoryResponse of(Category c) {
		return new CategoryResponse(c.getCategoryCode(), c.getCategoryName(), c.getCategoryDepth(), c.getCategoryClass(),
				c.getParentCode());
	}

}
