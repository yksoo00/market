package com.company.market.listing.service;

import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** 거래가 쓰는 매물 재고 예약·복원과 스냅샷 (실제 DB — 조건부 UPDATE 를 확인해야 해서) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ListingStockTest {

	static final String REG_DATE = "20261015100000";

	@Autowired
	ListingService service;

	@Autowired
	ListingRepository listings;

	@Autowired
	ProductRepository products;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JdbcTemplate jdbc;

	UUID sellerId;

	@BeforeEach
	void setUp() {
		User seller = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("stocktester")
			.passwordHash("$2a$12$hash").nickname("stocktester").email("stocktester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build());
		sellerId = seller.getId();
		products.saveAndFlush(Product.builder().prodId("STOCKTEST1").categoryCode("P01-Q01-R001")
			.prodName("노트북 S").prodBrand("삼성").regDate(REG_DATE).build());
		listings.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG_DATE).prodId("STOCKTEST1")
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(5).stockQuantity(5)
			.minOrderQuantity(2).orderUnit(1).deliveryDate("2026-10-30").prodPhoto1("public/listings/photo/a.jpg").build());
	}

	private Integer stock() {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where user_id = ? and reg_date = ?",
				Integer.class, sellerId, REG_DATE);
	}

	private String dtExpire() {
		return jdbc.queryForObject("select dt_expire from trd_prod_reg where user_id = ? and reg_date = ?",
				String.class, sellerId, REG_DATE);
	}

	@Test
	@DisplayName("스냅샷은 매물 값을 그대로 담는다")
	void snapshotCopiesListing() {
		ListingTradeSnapshot s = service.snapshotForTrade(sellerId, REG_DATE);

		assertThat(s.prodId()).isEqualTo("STOCKTEST1");
		assertThat(s.prodName()).isEqualTo("노트북 S");
		assertThat(s.salesUnitPrice()).isEqualTo(1000);
		assertThat(s.stockQuantity()).isEqualTo(5);
		assertThat(s.minOrderQuantity()).isEqualTo(2);
		assertThat(s.provDate()).isEqualTo("2026-10-30");
		assertThat(s.completed()).isFalse();
		assertThat(s.photo()).isEqualTo("public/listings/photo/a.jpg");
	}

	@Test
	@DisplayName("없는 매물의 스냅샷은 LISTING_NOT_FOUND")
	void snapshotOfMissingListing() {
		assertThatThrownBy(() -> service.snapshotForTrade(sellerId, "20200101000000"))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.LISTING_NOT_FOUND));
	}

	@Test
	@DisplayName("재고를 정확히 0으로 줄이면 dt_expire 가 들어가고, 복원하면 지워진다")
	void reserveToZeroThenRelease() {
		service.reserveStock(sellerId, REG_DATE, 5);
		assertThat(stock()).isZero();
		assertThat(dtExpire()).isNotNull();

		service.releaseStock(sellerId, REG_DATE, 5);
		assertThat(stock()).isEqualTo(5);
		assertThat(dtExpire()).isNull();
	}

	@Test
	@DisplayName("일부만 줄이면 dt_expire 는 비어 있다")
	void partialReserveKeepsAvailable() {
		service.reserveStock(sellerId, REG_DATE, 3);

		assertThat(stock()).isEqualTo(2);
		assertThat(dtExpire()).isNull();
	}

	@Test
	@DisplayName("재고보다 많이 줄이면 TRADE_OUT_OF_STOCK, 재고는 그대로")
	void overReserveFails() {
		assertThatThrownBy(() -> service.reserveStock(sellerId, REG_DATE, 6))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.TRADE_OUT_OF_STOCK));
		assertThat(stock()).isEqualTo(5);
	}

	@Test
	@DisplayName("거래완료(dt_expire)된 매물은 재고가 남아 있어도 예약할 수 없다")
	void completedListingCannotReserve() {
		jdbc.update("update trd_prod_reg set dt_expire = '20261015120000' where user_id = ?", sellerId);

		assertThatThrownBy(() -> service.reserveStock(sellerId, REG_DATE, 1))
			.isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.getCode()).isEqualTo(ErrorCode.TRADE_OUT_OF_STOCK));
	}

}
