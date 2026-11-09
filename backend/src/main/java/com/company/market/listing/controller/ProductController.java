package com.company.market.listing.controller;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.dto.ProductSearchItemResponse;
import com.company.market.listing.dto.ProductSearchPageResponse;
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

	/**
	 * 큰 검색 모달 (계획 2026-11-09-product-search-modal.md). 검색어·카테고리·제조사 필터 + 페이지 번호(한 페이지 크기는 서버가 고정).
	 * 검색어·제조사는 공백 제거 후 50자 이하, 카테고리 형식·page 범위는 서비스가 검사한다
	 */
	@GetMapping("/page")
	public ApiResponse<ProductSearchPageResponse> page(@RequestParam(name = "q", defaultValue = "") String q,
			@RequestParam(name = "category", defaultValue = "") String category, @RequestParam(name = "brand", defaultValue = "") String brand,
			@RequestParam(name = "page", defaultValue = "1") int page) {
		Map<String, String> failures = new LinkedHashMap<>();
		requireMaxLength(failures, "q", "검색어", q);
		requireMaxLength(failures, "brand", "제조사", brand);
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		return ApiResponse.of(products.searchPage(q, category, brand, page));
	}

	private static void requireMaxLength(Map<String, String> failures, String field, String label, String value) {
		if (value.trim().length() > MAX_QUERY_LENGTH) {
			failures.put(field, label + "는 " + MAX_QUERY_LENGTH + "자 이하로 입력하세요.");
		}
	}

}
