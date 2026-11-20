package com.company.market.trade.service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.QuoteCreateRequest;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 견적·장바구니 담기와 매물 삭제가 겹칠 때. FK 가 있을 땐 거래 행 INSERT 가 매물 행을 KEY SHARE 로 잠가 삭제와 차례가 정해졌다.
 * FK 를 없앤 뒤(2026-10-27)엔 담기가 매물을 공유 잠금으로 읽어야 지워진 매물을 가리키는 거래 행(고아)이 생기지 않는다
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class TradeListingLockTest {

	static final String REG_DATE = "20261027100000";

	@Autowired
	TradeService trades;

	@Autowired
	CartService carts;

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

	@Autowired
	TransactionTemplate tx;

	String sellerId;

	String buyerId;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = user("locktestseller", "01011110001");
		buyerId = user("locktestbuyer", "01011110002");
		products.saveAndFlush(Product.builder().prodId("LOCKTEST01").majorCategory("P01").middleCategory("Q01").minorCategory("R001")
			.prodName("노트북 L").prodBrand("삼성").regDate(REG_DATE).build());
		listings.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG_DATE).prodId("LOCKTEST01")
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(10).stockQuantity(10)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	private String user(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).email(loginId + "@example.com").name("홍길동").phone(phone).phoneHash(hasher.hash(phone))
			.build()).getId();
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master where prod_id = 'LOCKTEST01'");
		jdbc.update("delete from trd_user_info where user_id like 'locktest%'");
	}

	@Test
	@DisplayName("판매자가 매물을 지우는 중에 온 견적 요청은 삭제를 기다렸다가 LISTING_NOT_FOUND — 고아 견적 행이 남지 않는다")
	void quoteWaitsForListingDelete() throws Exception {
		Throwable result = raceWithDelete(() -> trades.requestQuotes(buyerId, new QuoteCreateRequest(List.of(
				new QuoteCreateRequest.Item(sellerId, REG_DATE, 900, 1, "2099-12-31", null)))));

		assertThat(result).isInstanceOfSatisfying(ApiException.class,
				e -> assertThat(e.getCode()).isEqualTo(ErrorCode.LISTING_NOT_FOUND));
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isZero();
	}

	@Test
	@DisplayName("판매자가 매물을 지우는 중에 온 장바구니 담기는 삭제를 기다렸다가 LISTING_NOT_FOUND — 고아 장바구니 행이 남지 않는다")
	void cartWaitsForListingDelete() throws Exception {
		Throwable result = raceWithDelete(() -> carts.add(buyerId,
				new CartAddRequest(List.of(new CartAddRequest.Item(sellerId, REG_DATE, 1, "2099-12-31", null)))));

		assertThat(result).isInstanceOfSatisfying(ApiException.class,
				e -> assertThat(e.getCode()).isEqualTo(ErrorCode.LISTING_NOT_FOUND));
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isZero();
	}

	/** 판매자 삭제(매물 행 잠금 → 잠시 멈춤 → 삭제·커밋) 도중에 action 을 보내고, action 이 던진 예외(없으면 null)를 돌려준다 */
	private Throwable raceWithDelete(Supplier<?> action) throws Exception {
		CountDownLatch locked = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		CompletableFuture<Void> delete = CompletableFuture.runAsync(() -> tx.executeWithoutResult(s -> {
			listings.findForUpdate(sellerId, REG_DATE).orElseThrow();
			locked.countDown();
			await(release);
			jdbc.update("delete from trd_prod_reg where user_id = ?", sellerId);
		}));
		assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
		CompletableFuture<Throwable> attempt = CompletableFuture.supplyAsync(() -> {
			try {
				action.get();
				return null;
			}
			catch (Throwable e) {
				return e;
			}
		});
		Thread.sleep(300);
		release.countDown();
		delete.get(10, TimeUnit.SECONDS);
		return attempt.get(10, TimeUnit.SECONDS);
	}

	private static void await(CountDownLatch latch) {
		try {
			latch.await(10, TimeUnit.SECONDS);
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
	}

}
