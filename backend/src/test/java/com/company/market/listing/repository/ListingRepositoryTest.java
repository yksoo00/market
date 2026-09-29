package com.company.market.listing.repository;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
import org.springframework.data.domain.PageRequest;
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
	@DisplayName("첫 페이지는 등록일시 내림차순(동률이면 user_id 내림차순)으로 나온다")
	void firstPageOrdering() {
		listings.saveAndFlush(baseListing("20260929120000"));
		listings.saveAndFlush(baseListing("20260929120001"));

		List<Listing> page = listings.findTop21ByOrderByRegDateDescUserIdDesc();
		assertThat(page).extracting(Listing::getRegDate).containsExactly("20260929120001", "20260929120000");
	}

	@Test
	@DisplayName("같은 등록일시를 가진 매물이 페이지 경계에 걸치면(2/3만 1페이지) 나머지가 다음 페이지에서 소실되지 않는다")
	void tiedRegDateAtPageBoundaryIsNotLost() {
		// 19건: 서로 다른 등록일시(내림차순 상위) — 1페이지를 21건 중 19건까지 채운다
		for (int i = 1; i <= 19; i++) {
			listings.saveAndFlush(baseListing(String.format("202609291201%02d", 19 - i + 1)));
		}
		// 나머지 2자리는 "동률" 그룹(같은 등록일시, 서로 다른 사용자 3명)에서 채워지고 1명은 밀려나야 한다
		String tieDate = "20260929120100";
		UUID userB = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingtieb")
			.passwordHash("$2a$12$hash").nickname("listingtieb").email("listingtieb@example.com")
			.name("김철수").phone("01099998888").phoneHash(hasher.hash("01099998888")).build()).getId();
		UUID userC = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("listingtiec")
			.passwordHash("$2a$12$hash").nickname("listingtiec").email("listingtiec@example.com")
			.name("이영희").phone("01077776666").phoneHash(hasher.hash("01077776666")).build()).getId();
		listings.saveAndFlush(baseListing(tieDate));
		listings.saveAndFlush(Listing.builder().userId(userB).regDate(tieDate).prodId(product.getProdId())
			.tradeType("등록").prodState("new").salesUnitPrice(10000).salesQuantity(1).minOrderQuantity(1).orderUnit(1).build());
		listings.saveAndFlush(Listing.builder().userId(userC).regDate(tieDate).prodId(product.getProdId())
			.tradeType("등록").prodState("new").salesUnitPrice(10000).salesQuantity(1).minOrderQuantity(1).orderUnit(1).build());

		List<Listing> firstPage = listings.findTop21ByOrderByRegDateDescUserIdDesc();
		assertThat(firstPage).hasSize(21);
		List<UUID> tiedInFirstPage = firstPage.stream().filter(l -> l.getRegDate().equals(tieDate)).map(Listing::getUserId).toList();
		assertThat(tiedInFirstPage).hasSize(2);

		Listing last = firstPage.get(20);
		List<Listing> secondPage = listings.findPageBefore(last.getRegDate(), last.getUserId(), PageRequest.of(0, 21));

		// 옛 "reg_date < cursor" 방식이면 tieDate == cursor 라 아무것도 안 나오고, 세 번째 사용자가 영구히 사라진다
		assertThat(secondPage).hasSize(1);
		assertThat(secondPage.get(0).getRegDate()).isEqualTo(tieDate);
		Set<UUID> allTied = Set.of(userId, userB, userC);
		Set<UUID> pageOneTied = new HashSet<>(tiedInFirstPage);
		UUID missing = allTied.stream().filter(id -> !pageOneTied.contains(id)).findFirst().orElseThrow();
		assertThat(secondPage.get(0).getUserId()).isEqualTo(missing);
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
