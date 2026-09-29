package com.company.market.listing.repository;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.Product;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProductRepositoryTest {

	@Autowired
	ProductRepository products;

	@Test
	@DisplayName("상품명+제조사로 조회된다")
	void findsByNameAndBrand() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());

		assertThat(products.findByProdNameAndProdBrand("노트북 A", "삼성")).isPresent();
		assertThat(products.findByProdNameAndProdBrand("노트북 A", "LG")).isEmpty();
	}

	@Test
	@DisplayName("prod_id 접두어로 개수를 센다 (채번용)")
	void countsByPrefix() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001").prodName("A").prodBrand("삼성").regDate("20260929120000").build());
		products.saveAndFlush(Product.builder().prodId("ELEC00010002").categoryCode("ELEC0001").prodName("B").prodBrand("LG").regDate("20260929120001").build());

		assertThat(products.countByProdIdStartingWith("ELEC0001")).isEqualTo(2);
	}

	@Test
	@DisplayName("이미 있는 prod_id 로 다시 save 하면 기존 값을 조용히 덮어쓰지 않고 예외를 던진다")
	void savingDuplicateProdIdDoesNotSilentlyOverwrite() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("원래이름").prodBrand("삼성").regDate("20260929120000").build());

		Product duplicate = Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("바뀐이름").prodBrand("다른브랜드").regDate("20260929120001").build();

		assertThatThrownBy(() -> products.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
	}

}
