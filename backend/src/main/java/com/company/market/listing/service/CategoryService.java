package com.company.market.listing.service;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.CategoryMaster;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.CategoryResponse;
import com.company.market.listing.repository.CategoryMasterRepository;
import com.company.market.listing.repository.CategoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CategoryService {

	static final String UNKNOWN_CATEGORY = "없는 카테고리 코드입니다.";

	private final CategoryRepository categories;

	private final CategoryMasterRepository masters;

	/** 메뉴에 보이는(is_display='Y') 카테고리 전부, 코드순. 239건이라 한 번에 준다 */
	public List<CategoryResponse> list() {
		return categories.findByIsDisplayOrderByCategoryCode("Y").stream().map(CategoryResponse::of).toList();
	}

	/**
	 * 등록·수정 폼이 보낸 소분류 경로 코드(P01-Q01-R001)를 조각으로. 조각 셋이 카테고리 마스터에 대·중·소로 있고
	 * 부모 관계(소→중→대)가 맞아야 한다 — 아니면 categoryCode 필드 오류 (2026-10-27 설계 PR 2)
	 */
	public CategoryFragments resolveMinor(String pathCode) {
		String[] parts = pathCode.trim().split("-", -1);
		if (parts.length != 3) {
			throw unknown();
		}
		Map<String, CategoryMaster> found = masters.findAllById(List.of(parts)).stream()
			.collect(Collectors.toMap(CategoryMaster::getCategoryCode, Function.identity()));
		if (!matches(found.get(parts[0]), "대", null) || !matches(found.get(parts[1]), "중", parts[0])
				|| !matches(found.get(parts[2]), "소", parts[1])) {
			throw unknown();
		}
		return new CategoryFragments(parts[0], parts[1], parts[2]);
	}

	private static boolean matches(CategoryMaster category, String depth, String parent) {
		return category != null && depth.equals(category.getCategoryDepth())
				&& Objects.equals(parent, category.getParentCode());
	}

	private static ValidationException unknown() {
		return new ValidationException(Map.of("categoryCode", UNKNOWN_CATEGORY));
	}

	/**
	 * 상품 카테고리의 "대 > 중 > 소" 이름. 소분류 이름만으론 "가전 기타"처럼 겹쳐서 경로를 다 보여 준다 (사용자 지시 2026-10-19).
	 * 카테고리 마스터에 없는 조각은 건너뛰고, 다 없으면 null — 화면은 코드를 그대로 보여 준다
	 */
	public String namePath(Product product) {
		CategoryFragments c = product.category();
		List<String> codes = Stream.of(c.major(), c.middle(), c.minor()).filter(Objects::nonNull).toList();
		Map<String, String> names = names(codes);
		String path = codes.stream().map(names::get).filter(Objects::nonNull).collect(Collectors.joining(" > "));
		return path.isEmpty() ? null : path;
	}

	/** 조각 코드 → 이름 (여러 상품을 한 쿼리로) */
	public Map<String, String> names(Collection<String> codes) {
		return masters.findAllById(codes).stream()
			.collect(Collectors.toMap(CategoryMaster::getCategoryCode, CategoryMaster::getCategoryName));
	}

}
