package com.company.market.listing.service;

import java.util.List;

import com.company.market.listing.dto.CategoryResponse;
import com.company.market.listing.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

	private final CategoryRepository categories;

	/** 메뉴에 보이는(is_display='Y') 카테고리 전부, 코드순. 239건이라 한 번에 준다 */
	public List<CategoryResponse> list() {
		return categories.findByIsDisplayOrderByCategoryCode("Y").stream().map(CategoryResponse::of).toList();
	}

}
