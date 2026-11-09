package com.company.market.trade.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService;
import com.company.market.listing.service.ProductService.ProductDraft;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartBulkCommitResult;
import com.company.market.trade.dto.CartBulkCommitResult.Outcome;
import com.company.market.trade.dto.CartBulkRowDto;
import com.company.market.trade.dto.CartBulkRowResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** 엑셀 대량구매 담기 (계획 2026-11-09-bulk-purchase-excel.md 작업 4). 외래키가 없어 판매자·구매자 행 없이 임의 UUID 를 쓴다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class CartBulkCommitTest {

	private static final String CATEGORY = "P01-Q01-R001";

	@Autowired
	CartBulkService service;

	@Autowired
	CartService cart;

	@Autowired
	ProductService products;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final UUID buyer = UUID.randomUUID();

	final UUID seller = UUID.randomUUID();

	Product a;

	Product b;

	Product c;

	@BeforeEach
	void setUp() {
		cleanUp();
		a = products.findOrCreate(draft("구매담기 상품 A", null));
		b = products.findOrCreate(draft("구매담기 상품 B", null));
		// c 는 매물이 없고 대체상품명이 A 의 이름 — A 의 매물을 대체품으로 고르는 줄에 쓴다
		c = products.findOrCreate(draft("구매담기 상품 C", "구매담기 상품 A"));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_cart_info where user_id = ?", buyer);
		jdbc.update("delete from trd_trade_info where user_id = ?", buyer);
		jdbc.update("delete from trd_prod_reg where user_id = ?", seller);
		jdbc.update("delete from trd_prod_master where prod_name like '구매담기 %'");
	}

	private static ProductDraft draft(String name, String alterName) {
		return new ProductDraft(CategoryFragments.parse(CATEGORY), name, null, "Acme", null, null, null, null, alterName, null, null);
	}

	private String listing(String regDate, Product product, int price, int stock) {
		listings.saveAndFlush(Listing.builder().userId(seller).regDate(regDate).prodId(product.getProdId()).tradeType("등록").prodState("신품")
			.salesUnitPrice(price).salesQuantity(stock).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(stock).build());
		return regDate;
	}

	private static CartBulkRowDto row(int rowNo, String name, String quantity, String remarks) {
		return new CartBulkRowDto(rowNo, null, name, "Acme", null, quantity, "2099-12-31", remarks, null, null);
	}

	private int stockOf(String regDate) {
		return jdbc.queryForObject("select stock_quantity from trd_prod_reg where user_id = ? and reg_date = ?", Integer.class, seller, regDate);
	}

	private long cartRows() {
		return jdbc.queryForObject("select count(*) from trd_cart_info where user_id = ?", Long.class, buyer);
	}

	@Test
	@DisplayName("전부 통과하면 줄마다 담기고 재고가 묶이며 단가는 매물 단가, 수량·납품희망일·요청사항은 그대로")
	void addsAllRows() {
		String regA = listing("20261105100000", a, 1500, 10);
		String regB = listing("20261105100001", b, 700, 10);

		CartBulkCommitResult result = service.commit(buyer, List.of(row(2, "구매담기 상품 A", "3", "메모"), row(3, "구매담기 상품 B", "2", null)));

		assertThat(result.results()).extracting(Outcome::ok).containsExactly(true, true);
		assertThat(result.cartCount()).isEqualTo(2);
		assertThat(stockOf(regA)).isEqualTo(7);
		assertThat(stockOf(regB)).isEqualTo(8);
		Map<String, Object> first = jdbc.queryForMap("select order_unit_price, order_quantity, req_deli_date, remarks from trd_cart_info where user_id = ? and prod_date = ?", buyer, regA);
		assertThat(first).containsEntry("order_unit_price", 1500).containsEntry("order_quantity", 3).containsEntry("req_deli_date", "2099-12-31").containsEntry("remarks", "메모");
		assertThat(cartRows()).isEqualTo(2);
	}

	@Test
	@DisplayName("한 줄이 틀려도 나머지는 담긴다(부분 성공) — 틀린 줄은 사유와 함께 실패")
	void partialSuccess() {
		listing("20261105100000", a, 1500, 10);
		listing("20261105100001", b, 700, 10);

		CartBulkCommitResult result = service.commit(buyer, List.of(row(2, "구매담기 상품 A", "0", null), row(3, "구매담기 상품 B", "2", null)));

		assertThat(result.results().get(0).ok()).isFalse();
		assertThat(result.results().get(0).code()).isEqualTo("VALIDATION");
		assertThat(result.results().get(0).message()).isNotBlank();
		assertThat(result.results().get(1).ok()).isTrue();
		assertThat(cartRows()).isEqualTo(1);
	}

	@Test
	@DisplayName("살 수 있는 매물이 없는 줄은 NO_LISTING 으로 실패하고 담기지 않는다")
	void noListingRow() {
		CartBulkCommitResult result = service.commit(buyer, List.of(row(2, "구매담기 상품 A", "3", null)));

		assertThat(result.results().get(0)).extracting(Outcome::ok, Outcome::code).containsExactly(false, "NO_LISTING");
		assertThat(cartRows()).isZero();
	}

	@Test
	@DisplayName("같은 매물을 고른 두 줄: 앞 줄이 묶은 재고를 뒤 줄이 보고 실패한다")
	void sameListingTwoRows() {
		String regA = listing("20261105100000", a, 1500, 3);
		// 줄 2 = A 를 3개(재고를 다 씀), 줄 3 = C 를 요청하되 대체품으로 A 의 같은 매물을 고름 (검사 때는 둘 다 통과)
		CartBulkRowDto second = new CartBulkRowDto(3, null, "구매담기 상품 C", "Acme", null, "2", "2099-12-31", null, seller.toString(), regA);

		CartBulkCommitResult result = service.commit(buyer, List.of(row(2, "구매담기 상품 A", "3", null), second));

		assertThat(result.results().get(0).ok()).isTrue();
		assertThat(result.results().get(1).ok()).isFalse();
		assertThat(result.results().get(1).message()).contains("재고");
		assertThat(stockOf(regA)).isZero();
		assertThat(cartRows()).isEqualTo(1);
	}

	@Test
	@DisplayName("장바구니가 중간에 가득 차면 그 줄부터 CART_FULL, 앞 줄은 담긴다")
	void cartFillsUp() {
		listing("20261105100000", a, 100, 1000);
		listing("20261105100001", b, 100, 1000);
		// 99줄을 먼저 채운다 — 이 마스터의 매물 하나를 99번 담는다
		for (int i = 0; i < 99; i++) {
			cart.add(buyer, new CartAddRequest(List.of(new CartAddRequest.Item(seller, "20261105100000", 1, "2099-12-31", null))));
		}

		CartBulkCommitResult result = service.commit(buyer, List.of(row(2, "구매담기 상품 A", "1", null), row(3, "구매담기 상품 B", "1", null)));

		assertThat(result.results().get(0).ok()).isTrue();
		assertThat(result.results().get(1)).extracting(Outcome::ok, Outcome::code).containsExactly(false, "CART_FULL");
		assertThat(result.cartCount()).isEqualTo(100);
	}

	@Test
	@DisplayName("고른 매물이 재고 부족으로 못 사게 됐으면 그 줄만 실패하고 사유가 보인다")
	void choiceNoLongerBuyable() {
		String regA = listing("20261105100000", a, 1500, 1);
		listing("20261105100001", b, 700, 10);
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매담기 상품 A", "Acme", null, "3", "2099-12-31", null, seller.toString(), regA);

		CartBulkCommitResult result = service.commit(buyer, List.of(pick, row(3, "구매담기 상품 B", "2", null)));

		assertThat(result.results().get(0).ok()).isFalse();
		assertThat(result.results().get(0).message()).contains("재고");
		assertThat(result.results().get(1).ok()).isTrue();
	}

	@Test
	@DisplayName("대체품으로 담으면 요청사항에 원래 요청이 붙는다")
	void substitutedRemarks() {
		String regA = listing("20261105100000", a, 1500, 10);
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매담기 상품 C", "Acme", null, "2", "2099-12-31", "급해요", seller.toString(), regA);

		CartBulkCommitResult result = service.commit(buyer, List.of(pick));

		assertThat(result.results().get(0).ok()).isTrue();
		String remarks = jdbc.queryForObject("select remarks from trd_cart_info where user_id = ?", String.class, buyer);
		assertThat(remarks).isEqualTo("급해요 / 원래 요청: 구매담기 상품 C");
	}

	@Test
	@DisplayName("요청사항 덧붙임은 100자를 넘지 않고, 넘치면 사용자 글의 앞부분이 잘리며 원래 요청 문구는 남는다")
	void remarksStayWithinLimit() {
		CartBulkRowResult substituted = new CartBulkRowResult(2, CartBulkRowResult.Status.AVAILABLE, "p", "구매담기 상품 C", null, List.of(), List.of(), List.of(),
				List.of(), Map.of(), true);
		CartBulkRowResult plain = new CartBulkRowResult(2, CartBulkRowResult.Status.AVAILABLE, "p", "구매담기 상품 C", null, List.of(), List.of(), List.of(),
				List.of(), Map.of(), false);

		String longRemarks = "가".repeat(100);
		String merged = CartBulkService.remarksOf(longRemarks, substituted);

		assertThat(merged).hasSizeLessThanOrEqualTo(100).endsWith(" / 원래 요청: 구매담기 상품 C").startsWith("가");
		assertThat(CartBulkService.remarksOf(null, substituted)).isEqualTo("원래 요청: 구매담기 상품 C");
		assertThat(CartBulkService.remarksOf("  ", substituted)).isEqualTo("원래 요청: 구매담기 상품 C");
		// 대체가 아니면 사용자가 쓴 그대로 (빈 글은 null)
		assertThat(CartBulkService.remarksOf(" 메모 ", plain)).isEqualTo("메모");
		assertThat(CartBulkService.remarksOf(" ", plain)).isNull();
	}

	@Test
	@DisplayName("담기는 인증된 구매자 이름으로만 — 다른 사람의 장바구니에는 줄이 생기지 않는다")
	void onlyOwnCart() {
		listing("20261105100000", a, 1500, 10);

		service.commit(buyer, List.of(row(2, "구매담기 상품 A", "1", null)));

		assertThat(jdbc.queryForObject("select count(*) from trd_cart_info where user_id <> ? and prod_name = '구매담기 상품 A'", Long.class, buyer)).isZero();
	}

}
