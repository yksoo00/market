package com.company.market.listing.service;

import com.company.market.TestUids;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingTraits;
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

/** 대량구매 조건 판정용 매물 특성 (계획 2026-11-09-bulk-purchase-conditions.md 작업 1) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingTraitsTest {

	@Autowired
	ListingService listingService;

	@Autowired
	ProductService products;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final String seller = TestUids.random();

	Product master;

	@BeforeEach
	void setUp() {
		cleanUp();
		master = products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), "특성조회 상품 A", null, "Acme", null, null, null,
				null, null, null, null));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id = ?", seller);
		jdbc.update("delete from trd_prod_master where prod_name like '특성조회 %'");
	}

	private ListingId save(String regDate, Listing.ListingBuilder b) {
		listings.saveAndFlush(b.userId(seller).regDate(regDate).prodId(master.getProdId()).tradeType("등록").salesUnitPrice(1000).salesQuantity(5)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(5).build());
		return new ListingId(seller, regDate, master.getProdId());
	}

	@Test
	@DisplayName("상태·보증일·증빙 유무가 매물별로 정확히 나온다 (사진은 네 칸 중 하나라도, 빈 글은 없음)")
	void traits() {
		ListingId full = save("20261105100000", Listing.builder().prodState("신품").warrantyPeriod(180).prodDataSheet("private/ds.pdf")
			.prodImage4("public/p4.png").warrantyCoverage("대체").testReport("private/tr.pdf").certificateOfAuthen("private/c.pdf"));
		ListingId bare = save("20261105100001", Listing.builder().prodState("신품대비 70~79%").prodDataSheet("  ").prodPhoto1(""));

		Map<ListingId, ListingTraits> traits = listingService.traitsOfProduct(master.getProdId());

		assertThat(traits.get(full)).isEqualTo(new ListingTraits("신품", 180, true, true, "대체", true, true));
		assertThat(traits.get(bare)).isEqualTo(new ListingTraits("신품대비 70~79%", null, false, false, null, false, false));
	}

	@Test
	@DisplayName("매물이 없는 마스터는 빈 맵")
	void missing() {
		assertThat(listingService.traitsOfProduct(master.getProdId())).isEmpty();
	}

}
