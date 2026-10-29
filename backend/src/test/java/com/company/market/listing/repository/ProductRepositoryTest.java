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
	@DisplayName("같은 상품은 이름·제조사·분류번호·제조일로 찾는다 — 없는 칸은 \"\" 로 넘긴다")
	void findsSameByFourValues() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName("노트북 A").prodBrand("삼성").prodClassNo("C-1").regDate("20260929120000").build());

		assertThat(products.findSame("노트북 A", "삼성", "C-1", "")).isPresent();
		assertThat(products.findSame("노트북 A", "LG", "C-1", "")).isEmpty();
		assertThat(products.findSame("노트북 A", "삼성", "", "")).isEmpty();
		assertThat(products.findSame("노트북 A", "삼성", "C-1", "20260101")).isEmpty();
	}

	@Test
	@DisplayName("prod_id 접두어로 개수를 센다 (채번용)")
	void countsByPrefix() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").majorCategory("P01").middleCategory("Q01").minorCategory("R001").prodName("A").prodBrand("삼성").regDate("20260929120000").build());
		products.saveAndFlush(Product.builder().prodId("ELEC00010002").majorCategory("P01").middleCategory("Q01").minorCategory("R001").prodName("B").prodBrand("LG").regDate("20260929120001").build());

		assertThat(products.countByProdIdStartingWith("ELEC0001")).isEqualTo(2);
	}

	@Test
	@DisplayName("이미 있는 prod_id 로 다시 save 하면 기존 값을 조용히 덮어쓰지 않고 예외를 던진다")
	void savingDuplicateProdIdDoesNotSilentlyOverwrite() {
		products.saveAndFlush(Product.builder().prodId("ELEC00010001").majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName("원래이름").prodBrand("삼성").regDate("20260929120000").build());

		Product duplicate = Product.builder().prodId("ELEC00010001").majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName("바뀐이름").prodBrand("다른브랜드").regDate("20260929120001").build();

		assertThatThrownBy(() -> products.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
	}

}
