package com.company.market.listing.controller;

import java.util.List;
import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.dto.ProductSearchItemResponse;
import com.company.market.listing.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 등록 폼의 상품마스터 찾기. 로그인 필요(SecurityConfig 기본). 읽기라 rate limit 은 두지 않는다 */
@RestController
@RequestMapping("/api/v1/products")
@RequiredArgsConstructor
public class ProductController {

	static final int MAX_QUERY_LENGTH = 50;

	private final ProductService products;

	@GetMapping
	public ApiResponse<List<ProductSearchItemResponse>> search(@RequestParam(name = "q", defaultValue = "") String q) {
		String query = q.trim();
		// 빈 검색어는 허용 — 등록 폼의 드롭다운이 열릴 때 이름순 앞 10건을 보여 준다
		if (query.length() > MAX_QUERY_LENGTH) {
			throw new ValidationException(Map.of("q", "검색어는 " + MAX_QUERY_LENGTH + "자 이하로 입력하세요."));
		}
		return ApiResponse.of(products.search(query));
	}

}
