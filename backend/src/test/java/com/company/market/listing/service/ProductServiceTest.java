package com.company.market.listing.service;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.Product;
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

	@Test
	@DisplayName("이름+제조사가 같은 상품이 이미 있으면 새로 만들지 않고 그 행을 돌려준다")
	void reusesExisting() {
		Product existing = products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());

		Product found = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 A", null, "삼성", null, null, null, null));

		assertThat(found.getProdId()).isEqualTo(existing.getProdId());
		assertThat(products.count()).isEqualTo(1);
	}

	@Test
	@DisplayName("없는 상품이면 categoryCode(8자)+일련번호(4자리)로 채번해 만들고, 대표사진은 넘어온 첫 사진")
	void createsWithGeneratedId() {
		Product created = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 B", "MODEL-1", "LG", null, null, null, "photo-1.jpg"));

		assertThat(created.getProdId()).isEqualTo("ELEC00010001");
		assertThat(created.getProdPhoto1()).isEqualTo("photo-1.jpg");
	}

	@Test
	@DisplayName("같은 카테고리에서 두 번째로 새로 만들면 일련번호가 0002")
	void incrementsSequenceWithinCategory() {
		service.findOrCreate(new ProductDraft("ELEC0001", "노트북 C", null, "삼성", null, null, null, null));

		Product second = service.findOrCreate(new ProductDraft("ELEC0001", "노트북 D", null, "삼성", null, null, null, null));

		assertThat(second.getProdId()).isEqualTo("ELEC00010002");
	}

	@Test
	@DisplayName("categoryCode가 8자보다 짧으면 부족한 자리만 0으로 채우고 기존 문자는 그대로 둔다")
	void categoryPrefixPadsOnlyMissingLength() {
		Product created = service.findOrCreate(new ProductDraft("AB CD", "노트북 E", null, "LG", null, null, null, null));

		String prefix = created.getProdId().substring(0, 8);
		assertThat(prefix).isEqualTo("AB" + " " + "CD000");
		assertThat(created.getProdId()).hasSize(12).endsWith("0001");
	}

}
