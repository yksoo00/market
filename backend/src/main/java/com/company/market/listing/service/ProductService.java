package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import com.company.market.common.exception.ValidationException;
import com.company.market.common.paging.PageKeys;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ProductPageItemResponse;
import com.company.market.listing.dto.ProductSearchItemResponse;
import com.company.market.listing.dto.ProductSearchPageResponse;
import com.company.market.listing.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 상품마스터: 이름·제조사·분류번호가 모두 같은 상품이 있으면 재사용, 없으면 채번해서 새로 만든다.
 * 사양은 비교하지 않는다 (2026-10-27 설계 PR 2 — 2026-09-29 의 이름+제조사 재사용을 대체)
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

	/** 상품 ID = KP-연도-일련번호(6자리), 일련번호는 해마다 1부터 (사용자 지시, 2026-10-08) */
	private static final String PROD_ID_PREFIX = "KP-";

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	public static final int SEARCH_LIMIT = 10;

	/** 큰 검색 모달의 한 페이지 크기 — 서버가 고정한다(클라이언트가 못 바꾼다) */
	public static final int PAGE_SIZE = 20;

	/** 카테고리 경로 코드: 대 / 대-중 / 대-중-소 (각 조각 영문·숫자 4자 이하). 조각을 SQL 에 이어 붙이지 않고 바인딩만 한다 */
	private static final Pattern CATEGORY_PATH = Pattern.compile("^[A-Za-z0-9]{1,4}(-[A-Za-z0-9]{1,4}){0,2}$");

	private final ProductRepository products;

	private final CategoryService categories;

	private final Clock clock;

	/**
	 * 생성 잠금(트랜잭션 끝까지) 뒤에 찾는다 — 같은 세 값을 동시에 처음 등록해도 하나만 생기고, 개수 기반 채번도 겹치지 않는다.
	 * 빈 분류번호는 null 과 같은 "없음"
	 */
	@Transactional
	public Product findOrCreate(ProductDraft draft) {
		products.lockCreation();
		return products.findSame(draft.prodName(), draft.prodBrand(), orEmpty(draft.prodClassNo()))
			.orElseGet(() -> create(draft));
	}

	private static String orEmpty(String value) {
		return value == null ? "" : value.trim();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
	}

	/** 엑셀 다량 등록의 상품 찾기 — findOrCreate 의 "같은 상품"과 같은 세 값이되 대소문자를 무시한다. 만들지는 않는다 */
	public Optional<Product> findSameIgnoreCase(String prodName, String prodBrand, String prodClassNo) {
		return products.findAllSameIgnoreCase(prodName, prodBrand, orEmpty(prodClassNo), PageRequest.of(0, 1)).stream().findFirst();
	}

	/**
	 * 엑셀 대량구매의 상품 찾기 — 이름(+제조사, +분류번호)이 같은 마스터를 **전부**(최대 limit) 돌려준다. 이름·제조사는 대소문자·공백·하이픈을
	 * 무시하고, 제조사·분류번호가 비면(null/빈 글) 그 칸은 보지 않는다. 하나일 때만 자동으로 정하는 건 부르는 쪽이다(여럿이면 사용자가 고른다)
	 */
	public List<Product> findAllLoose(String prodName, String prodBrand, String prodClassNo, int limit) {
		String name = looseKey(prodName);
		if (name.isEmpty()) {
			// 공백·하이픈뿐인 이름이 '' 키로 모든 마스터와 겹치지 않게
			return List.of();
		}
		return products.findAllLoose(name, looseKey(prodBrand), orEmpty(prodClassNo), PageRequest.of(0, limit));
	}

	/** 엑셀 대량구매의 폴백 — 이름이 정확히 같은 마스터가 없을 때 이름에 포함된 마스터(이름이 짧은 순, 최대 limit). 공백·하이픈·대소문자는 무시한다 */
	public List<Product> findAllNameContains(String prodName, int limit) {
		String key = looseKey(prodName);
		if (key.isEmpty()) {
			return List.of();
		}
		String escaped = key.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return products.findAllNameContains("%" + escaped + "%", PageRequest.of(0, limit));
	}

	/** 비교용 키 — 소문자, 공백과 하이픈 제거. 저장소 쿼리(findAllLoose)가 DB 쪽 값에 replace 로 같은 정리를 한다 */
	private static String looseKey(String value) {
		return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[\\s-]+", "");
	}

	/**
	 * 엑셀 대량구매의 대체품 제안 — 이 마스터의 대체상품명(자유 글)과 이름이 같은 마스터. 한 단계만 본다(대체품의 대체품은 따라가지 않아
	 * A → X → A 같은 순환이 없다). 자기 자신은 뺀다. 대체상품명이 비어 있으면 빈 목록
	 */
	public List<Product> alternatesOf(Product master) {
		String name = blankToNull(master.getAlterProdName());
		if (name == null) {
			return List.of();
		}
		return products.findAllByNameIgnoreCase(name.replaceAll("\\s+", " ")).stream()
			.filter(p -> !p.getProdId().equals(master.getProdId()))
			.toList();
	}

	/** 등록 폼이 고른 마스터. 없으면 호출한 쪽이 400 으로 알린다 */
	public Optional<Product> find(String prodId) {
		return products.findById(prodId);
	}

	/** 마스터 검색(등록 폼의 상품 찾기). %·_·\ 는 문자 그대로 찾는다 — 그대로 LIKE 에 넣으면 "%" 한 글자로 전체가 나온다 */
	public List<ProductSearchItemResponse> search(String query) {
		String escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		List<Product> found = products.search("%" + escaped + "%", PageRequest.of(0, SEARCH_LIMIT));
		Map<String, String> names = categories.names(found.stream().map(Product::getMinorCategory).filter(Objects::nonNull).distinct().toList());
		return found.stream()
			.map(p -> new ProductSearchItemResponse(p.getProdId(), p.getCategoryCode(), p.getMinorCategory() == null ? null : names.get(p.getMinorCategory()),
					p.getProdName(), p.getProdNo(), p.getProdBrand(), p.getProdClassNo(), p.getProdSpecInfo(),
					p.getProdUsefulLife(), p.getWarrantyMethod(), p.getAlterProdName(), p.getProdDataSheet(), p.getProdPhoto1()))
			.toList();
	}

	/**
	 * 큰 검색 모달 (계획 2026-11-09-product-search-modal.md). 검색어(이름·제조사·상품번호·분류번호 부분일치)·카테고리(대/중/소 아무 단계)·제조사(부분일치)로 걸러
	 * 관련도 순으로 보이고 페이지 번호로 넘긴다. 범위 밖 page 는 400(결과가 비어도 1페이지는 있다). %·_· 는 문자 그대로 찾는다.
	 * 정렬된 ID 전부로 경계를 구하고(PageKeys) 그 페이지의 ID 만 읽는다 — 마스터가 수만 건을 넘으면 다시 본다
	 */
	public ProductSearchPageResponse searchPage(String q, String category, String brand, int page) {
		String query = q == null ? "" : q.trim();
		String brandText = brand == null ? "" : brand.trim();
		String[] path = categoryPath(category);
		String contains = query.isEmpty() ? "" : "%" + escapeLike(query) + "%";
		String prefix = query.isEmpty() ? "" : escapeLike(query) + "%";
		String brandPattern = brandText.isEmpty() ? "" : "%" + escapeLike(brandText) + "%";

		List<String> ids = products.orderedIds(query, contains, prefix, path[0], path[1], path[2], brandPattern);
		PageKeys.of(ids, page, PAGE_SIZE);
		List<String> pageIds = ids.subList((page - 1) * PAGE_SIZE, Math.min(ids.size(), page * PAGE_SIZE));
		if (pageIds.isEmpty()) {
			return new ProductSearchPageResponse(List.of(), 1, 1, 0);
		}
		Map<String, Product> byId = getAll(pageIds);
		Map<String, String> names = categories.names(byId.values().stream().map(Product::getMinorCategory).filter(Objects::nonNull).distinct().toList());
		Map<String, Integer> counts = new HashMap<>();
		products.countAvailableListings(pageIds).forEach(row -> counts.put((String) row[0], ((Number) row[1]).intValue()));
		// ID 목록을 읽은 뒤 그 사이에 지워진 마스터는 건너뛴다 (두 읽기가 한 스냅샷이 아닐 수 있다)
		List<ProductPageItemResponse> items = pageIds.stream().map(byId::get).filter(Objects::nonNull).map(p -> new ProductPageItemResponse(p.getProdId(), p.getCategoryCode(),
				p.getMinorCategory() == null ? null : names.get(p.getMinorCategory()), p.getProdName(), p.getProdNo(), p.getProdBrand(),
				p.getProdClassNo(), p.getProdSpecInfo(), p.getProdUsefulLife(), p.getWarrantyMethod(), p.getAlterProdName(), p.getProdDataSheet(),
				p.getProdPhoto1(), counts.getOrDefault(p.getProdId(), 0))).toList();
		int totalPages = Math.max(1, (ids.size() + PAGE_SIZE - 1) / PAGE_SIZE);
		return new ProductSearchPageResponse(items, page, totalPages, ids.size());
	}

	/** "P01-Q01" → ["P01","Q01",""]. 비었으면 모두 "", 형식이 틀리면 400 (없는 코드는 오류가 아니라 빈 결과) */
	private static String[] categoryPath(String category) {
		String[] out = { "", "", "" };
		if (category == null || category.isBlank()) {
			return out;
		}
		String trimmed = category.trim();
		if (!CATEGORY_PATH.matcher(trimmed).matches()) {
			throw new ValidationException(Map.of("category", "카테고리 코드 형식이 올바르지 않습니다."));
		}
		String[] parts = trimmed.split("-");
		System.arraycopy(parts, 0, out, 0, parts.length);
		return out;
	}

	private static String escapeLike(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

	/** 리스팅이 FK로 갖고 있는 prod_id 는 항상 유효(제약) — 없으면 데이터 정합성 문제이므로 예외를 그대로 던진다 */
	public Product get(String prodId) {
		return products.findById(prodId).orElseThrow();
	}

	/** 여러 상품을 한 쿼리로 (목록 N+1 방지) */
	public Map<String, Product> getAll(Collection<String> prodIds) {
		return products.findAllById(prodIds).stream().collect(Collectors.toMap(Product::getProdId, p -> p));
	}

	private Product create(ProductDraft draft) {
		// 연도는 한국 날짜 — UTC 그대로면 1월 1일 오전 9시 전엔 전년도 번호가 된다
		String prefix = PROD_ID_PREFIX + KoreanDates.today(clock).getYear() + "-";
		long sequence = products.countByProdIdStartingWith(prefix) + 1;
		String prodId = prefix + String.format("%06d", sequence);

		return products.saveAndFlush(Product.builder()
			.prodId(prodId)
			.majorCategory(draft.category().major())
			.middleCategory(draft.category().middle())
			.minorCategory(draft.category().minor())
			.prodName(draft.prodName())
			.prodNo(draft.prodNo())
			.prodBrand(draft.prodBrand())
			.prodClassNo(blankToNull(draft.prodClassNo()))
			.prodUsefulLife(draft.prodUsefulLife())
			.warrantyMethod(blankToNull(draft.warrantyMethod()))
			.alterProdName(blankToNull(draft.alterProdName()))
			.prodSpecInfo(draft.prodSpecInfo())
			.prodDataSheet(draft.prodDataSheet())
			.prodPhoto1(draft.firstPhoto())
			.regDate(LocalDateTime.now(clock).format(REG_DATE_FORMAT))
			.build());
	}

	public record ProductDraft(CategoryFragments category, String prodName, String prodNo, String prodBrand,
			String prodClassNo, String prodSpecInfo, Integer prodUsefulLife, String warrantyMethod,
			String alterProdName, String prodDataSheet, String firstPhoto) {
	}

}
