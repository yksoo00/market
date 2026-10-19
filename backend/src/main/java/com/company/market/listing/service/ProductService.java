package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.Category;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ProductSearchItemResponse;
import com.company.market.listing.repository.CategoryRepository;
import com.company.market.listing.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상품마스터: 이름+제조사가 같은 상품이 있으면 재사용, 없으면 채번해서 새로 만든다 (decisions.md 2026-09-29) */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

	/** 상품 ID = KP-연도-일련번호(6자리), 일련번호는 해마다 1부터 (사용자 지시, 2026-10-08) */
	private static final String PROD_ID_PREFIX = "KP-";

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	public static final int SEARCH_LIMIT = 10;

	private final ProductRepository products;

	private final CategoryRepository categories;

	private final Clock clock;

	@Transactional
	public Product findOrCreate(ProductDraft draft) {
		return products.findByProdNameAndProdBrand(draft.prodName(), draft.prodBrand())
			.orElseGet(() -> createOrReuseOnRace(draft));
	}

	/** 등록 폼이 고른 마스터. 없으면 호출한 쪽이 400 으로 알린다 */
	public Optional<Product> find(String prodId) {
		return products.findById(prodId);
	}

	/** 마스터 검색(등록 폼의 상품 찾기). %·_·\ 는 문자 그대로 찾는다 — 그대로 LIKE 에 넣으면 "%" 한 글자로 전체가 나온다 */
	public List<ProductSearchItemResponse> search(String query) {
		String escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
		List<Product> found = products.search("%" + escaped + "%", PageRequest.of(0, SEARCH_LIMIT));
		Map<String, String> names = categories.findAllById(found.stream().map(Product::getCategoryCode).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Category::getCategoryCode, Category::getCategoryName));
		return found.stream()
			.map(p -> new ProductSearchItemResponse(p.getProdId(), p.getCategoryCode(), names.get(p.getCategoryCode()),
					p.getProdName(), p.getProdNo(), p.getProdBrand(), p.getProdMufcDate(), p.getProdSpecInfo(),
					p.getProdDataSheet(), p.getProdPhoto1()))
			.toList();
	}

	/** 리스팅이 FK로 갖고 있는 prod_id 는 항상 유효(제약) — 없으면 데이터 정합성 문제이므로 예외를 그대로 던진다 */
	public Product get(String prodId) {
		return products.findById(prodId).orElseThrow();
	}

	/** 여러 상품을 한 쿼리로 (목록 N+1 방지) */
	public Map<String, Product> getAll(Collection<String> prodIds) {
		return products.findAllById(prodIds).stream().collect(Collectors.toMap(Product::getProdId, p -> p));
	}

	/**
	 * 동시에 같은 이름+제조사 상품을 처음 등록하면 prod_id 채번(카운트 기반)이 겹치거나
	 * (prod_name, prod_brand) 유니크 제약에 걸릴 수 있다. 둘 다 "이미 만들어졌다"는 뜻이므로 재조회해 재사용한다.
	 */
	private Product createOrReuseOnRace(ProductDraft draft) {
		try {
			return create(draft);
		}
		catch (DataIntegrityViolationException e) {
			return products.findByProdNameAndProdBrand(draft.prodName(), draft.prodBrand()).orElseThrow(() -> e);
		}
	}

	private Product create(ProductDraft draft) {
		// 연도는 한국 날짜 — UTC 그대로면 1월 1일 오전 9시 전엔 전년도 번호가 된다
		String prefix = PROD_ID_PREFIX + KoreanDates.today(clock).getYear() + "-";
		long sequence = products.countByProdIdStartingWith(prefix) + 1;
		String prodId = prefix + String.format("%06d", sequence);

		return products.saveAndFlush(Product.builder()
			.prodId(prodId)
			.categoryCode(draft.categoryCode())
			.prodName(draft.prodName())
			.prodNo(draft.prodNo())
			.prodBrand(draft.prodBrand())
			.prodMufcDate(draft.prodMufcDate())
			.prodSpecInfo(draft.prodSpecInfo())
			.prodDataSheet(draft.prodDataSheet())
			.prodPhoto1(draft.firstPhoto())
			.regDate(LocalDateTime.now(clock).format(REG_DATE_FORMAT))
			.build());
	}

	public record ProductDraft(String categoryCode, String prodName, String prodNo, String prodBrand,
			String prodMufcDate, String prodSpecInfo, String prodDataSheet, String firstPhoto) {
	}

}
