package com.company.market.listing.service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.CategoryRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductServiceTest {

	@Autowired
	ProductService service;

	@Autowired
	ProductRepository products;

	@Autowired
	CategoryRepository categories;

	@Test
	@DisplayName("이름+제조사가 같은 상품이 이미 있으면 새로 만들지 않고 그 행을 돌려준다")
	void reusesExisting() {
		Product existing = products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("P01-Q01-R001")
			.prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());

		Product found = service.findOrCreate(new ProductDraft("P01-Q01-R001", "노트북 A", null, "삼성", null, null, null, null));

		assertThat(found.getProdId()).isEqualTo(existing.getProdId());
		assertThat(products.count()).isEqualTo(1);
	}

	@Test
	@DisplayName("없는 상품이면 KP-연도-일련번호(6자리)로 채번해 만들고, 대표사진은 넘어온 첫 사진. 옛 형식 ID는 번호에 안 셈")
	void createsWithGeneratedId() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("P01-Q01-R001")
			.prodName("옛 상품").prodBrand("삼성").regDate("20260929120000").build());
		ProductService service = at("2026-10-08T03:00:00Z");

		Product created = service.findOrCreate(new ProductDraft("P01-Q01-R001", "노트북 B", "MODEL-1", "LG", null, null, null, "photo-1.jpg"));

		assertThat(created.getProdId()).isEqualTo("KP-2026-000001");
		assertThat(created.getProdPhoto1()).isEqualTo("photo-1.jpg");
	}

	@Test
	@DisplayName("같은 해에 두 번째로 새로 만들면 일련번호가 000002 — 카테고리가 달라도 이어진다")
	void incrementsSequenceWithinYear() {
		ProductService service = at("2026-10-08T03:00:00Z");
		service.findOrCreate(new ProductDraft("P01-Q01-R001", "노트북 C", null, "삼성", null, null, null, null));

		Product second = service.findOrCreate(new ProductDraft("P01-Q01-R002", "노트북 D", null, "삼성", null, null, null, null));

		assertThat(second.getProdId()).isEqualTo("KP-2026-000002");
	}

	@Test
	@DisplayName("일련번호는 해마다 1부터. 연도는 한국 날짜 기준 (UTC 12/31 15:00 = 한국 1/1 0시)")
	void restartsSequenceEachKoreanYear() {
		at("2026-12-31T14:59:59Z").findOrCreate(new ProductDraft("P01-Q01-R001", "노트북 F", null, "삼성", null, null, null, null));

		Product next = at("2026-12-31T15:00:00Z").findOrCreate(new ProductDraft("P01-Q01-R001", "노트북 G", null, "삼성", null, null, null, null));

		assertThat(next.getProdId()).isEqualTo("KP-2027-000001");
	}

	@Test
	@DisplayName("검색은 이름·제조사·상품번호 어디든 부분 일치, 대소문자 무시, 카테고리 이름을 붙인다")
	void searchMatchesNameBrandAndNumber() {
		products.saveAndFlush(Product.builder().prodId("KP-2026-900001").categoryCode("P01-Q01-R001").prodName("PowerEdge R740")
			.prodBrand("Dell").prodNo("R740-4210").regDate("20261014120000").build());
		products.saveAndFlush(Product.builder().prodId("KP-2026-900002").categoryCode("P01-Q01-R001").prodName("노트북 Z")
			.prodBrand("삼성").regDate("20261014120000").build());

		assertThat(service.search("poweredge")).extracting("prodId").containsExactly("KP-2026-900001");
		assertThat(service.search("dell")).extracting("prodId").containsExactly("KP-2026-900001");
		assertThat(service.search("4210")).extracting("prodId").containsExactly("KP-2026-900001");
		assertThat(service.search("삼성")).extracting("prodId").containsExactly("KP-2026-900002");
		assertThat(service.search("poweredge").get(0).categoryName()).isEqualTo("인텔 CPU");
	}

	@Test
	@DisplayName("검색어의 %·_ 는 문자 그대로 찾는다 — \"%\" 한 글자로 전체가 나오지 않는다")
	void searchTreatsWildcardsAsLiterals() {
		products.saveAndFlush(Product.builder().prodId("KP-2026-900003").categoryCode("P01-Q01-R001").prodName("SSD 100%")
			.prodBrand("A").regDate("20261014120000").build());
		products.saveAndFlush(Product.builder().prodId("KP-2026-900004").categoryCode("P01-Q01-R001").prodName("HDD")
			.prodBrand("B").regDate("20261014120000").build());

		assertThat(service.search("%")).extracting("prodId").containsExactly("KP-2026-900003");
		assertThat(service.search("_")).isEmpty();
	}

	@Test
	@DisplayName("검색 결과는 최대 10건")
	void searchLimitsTo10() {
		for (int i = 0; i < 12; i++) {
			products.save(Product.builder().prodId("KP-2026-91%04d".formatted(i)).categoryCode("P01-Q01-R001").prodName("대량 상품 " + i)
				.prodBrand("대량").regDate("20261014120000").build());
		}
		products.flush();

		assertThat(service.search("대량 상품")).hasSize(10);
	}

	private ProductService at(String instant) {
		return new ProductService(products, categories, Clock.fixed(Instant.parse(instant), ZoneOffset.UTC));
	}

}
