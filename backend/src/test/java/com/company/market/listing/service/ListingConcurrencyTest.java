package com.company.market.listing.service;

import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
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

/** 매물 수정(PATCH)과 구매요청 재고 차감이 겹칠 때. 트랜잭션을 스레드마다 따로 열어야 해서 테스트 트랜잭션을 쓰지 않는다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingConcurrencyTest {

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

	@Autowired
	TransactionTemplate tx;

	UUID sellerId;

	@BeforeEach
	void setUp() {
		cleanUp();
		sellerId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("concurrencytester")
			.passwordHash("$2a$12$hash").nickname("concurrencytester").email("concurrencytester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build()).getId();
		products.saveAndFlush(Product.builder().prodId("CONCTEST01").categoryCode("P01-Q01-R001")
			.prodName("노트북 C").prodBrand("삼성").regDate(REG_DATE).build());
		listings.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG_DATE).prodId("CONCTEST01")
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(10).stockQuantity(10)
			.minOrderQuantity(1).orderUnit(1).build());
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	@Test
	@DisplayName("구매요청이 재고를 줄이는 중에 판매자가 단가만 고쳐도 줄어든 재고가 되돌아가지 않는다")
	void updateDoesNotOverwriteReservedStock() throws Exception {
		CountDownLatch reserved = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		// 구매요청 쪽: 재고를 줄이고(행 잠금) 커밋 전에 멈춘다
		CompletableFuture<Void> purchase = CompletableFuture.runAsync(() -> tx.executeWithoutResult(s -> {
			service.reserveStock(sellerId, REG_DATE, 5);
			reserved.countDown();
			await(release);
		}));
		assertThat(reserved.await(10, TimeUnit.SECONDS)).isTrue();
		// 판매자 수정: 단가만. 잠금이 없으면 커밋 전 값(재고 10)을 읽어 두었다가 그대로 다시 쓴다
		CompletableFuture<Void> patch = CompletableFuture.runAsync(() -> service.update(sellerId, REG_DATE, sellerId,
				new ListingUpdateRequest(null, null, 1200, null, null, null, null, null, null, null, null, null, null,
						null, null, null, null, null, null, null, null, null)));
		Thread.sleep(300);
		release.countDown();
		purchase.get(10, TimeUnit.SECONDS);
		patch.get(10, TimeUnit.SECONDS);

		assertThat(jdbc.queryForObject("select stock_quantity from trd_prod_reg where user_id = ?", Integer.class, sellerId))
			.isEqualTo(5);
		assertThat(jdbc.queryForObject("select sales_unit_price from trd_prod_reg where user_id = ?", Integer.class, sellerId))
			.isEqualTo(1200);
	}

	@Test
	@DisplayName("남의 매물 수정 시도는 행 잠금을 기다리지 않고 바로 403 — 남이 매물을 잠가 구매를 막지 못하게")
	void nonOwnerUpdateDoesNotWaitForRowLock() throws Exception {
		CountDownLatch reserved = new CountDownLatch(1);
		CountDownLatch release = new CountDownLatch(1);
		CompletableFuture<Void> purchase = CompletableFuture.runAsync(() -> tx.executeWithoutResult(s -> {
			service.reserveStock(sellerId, REG_DATE, 1);
			reserved.countDown();
			await(release);
		}));
		assertThat(reserved.await(10, TimeUnit.SECONDS)).isTrue();
		UUID stranger = UUID.randomUUID();
		CompletableFuture<Throwable> attempt = CompletableFuture.supplyAsync(() -> {
			try {
				service.update(sellerId, REG_DATE, stranger, new ListingUpdateRequest(null, null, 1, null, null, null, null,
						null, null, null, null, null, null, null, null, null, null, null, null, null, null, null));
				return null;
			}
			catch (RuntimeException e) {
				return e;
			}
		});
		try {
			Throwable result = attempt.get(2, TimeUnit.SECONDS);
			assertThat(result).isInstanceOfSatisfying(ApiException.class,
					e -> assertThat(e.getCode()).isEqualTo(ErrorCode.FORBIDDEN));
		}
		finally {
			release.countDown();
			purchase.get(10, TimeUnit.SECONDS);
			attempt.get(10, TimeUnit.SECONDS);
		}
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
