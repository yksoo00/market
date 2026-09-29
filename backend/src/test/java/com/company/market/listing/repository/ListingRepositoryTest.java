package com.company.market.listing.repository;

import java.util.List;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
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
class ListingRepositoryTest {

	@Autowired
	ListingRepository listings;

	@Autowired
	ProductRepository products;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	UUID userId;

	Product product;

	@BeforeEach
	void setUp() {
		User user = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingtester")
			.passwordHash("$2a$12$hash").nickname("listingtester").email("listingtester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build());
		userId = user.getId();
		product = products.saveAndFlush(Product.builder().prodId("ELEC00010001").categoryCode("ELEC0001")
			.prodName("노트북 A").prodBrand("삼성").regDate("20260929120000").build());
	}

	private Listing baseListing(String regDate) {
		return Listing.builder().userId(userId).regDate(regDate).prodId(product.getProdId())
			.tradeType("등록").prodState("new").salesUnitPrice(10000).salesQuantity(1)
			.minOrderQuantity(1).orderUnit(1).build();
	}

	@Test
	@DisplayName("(user_id, reg_date) 복합키로 저장·조회된다")
	void savesWithCompositeKey() {
		listings.saveAndFlush(baseListing("20260929120000"));

		assertThat(listings.findById(new ListingId(userId, "20260929120000"))).isPresent();
	}

	@Test
	@DisplayName("커서 이후 등록일시 내림차순으로 최대 21건 조회된다")
	void cursorOrdering() {
		listings.saveAndFlush(baseListing("20260929120000"));
		listings.saveAndFlush(baseListing("20260929120001"));

		List<Listing> page = listings.findTop21ByRegDateLessThanOrderByRegDateDesc("20260929120002");
		assertThat(page).extracting(Listing::getRegDate).containsExactly("20260929120001", "20260929120000");
	}

}
