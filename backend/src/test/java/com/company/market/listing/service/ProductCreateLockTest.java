package com.company.market.listing.service;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Product;
import com.company.market.listing.service.ProductService.ProductDraft;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 같은 상품(네 값)을 동시에 처음 등록할 때. unique(이름, 제조사)를 없앤 뒤(2026-10-27 설계 PR 2) 중복 생성과
 * 채번(개수 기반) 충돌은 생성 잠금(ProductRepository.lockCreation)이 막는다
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ProductCreateLockTest {

	@Autowired
	ProductService service;

	@Autowired
	JdbcTemplate jdbc;

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_master");
	}

	@Test
	@DisplayName("같은 draft 를 두 요청이 동시에 보내도 마스터는 하나 — 둘 다 같은 prodId")
	void parallelSameDraftMakesOneMaster() throws Exception {
		for (int round = 0; round < 10; round++) {
			String name = "동시 상품 " + round;
			ProductDraft draft = new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), name, null, "삼성", "C-1",
					"20260101", null, null, null, null, null, null);
			CountDownLatch start = new CountDownLatch(1);
			List<CompletableFuture<Product>> runs = List.of(
					CompletableFuture.supplyAsync(() -> awaitThen(start, draft)),
					CompletableFuture.supplyAsync(() -> awaitThen(start, draft)));
			start.countDown();
			String first = runs.get(0).get(10, TimeUnit.SECONDS).getProdId();
			String second = runs.get(1).get(10, TimeUnit.SECONDS).getProdId();

			assertThat(second).as("round " + round).isEqualTo(first);
			assertThat(jdbc.queryForObject("select count(*) from trd_prod_master where prod_name = ?", Integer.class, name))
				.as("round " + round).isEqualTo(1);
		}
	}

	private Product awaitThen(CountDownLatch start, ProductDraft draft) {
		try {
			start.await(10, TimeUnit.SECONDS);
		}
		catch (InterruptedException e) {
			Thread.currentThread().interrupt();
		}
		return service.findOrCreate(draft);
	}

}
