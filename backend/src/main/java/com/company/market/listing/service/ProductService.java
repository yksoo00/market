package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상품마스터: 이름+제조사가 같은 상품이 있으면 재사용, 없으면 채번해서 새로 만든다 (decisions.md 2026-09-29) */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

	/** 상품 ID = KP-연도-일련번호(6자리), 일련번호는 해마다 1부터 (사용자 지시, 2026-10-08) */
	private static final String PROD_ID_PREFIX = "KP-";

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final ProductRepository products;

	private final Clock clock;

	@Transactional
	public Product findOrCreate(ProductDraft draft) {
		return products.findByProdNameAndProdBrand(draft.prodName(), draft.prodBrand())
			.orElseGet(() -> createOrReuseOnRace(draft));
	}

	/** 리스팅이 FK로 갖고 있는 prod_id 는 항상 유효(제약) — 없으면 데이터 정합성 문제이므로 예외를 그대로 던진다 */
	public Product get(String prodId) {
		return products.findById(prodId).orElseThrow();
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
		// 연도는 한국 날짜 — 서버 Clock 은 UTC 라 그대로 쓰면 1월 1일 오전 9시 전엔 전년도 번호가 된다
		String prefix = PROD_ID_PREFIX + LocalDate.now(clock.withZone(SEOUL)).getYear() + "-";
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
