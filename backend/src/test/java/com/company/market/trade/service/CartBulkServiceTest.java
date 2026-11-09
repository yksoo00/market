package com.company.market.trade.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService;
import com.company.market.listing.service.ProductService.ProductDraft;
import com.company.market.trade.dto.CartBulkRowDto;
import com.company.market.trade.dto.CartBulkRowResult;
import com.company.market.trade.dto.CartBulkRowResult.ListingOption;
import com.company.market.trade.dto.CartBulkRowResult.Status;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** 엑셀 대량구매 줄 검사·매물 대조 (계획 2026-11-09-bulk-purchase-excel.md 작업 3). 외래키가 없어 판매자·구매자 행 없이 임의 UUID 를 쓴다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class CartBulkServiceTest {

	private static final String CATEGORY = "P01-Q01-R001";

	@Autowired
	CartBulkService service;

	@Autowired
	ProductService products;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final UUID buyer = UUID.randomUUID();

	final UUID sellerA = UUID.randomUUID();

	final UUID sellerB = UUID.randomUUID();

	final UUID sellerC = UUID.randomUUID();

	Product main;

	Product alt;

	@BeforeEach
	void setUp() {
		cleanUp();
		alt = products.findOrCreate(draft("구매검사 대체품 X", "Acme", null));
		main = products.findOrCreate(draft("구매검사 원품 A", "Acme", "구매검사 대체품 X"));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (?, ?, ?, ?)", buyer, sellerA, sellerB, sellerC);
		jdbc.update("delete from trd_prod_master where prod_name like '구매검사 %'");
	}

	private static ProductDraft draft(String name, String brand, String alterName) {
		return new ProductDraft(CategoryFragments.parse(CATEGORY), name, null, brand, null, null, null, null, alterName, null, null);
	}

	private void listing(UUID seller, String regDate, Product product, int price, int stock, int minOrder, int unit, boolean completed) {
		listings.saveAndFlush(Listing.builder().userId(seller).regDate(regDate).prodId(product.getProdId()).tradeType("등록").prodState("신품")
			.salesUnitPrice(price).salesQuantity(stock).minOrderQuantity(minOrder).orderUnit(unit).deliveryDate("2099-12-31")
			.stockQuantity(stock).build());
		if (completed) {
			jdbc.update("update trd_prod_reg set dt_expire = '20261101000000' where user_id = ? and reg_date = ?", seller, regDate);
		}
	}

	private static CartBulkRowDto row(int rowNo, String name, String quantity) {
		return new CartBulkRowDto(rowNo, null, name, "Acme", null, quantity, "2099-12-31", "메모", null, null);
	}

	private CartBulkRowResult only(CartBulkRowDto row) {
		return service.check(buyer, List.of(row)).results().get(0);
	}

	private static ListingOption option(CartBulkRowResult r, UUID seller) {
		return r.options().stream().filter(o -> o.sellerId().equals(seller.toString())).findFirst().orElseThrow();
	}

	@Test
	@DisplayName("마스터의 매물이 후보로 나오고, 수량을 채울 수 있는 최저가가 기본으로 골라진다")
	void picksCheapestAvailable() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);
		listing(sellerB, "20261105100001", main, 900, 5, 1, 1, false);
		listing(sellerC, "20261105100002", main, 800, 1, 1, 1, false); // 가장 싸지만 재고가 모자란다

		CartBulkRowResult r = only(row(2, "구매검사 원품 A", "3"));

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.options()).hasSize(3);
		assertThat(r.chosen().sellerId()).isEqualTo(sellerB.toString());
		assertThat(r.chosen().unitPrice()).isEqualTo(900);
		assertThat(option(r, sellerC).reason()).contains("재고");
		assertThat(option(r, sellerA).reason()).isNull();
		assertThat(r.substituted()).isFalse();
		assertThat(r.fields()).isEmpty();
	}

	@Test
	@DisplayName("값이 같으면 재고가 많은 것, 그래도 같으면 등록일시가 빠른 것")
	void tieBreak() {
		listing(sellerA, "20261105100000", main, 900, 5, 1, 1, false);
		listing(sellerB, "20261105100001", main, 900, 8, 1, 1, false);
		assertThat(only(row(2, "구매검사 원품 A", "3")).chosen().sellerId()).isEqualTo(sellerB.toString());

		cleanUp();
		setUp();
		listing(sellerA, "20261105100000", main, 900, 5, 1, 1, false);
		listing(sellerB, "20261105100001", main, 900, 5, 1, 1, false);
		assertThat(only(row(2, "구매검사 원품 A", "3")).chosen().sellerId()).isEqualTo(sellerA.toString());
	}

	@Test
	@DisplayName("못 사는 매물은 빼지 않고 사유를 남긴다: 최소주문량·주문단위·내 매물·거래완료")
	void reasons() {
		listing(sellerA, "20261105100000", main, 1000, 50, 5, 1, false); // 최소주문량 5
		listing(sellerB, "20261105100001", main, 1000, 50, 1, 2, false); // 주문단위 2
		listing(buyer, "20261105100002", main, 1000, 50, 1, 1, false); // 내 매물
		listing(sellerC, "20261105100003", main, 1000, 50, 1, 1, true); // 거래완료

		CartBulkRowResult r = only(row(2, "구매검사 원품 A", "3"));

		assertThat(r.options()).hasSize(4);
		assertThat(option(r, sellerA).reason()).contains("최소주문량");
		assertThat(option(r, sellerB).reason()).contains("주문단위");
		assertThat(option(r, buyer).reason()).contains("내 매물");
		assertThat(option(r, sellerC).reason()).contains("끝난");
		assertThat(r.chosen()).isNull();
		assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
	}

	@Test
	@DisplayName("매물이 하나도 없는 마스터는 UNAVAILABLE")
	void noListings() {
		CartBulkRowResult r = only(row(2, "구매검사 원품 A", "3"));

		assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
		assertThat(r.options()).isEmpty();
		assertThat(r.prodId()).isEqualTo(main.getProdId());
		assertThat(r.matchedName()).isEqualTo("구매검사 원품 A");
	}

	@Test
	@DisplayName("이름·제조사가 대소문자·공백만 달라도 마스터를 찾는다")
	void looseMatch() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);

		CartBulkRowResult r = only(new CartBulkRowDto(2, null, "  구매검사   원품 a ", "ACME", null, "3", "2099-12-31", null, null, null));

		assertThat(r.prodId()).isEqualTo(main.getProdId());
		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
	}

	@Test
	@DisplayName("마스터가 없으면 FAILED + 이름이 겹치는 상품 후보")
	void masterMissing() {
		CartBulkRowResult r = only(new CartBulkRowDto(2, null, "구매검사 원품", "Acme", null, "3", "2099-12-31", null, null, null));

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.fields()).containsKey("prodName");
		assertThat(r.candidates()).extracting(c -> c.prodId()).contains(main.getProdId());
		assertThat(r.options()).isEmpty();
	}

	@Test
	@DisplayName("상품ID 를 직접 주면 그 마스터, 없는 상품ID 는 prodId 오류")
	void byProdId() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);

		CartBulkRowResult ok = only(new CartBulkRowDto(2, main.getProdId(), null, null, null, "3", "2099-12-31", null, null, null));
		CartBulkRowResult missing = only(new CartBulkRowDto(3, "KP-0000-000000", null, null, null, "3", "2099-12-31", null, null, null));

		assertThat(ok.status()).isEqualTo(Status.AVAILABLE);
		assertThat(missing.status()).isEqualTo(Status.FAILED);
		assertThat(missing.fields()).containsKey("prodId");
	}

	@Test
	@DisplayName("매물이 없고 대체상품명이 있으면 대체 마스터의 매물을 제안하지만 자동으로 고르지는 않는다")
	void alternativesAreOnlyProposed() {
		listing(sellerA, "20261105100000", alt, 700, 5, 1, 1, false);

		CartBulkRowResult r = only(row(2, "구매검사 원품 A", "3"));

		assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
		assertThat(r.chosen()).isNull();
		assertThat(r.alternatives()).hasSize(1);
		assertThat(r.alternatives().get(0).prodId()).isEqualTo(alt.getProdId());
		assertThat(r.alternatives().get(0).options()).extracting(ListingOption::sellerId).containsExactly(sellerA.toString());
		assertThat(r.substituted()).isFalse();
	}

	@Test
	@DisplayName("살 수 있는 매물이 있으면 대체품은 계산하지 않는다 — 다만 사용자가 대체 매물을 골라 보냈으면 검증하려고 계산한다")
	void alternativesOnlyWhenNeeded() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);
		listing(sellerB, "20261105100001", alt, 700, 5, 1, 1, false);

		assertThat(only(row(2, "구매검사 원품 A", "3")).alternatives()).isEmpty();

		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", null, sellerB.toString(), "20261105100001");
		CartBulkRowResult r = only(pick);
		assertThat(r.chosen().sellerId()).isEqualTo(sellerB.toString());
		assertThat(r.substituted()).isTrue();
	}

	@Test
	@DisplayName("대체 매물을 고르면 chosen 이 되고 substituted — 서버가 판단한다")
	void choosingAlternative() {
		listing(sellerA, "20261105100000", alt, 700, 5, 1, 1, false);
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", null, sellerA.toString(), "20261105100000");

		CartBulkRowResult r = only(pick);

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.chosen().sellerId()).isEqualTo(sellerA.toString());
		assertThat(r.substituted()).isTrue();
	}

	@Test
	@DisplayName("고른 매물이 후보에 없으면 다른 매물로 바꾸지 않고 listing 오류")
	void unknownChoice() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", null, sellerB.toString(), "20261105100999");

		CartBulkRowResult r = only(pick);

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.fields()).containsKey("listing");
		assertThat(r.chosen()).isNull();
	}

	@Test
	@DisplayName("고른 매물이 못 사게 바뀌었으면 그 사유가 listing 오류")
	void choiceNoLongerBuyable() {
		listing(sellerA, "20261105100000", main, 1000, 2, 1, 1, false); // 수량 3 에 재고 2
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", null, sellerA.toString(), "20261105100000");

		CartBulkRowResult r = only(pick);

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.fields().get("listing")).contains("재고");
	}

	@Test
	@DisplayName("고른 매물이 살 수 있으면 기본값보다 우선한다")
	void choiceOverridesDefault() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);
		listing(sellerB, "20261105100001", main, 900, 5, 1, 1, false);
		CartBulkRowDto pick = new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", null, sellerA.toString(), "20261105100000");

		assertThat(only(pick).chosen().sellerId()).isEqualTo(sellerA.toString());
	}

	@Test
	@DisplayName("수량: 비움·글자·0·10만 초과는 오류, 쉼표 숫자는 통과")
	void quantityRules() {
		listing(sellerA, "20261105100000", main, 1000, 5000, 1, 1, false);

		assertThat(only(row(2, "구매검사 원품 A", null)).fields()).containsKey("orderQuantity");
		assertThat(only(row(2, "구매검사 원품 A", "세개")).fields()).containsKey("orderQuantity");
		assertThat(only(row(2, "구매검사 원품 A", "0")).fields()).containsKey("orderQuantity");
		assertThat(only(row(2, "구매검사 원품 A", "100001")).fields()).containsKey("orderQuantity");
		assertThat(only(row(2, "구매검사 원품 A", "99999999999")).fields().get("orderQuantity")).doesNotContain("숫자(정수)");
		assertThat(only(row(2, "구매검사 원품 A", "1,000")).fields()).isEmpty();
	}

	@Test
	@DisplayName("납품희망일: 비움·형식·지난 날짜는 오류")
	void deliveryDateRules() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);

		for (String bad : new String[] { null, "2099/12/31", "2020-01-01" }) {
			CartBulkRowResult r = only(new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", bad, null, null, null));
			assertThat(r.fields()).containsKey("reqDeliDate");
		}
	}

	@Test
	@DisplayName("요청사항이 100자를 넘으면 오류")
	void remarksLength() {
		CartBulkRowResult r = only(new CartBulkRowDto(2, null, "구매검사 원품 A", "Acme", null, "3", "2099-12-31", "가".repeat(101), null, null));

		assertThat(r.fields()).containsKey("remarks");
	}

	@Test
	@DisplayName("같은 상품이 한 파일에 두 줄이면 둘째 줄부터 실패")
	void duplicateInFile() {
		listing(sellerA, "20261105100000", main, 1000, 50, 1, 1, false);

		List<CartBulkRowResult> r = service.check(buyer, List.of(row(2, "구매검사 원품 A", "3"), row(3, "구매검사 원품 a", "4"))).results();

		assertThat(r.get(0).status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.get(1).status()).isEqualTo(Status.FAILED);
		assertThat(r.get(1).fields()).containsKey("prodName");
	}

	@Test
	@DisplayName("줄이 0개·101개이거나 줄 번호가 겹치면 거절")
	void rowCountAndRowNo() {
		assertThatThrownBy(() -> service.check(buyer, List.of())).isInstanceOf(ValidationException.class);
		List<CartBulkRowDto> many = IntStream.range(0, 101).mapToObj(i -> row(i + 2, "구매검사 원품 A", "3")).toList();
		assertThatThrownBy(() -> service.check(buyer, many)).isInstanceOf(ValidationException.class);
		assertThatThrownBy(() -> service.check(buyer, List.of(row(2, "구매검사 원품 A", "3"), row(2, "구매검사 대체품 X", "3"))))
			.isInstanceOf(ValidationException.class);
	}

	private Product withClassNo(String name, String brand, String classNo) {
		return products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), name, null, brand, classNo, null, null, null, null, null, null));
	}

	@Test
	@DisplayName("분류번호를 비워도 이름+제조사가 하나로 정해지면 자동으로 찾는다 (분류번호가 있는 마스터도)")
	void blankClassNoMatchesUniqueMaster() {
		Product classed = withClassNo("구매검사 분류품 C", "Acme", "PD-0001");
		listing(sellerA, "20261105100000", classed, 1000, 5, 1, 1, false);

		CartBulkRowResult r = only(row(2, "구매검사 분류품 C", "3"));

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.prodId()).isEqualTo(classed.getProdId());
	}

	@Test
	@DisplayName("이름+제조사가 같은 마스터가 여럿이면 자동으로 고르지 않고 후보로 묻는다, 분류번호를 적으면 하나로 좁혀진다")
	void severalMastersNeedChoice() {
		Product a = withClassNo("구매검사 여럿 D", "Acme", "PD-0001");
		Product b = withClassNo("구매검사 여럿 D", "Acme", "PD-0002");
		listing(sellerA, "20261105100000", a, 1000, 5, 1, 1, false);
		listing(sellerB, "20261105100001", b, 900, 5, 1, 1, false);

		CartBulkRowResult ambiguous = only(row(2, "구매검사 여럿 D", "3"));

		assertThat(ambiguous.status()).isEqualTo(Status.FAILED);
		assertThat(ambiguous.prodId()).isNull();
		assertThat(ambiguous.fields().get("prodName")).contains("여럿");
		assertThat(ambiguous.candidates()).extracting(c -> c.prodId()).containsExactlyInAnyOrder(a.getProdId(), b.getProdId());

		CartBulkRowResult narrowed = only(new CartBulkRowDto(3, null, "구매검사 여럿 D", "Acme", "pd-0002", "3", "2099-12-31", null, null, null));
		assertThat(narrowed.status()).isEqualTo(Status.AVAILABLE);
		assertThat(narrowed.prodId()).isEqualTo(b.getProdId());
	}

	@Test
	@DisplayName("제조사를 비우면 이름만으로 찾는다 — 하나면 자동, 여럿이면 후보")
	void blankBrand() {
		Product solo = products.findOrCreate(draft("구매검사 단독 E", "Zeta", null));
		listing(sellerA, "20261105100000", solo, 1000, 5, 1, 1, false);
		Product dupA = products.findOrCreate(draft("구매검사 이름겹침 F", "Acme", null));
		products.findOrCreate(draft("구매검사 이름겹침 F", "Zeta", null));

		CartBulkRowResult one = only(new CartBulkRowDto(2, null, "구매검사 단독 E", null, null, "3", "2099-12-31", null, null, null));
		CartBulkRowResult many = only(new CartBulkRowDto(3, null, "구매검사 이름겹침 F", " ", null, "3", "2099-12-31", null, null, null));

		assertThat(one.status()).isEqualTo(Status.AVAILABLE);
		assertThat(one.prodId()).isEqualTo(solo.getProdId());
		assertThat(many.status()).isEqualTo(Status.FAILED);
		assertThat(many.candidates()).hasSize(2).extracting(c -> c.prodId()).contains(dupA.getProdId());
	}

	@Test
	@DisplayName("제조사를 적었는데 이름만 같고 제조사가 다르면 자동으로 붙이지 않고, 후보에는 보인다")
	void differentBrandIsNotAutoMatched() {
		Product other = products.findOrCreate(draft("구매검사 제조사다름 G", "Zeta", null));

		CartBulkRowResult r = only(new CartBulkRowDto(2, null, "구매검사 제조사다름 G", "Acme", null, "3", "2099-12-31", null, null, null));

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.prodId()).isNull();
		assertThat(r.candidates()).extracting(c -> c.prodId()).contains(other.getProdId());
	}

	@Test
	@DisplayName("대소문자·공백·하이픈 표기 차이는 같은 이름으로 본다 (R740 / R-740 / r 740)")
	void normalizedNames() {
		Product model = products.findOrCreate(draft("구매검사 R-740 H", "Acme", null));
		listing(sellerA, "20261105100000", model, 1000, 5, 1, 1, false);

		for (String written : List.of("구매검사 R740 H", "구매검사 r 740 h", "구매검사R-740H")) {
			CartBulkRowResult r = only(row(2, written, "3"));
			assertThat(r.prodId()).as(written).isEqualTo(model.getProdId());
		}
	}

	@Test
	@DisplayName("이름이 공백·하이픈뿐이면 아무것도 찾지 않는다")
	void symbolOnlyName() {
		CartBulkRowResult r = only(row(2, " - - ", "3"));

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.prodId()).isNull();
	}

	@Test
	@DisplayName("지금 장바구니 줄 수와 한도를 함께 돌려준다")
	void cartCount() {
		listing(sellerA, "20261105100000", main, 1000, 5, 1, 1, false);

		var result = service.check(buyer, List.of(row(2, "구매검사 원품 A", "3")));

		assertThat(result.cartCount()).isZero();
		assertThat(result.cartMax()).isEqualTo(100);
	}

}
