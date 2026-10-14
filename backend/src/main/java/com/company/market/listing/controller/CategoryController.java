package com.company.market.listing.controller;

import java.util.List;

import com.company.market.common.api.ApiResponse;
import com.company.market.listing.dto.CategoryResponse;
import com.company.market.listing.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 등록 폼의 카테고리 목록. 로그인 필요(SecurityConfig 기본). 읽기라 rate limit 은 두지 않는다 */
@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

	private final CategoryService categories;

	@GetMapping
	public ApiResponse<List<CategoryResponse>> list() {
		return ApiResponse.of(categories.list());
	}

}
