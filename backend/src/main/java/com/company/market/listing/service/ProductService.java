package com.company.market.listing.service;

import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상품마스터: 이름+제조사가 같은 상품이 있으면 재사용, 없으면 채번해서 새로 만든다 (decisions.md 2026-09-29) */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

	private static final int CATEGORY_PREFIX_LENGTH = 8;

	private final ProductRepository products;

	@Transactional
	public Product findOrCreate(ProductDraft draft) {
		return products.findByProdNameAndProdBrand(draft.prodName(), draft.prodBrand())
			.orElseGet(() -> create(draft));
	}

	private Product create(ProductDraft draft) {
		String prefix = categoryPrefix(draft.categoryCode());
		long sequence = products.countByProdIdStartingWith(prefix) + 1;
		String prodId = prefix + String.format("%04d", sequence);

		return products.save(Product.builder()
			.prodId(prodId)
			.categoryCode(draft.categoryCode())
			.prodName(draft.prodName())
			.prodNo(draft.prodNo())
			.prodBrand(draft.prodBrand())
			.prodMufcDate(draft.prodMufcDate())
			.prodSpecInfo(draft.prodSpecInfo())
			.prodDataSheet(draft.prodDataSheet())
			.prodPhoto1(draft.firstPhoto())
			.regDate(java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss")))
			.build());
	}

	private String categoryPrefix(String categoryCode) {
		if (categoryCode.length() >= CATEGORY_PREFIX_LENGTH) {
			return categoryCode.substring(0, CATEGORY_PREFIX_LENGTH);
		}
		return String.format("%-" + CATEGORY_PREFIX_LENGTH + "s", categoryCode).replace(' ', '0');
	}

	public record ProductDraft(String categoryCode, String prodName, String prodNo, String prodBrand,
			String prodMufcDate, String prodSpecInfo, String prodDataSheet, String firstPhoto) {
	}

}
