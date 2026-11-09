package com.company.market.listing.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** 엑셀 대량구매의 매물 후보·대체상품 조회 (계획 2026-11-09-bulk-purchase-excel.md 작업 1). 외래키가 없어 판매자 행 없이 임의 UUID 를 쓴다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ProductLookupForPurchaseTest {

	private static final String CATEGORY = "P01-Q01-R001";

	@Autowired
	ListingService listingService;

	@Autowired
	ProductService products;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final UUID sellerA = UUID.randomUUID();

	final UUID sellerB = UUID.randomUUID();

	Product main;

	Product alt;

	@BeforeEach
	void setUp() {
		cleanUp();
		alt = products.findOrCreate(draft("구매조회 대체품 X", "Acme", null));
		// 대체상품명은 대체품의 이름과 대소문자·공백만 다르게 적는다
		main = products.findOrCreate(draft("구매조회 원품 A", "Acme", "  구매조회  대체품  x "));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (?, ?)", sellerA, sellerB);
		jdbc.update("delete from trd_prod_master where prod_name like '구매조회 %'");
	}

	private static ProductDraft draft(String name, String brand, String alterName) {
		return new ProductDraft(CategoryFragments.parse(CATEGORY), name, null, brand, null, null, null, null, alterName, null, null);
	}

	private void listing(UUID seller, String regDate, String prodId, int price, int stock, boolean completed, String replaceProd) {
		listings.saveAndFlush(Listing.builder().userId(seller).regDate(regDate).prodId(prodId).tradeType("등록").prodState("신품")
			.salesUnitPrice(price).salesQuantity(stock).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(stock)
			.replaceProd(replaceProd).build());
		if (completed) {
			// 거래완료일시는 빌더에 없다 — 판매완료 표시와 같은 값을 직접 넣는다
			jdbc.update("update trd_prod_reg set dt_expire = '20261101000000' where user_id = ? and reg_date = ?", seller, regDate);
		}
	}

	@Test
	@DisplayName("마스터의 매물이 전부 나온다 — 거래완료도 (사유를 보이려고), 다른 상품 매물은 안 나온다")
	void snapshotsOfProduct() {
		listing(sellerA, "20261105100000", main.getProdId(), 1000, 5, false, null);
		listing(sellerB, "20261105100001", main.getProdId(), 900, 0, true, null);
		listing(sellerA, "20261105100002", alt.getProdId(), 800, 3, false, null);

		List<ListingTradeSnapshot> found = listingService.snapshotsOfProduct(main.getProdId());

		assertThat(found).extracting(ListingTradeSnapshot::regDate).containsExactlyInAnyOrder("20261105100000", "20261105100001");
		assertThat(found).filteredOn(ListingTradeSnapshot::completed).hasSize(1);
		assertThat(found).allSatisfy(s -> assertThat(s.prodId()).isEqualTo(main.getProdId()));
	}

	@Test
	@DisplayName("매물이 없는 마스터는 빈 목록")
	void noListings() {
		assertThat(listingService.snapshotsOfProduct(main.getProdId())).isEmpty();
	}

	@Test
	@DisplayName("매물의 대체품 글은 있는 것만 돌려준다")
	void replaceHints() {
		listing(sellerA, "20261105100000", main.getProdId(), 1000, 5, false, "다른 규격 가능");
		listing(sellerB, "20261105100001", main.getProdId(), 900, 5, false, null);

		Map<ListingId, String> hints = listingService.replaceHints(List.of(new ListingId(sellerA, "20261105100000", main.getProdId()),
				new ListingId(sellerB, "20261105100001", main.getProdId())));

		assertThat(hints).hasSize(1).containsValue("다른 규격 가능");
	}

	@Test
	@DisplayName("대체상품명과 이름이 같은 마스터(대소문자·공백 무시)가 대체품으로 나온다")
	void alternatesOf() {
		assertThat(products.alternatesOf(main)).extracting(Product::getProdId).containsExactly(alt.getProdId());
	}

	@Test
	@DisplayName("대체상품명이 없거나 비어 있으면 빈 목록")
	void noAlternate() {
		assertThat(products.alternatesOf(alt)).isEmpty();
		Product blank = products.findOrCreate(draft("구매조회 공백 B", "Acme", "   "));
		assertThat(products.alternatesOf(blank)).isEmpty();
	}

	@Test
	@DisplayName("대체상품명이 자기 자신 이름이면 자기 자신은 뺀다, 대체품이 또 대체상품명을 가져도 한 단계까지만")
	void selfAndChain() {
		Product self = products.findOrCreate(draft("구매조회 자기 C", "Acme", "구매조회 자기 C"));
		assertThat(products.alternatesOf(self)).isEmpty();

		// alt 의 대체상품명이 원품이어도(A → X → A) 원품 한 단계 결과에 이어 붙이지 않는다
		jdbc.update("update trd_prod_master set alter_prod_name = ? where prod_id = ?", "구매조회 원품 A", alt.getProdId());
		Product reloaded = products.get(main.getProdId());
		assertThat(products.alternatesOf(reloaded)).extracting(Product::getProdId).containsExactly(alt.getProdId());
	}

}
