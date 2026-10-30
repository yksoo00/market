package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ProductSearchItemResponse;
import com.company.market.listing.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 상품마스터: 이름·제조사·분류번호·제조일이 모두 같은 상품이 있으면 재사용, 없으면 채번해서 새로 만든다.
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

	private final ProductRepository products;

	private final CategoryService categories;

	private final Clock clock;

	/**
	 * 생성 잠금(트랜잭션 끝까지) 뒤에 찾는다 — 같은 네 값을 동시에 처음 등록해도 하나만 생기고, 개수 기반 채번도 겹치지 않는다.
	 * 빈 분류번호·제조일은 null 과 같은 "없음"
	 */
	@Transactional
	public Product findOrCreate(ProductDraft draft) {
		products.lockCreation();
		return products.findSame(draft.prodName(), draft.prodBrand(), orEmpty(draft.prodClassNo()), orEmpty(draft.prodMufcDate()))
			.orElseGet(() -> create(draft));
	}

	private static String orEmpty(String value) {
		return value == null ? "" : value.trim();
	}

	private static String blankToNull(String value) {
		return value == null || value.isBlank() ? null : value.trim();
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
					p.getProdName(), p.getProdNo(), p.getProdBrand(), p.getProdClassNo(), p.getProdMufcDate(), p.getProdSpecInfo(),
					p.getProdUsefulLife(), p.getWarrantyMethod(), p.getAlterProdName(), p.getProdDataSheet(), p.getProdPhoto1()))
			.toList();
	}

	/** 상품명에 word 가 들어 있는 상품ID, 최대 limit 개. %·_·\ 는 글자로 찾는다 (거래이력 검색) */
	public List<String> idsByName(String word, int limit) {
		String escaped = word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		return products.findIdsByName("%" + escaped + "%", PageRequest.of(0, limit));
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
			.prodMufcDate(blankToNull(draft.prodMufcDate()))
			.prodSpecInfo(draft.prodSpecInfo())
			.prodDataSheet(draft.prodDataSheet())
			.prodPhoto1(draft.firstPhoto())
			.regDate(LocalDateTime.now(clock).format(REG_DATE_FORMAT))
			.build());
	}

	public record ProductDraft(CategoryFragments category, String prodName, String prodNo, String prodBrand,
			String prodClassNo, String prodMufcDate, String prodSpecInfo, Integer prodUsefulLife, String warrantyMethod,
			String alterProdName, String prodDataSheet, String firstPhoto) {
	}

}
