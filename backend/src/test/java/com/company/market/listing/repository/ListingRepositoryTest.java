package com.company.market.listing.repository;

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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
	@DisplayName("이미 있는 (user_id, reg_date) 로 다시 save 하면 기존 값을 조용히 덮어쓰지 않고 예외를 던진다")
	void savingDuplicateKeyDoesNotSilentlyOverwrite() {
		listings.saveAndFlush(baseListing("20260929120000"));

		Listing duplicate = Listing.builder().userId(userId).regDate("20260929120000").prodId(product.getProdId())
			.tradeType("변경됨").prodState("used").salesUnitPrice(999).salesQuantity(1)
			.minOrderQuantity(1).orderUnit(1).build();

		assertThatThrownBy(() -> listings.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
	}

}
