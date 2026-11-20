package com.company.market.trade.service;

import com.company.market.TestUids;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import com.company.market.TestInfraConfiguration;
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

/** 대량구매 줄 조건(상태·단가·보증·제공가능일·증빙)과 정렬 기준 (계획 2026-11-09-bulk-purchase-conditions.md 작업 3) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class CartBulkConditionsServiceTest {

	private static final String NAME = "구매조건 상품 A";

	@Autowired
	CartBulkService service;

	@Autowired
	ProductService products;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final String buyer = TestUids.random();

	final String sellerA = TestUids.random();

	final String sellerB = TestUids.random();

	final String sellerC = TestUids.random();

	Product master;

	@BeforeEach
	void setUp() {
		cleanUp();
		master = products.findOrCreate(
				new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), NAME, null, "Acme", null, null, null, null, null, null, null));
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (?, ?, ?, ?)", buyer, sellerA, sellerB, sellerC);
		jdbc.update("delete from trd_prod_master where prod_name like '구매조건 %'");
	}

	/** 기본 매물: 신품, 재고 50, 제공가능일 2099-12-31, 보증·증빙 없음 */
	private Listing.ListingBuilder base(String seller, String regDate, int price) {
		return Listing.builder().userId(seller).regDate(regDate).prodId(master.getProdId()).tradeType("등록").prodState("신품").salesUnitPrice(price)
			.salesQuantity(50).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(50);
	}

	private void save(Listing.ListingBuilder b) {
		listings.saveAndFlush(b.build());
	}

	private static CartBulkRowDto row(String minState, String maxPrice, String months, String dataSheet, String photo, String coverage,
			String testReport, String certificate) {
		return new CartBulkRowDto(2, null, NAME, "Acme", null, "3", "2099-12-31", null, null, null, minState, maxPrice, months, dataSheet, photo,
				coverage, testReport, certificate);
	}

	private static CartBulkRowDto plain() {
		return row(null, null, null, null, null, null, null, null);
	}

	private CartBulkRowResult only(CartBulkRowDto row) {
		return service.check(buyer, List.of(row)).results().get(0);
	}

	/** 카드 순서(정렬 기준)에서 조건에 맞는(살 수 있고 다른 점 없는) 첫 매물 = 화면이 "추천"으로 표시하는 매물 */
	private static String recommended(CartBulkRowResult r) {
		return r.options().stream().filter(o -> o.reason() == null && o.mismatches().isEmpty()).findFirst().orElseThrow().sellerId();
	}

	private static ListingOption option(CartBulkRowResult r, String seller) {
		return r.options().stream().filter(o -> o.sellerId().equals(seller.toString())).findFirst().orElseThrow();
	}

	@Test
	@DisplayName("최소 상태: 그 단계 이상만 기본으로 뽑히고, 더 낮은 매물은 다른 점과 함께 남는다(더 싸도 안 뽑힘)")
	void minState() {
		save(base(sellerA, "20261105100000", 1000).prodState("신품대비 80~89%"));
		save(base(sellerB, "20261105100001", 900).prodState("신품대비 70~79%"));

		CartBulkRowResult r = only(row("신품대비 80~89%", null, null, null, null, null, null, null));

		assertThat(r.chosen().sellerId()).isEqualTo(sellerA.toString());
		assertThat(option(r, sellerB).reason()).isNull();
		assertThat(option(r, sellerB).mismatches()).anySatisfy(m -> assertThat(m).contains("상태").contains("낮아요"));
		assertThat(option(r, sellerA).mismatches()).isEmpty();
		// "50% 미만"이 최소면 모든 상태가 통과, "신품"이면 신품만
		CartBulkRowResult anyState = only(row("신품대비 50% 미만", null, null, null, null, null, null, null));
		assertThat(anyState.status()).isEqualTo(Status.CHOOSE);
		assertThat(recommended(anyState)).isEqualTo(sellerB.toString());
		assertThat(only(row("신품", null, null, null, null, null, null, null)).status()).isEqualTo(Status.CHOOSE);
	}

	@Test
	@DisplayName("단가 상한: 같으면 통과, 넘으면 탈락")
	void maxPrice() {
		save(base(sellerA, "20261105100000", 1000));
		save(base(sellerB, "20261105100001", 1001));

		CartBulkRowResult r = only(row(null, "1,000", null, null, null, null, null, null));

		assertThat(r.chosen().sellerId()).isEqualTo(sellerA.toString());
		assertThat(option(r, sellerB).mismatches()).anySatisfy(m -> assertThat(m).contains("상한"));
	}

	@Test
	@DisplayName("최소 보증: 12개월=360일 이상만 통과, 보증 없는(null) 매물은 탈락, 조건이 없으면 상관없음")
	void minWarranty() {
		save(base(sellerA, "20261105100000", 1000).warrantyPeriod(360));
		save(base(sellerB, "20261105100001", 900).warrantyPeriod(180));
		save(base(sellerC, "20261105100002", 800));

		CartBulkRowResult twelve = only(row(null, null, "12", null, null, null, null, null));
		assertThat(twelve.chosen().sellerId()).isEqualTo(sellerA.toString());
		assertThat(option(twelve, sellerB).mismatches()).anySatisfy(m -> assertThat(m).contains("보증"));
		assertThat(option(twelve, sellerC).mismatches()).anySatisfy(m -> assertThat(m).contains("보증"));

		CartBulkRowResult six = only(row(null, null, "6개월", null, null, null, null, null));
		assertThat(recommended(six)).isEqualTo(sellerB.toString());
		assertThat(option(six, sellerA).mismatches()).isEmpty();
		assertThat(option(six, sellerC).mismatches()).isNotEmpty();

		assertThat(recommended(only(plain()))).isEqualTo(sellerC.toString());
	}

	@Test
	@DisplayName("제공가능일: 납품희망일과 같은 날은 통과, 하루 늦으면 탈락, 날짜가 아닌 레거시 글은 비교할 수 없어 통과 (조건 칸 없이도 늘 걸린다)")
	void provideDate() {
		// prov_date 는 not null 이라 "비어 있음"은 없다 — 날짜가 아닌 글만 비교 불가로 통과
		save(base(sellerA, "20261105100000", 1000).deliveryDate("2099-12-31"));
		save(base(sellerB, "20261105100001", 900).deliveryDate("2100-01-01"));
		save(base(sellerC, "20261105100002", 950).deliveryDate("협의"));

		CartBulkRowResult r = only(plain());

		assertThat(option(r, sellerA).mismatches()).isEmpty();
		assertThat(option(r, sellerB).mismatches()).anySatisfy(m -> assertThat(m).contains("제공가능일").contains("늦어요"));
		assertThat(option(r, sellerC).mismatches()).isEmpty();
		assertThat(recommended(r)).isEqualTo(sellerC.toString());
	}

	@Test
	@DisplayName("증빙 Y 칸: 그 증빙이 있는 매물만 통과 (데이터시트·사진·불량지원·테스트리포트·정품인증서)")
	void evidence() {
		save(base(sellerA, "20261105100000", 1000).prodDataSheet("private/ds.pdf").prodPhoto1("public/p.png").warrantyCoverage("대체")
			.testReport("private/t.pdf").certificateOfAuthen("private/c.pdf"));
		save(base(sellerB, "20261105100001", 900));

		for (CartBulkRowDto needing : List.of(row(null, null, null, "Y", null, null, null, null), row(null, null, null, null, "y", null, null, null),
				row(null, null, null, null, null, "Y", null, null), row(null, null, null, null, null, null, "Y", null),
				row(null, null, null, null, null, null, null, "Y"))) {
			CartBulkRowResult r = only(needing);
			assertThat(r.chosen().sellerId()).isEqualTo(sellerA.toString());
			assertThat(option(r, sellerB).mismatches()).anySatisfy(m -> assertThat(m).contains("없어요"));
		}
		// 증빙을 모두 요구해도 갖춘 매물은 통과
		assertThat(only(row(null, null, null, "Y", "Y", "Y", "Y", "Y")).chosen().sellerId()).isEqualTo(sellerA.toString());
	}

	@Test
	@DisplayName("조건과 맞는 매물이 하나도 없으면 CHOOSE(미리 고르지 않음) + 다른 점이 남고, 조건을 지우면 맞는 매물이 하나라 다시 AVAILABLE")
	void allExcludedThenRelaxed() {
		save(base(sellerA, "20261105100000", 1000));

		CartBulkRowResult blocked = only(row(null, "500", null, null, null, null, null, null));
		assertThat(blocked.status()).isEqualTo(Status.CHOOSE);
		assertThat(blocked.chosen()).isNull();
		assertThat(option(blocked, sellerA).reason()).isNull();
		assertThat(option(blocked, sellerA).mismatches()).anySatisfy(m -> assertThat(m).contains("상한"));

		assertThat(only(plain()).status()).isEqualTo(Status.AVAILABLE);
	}

	@Test
	@DisplayName("조건과 다른 매물도 사용자가 알고 고르면 허용한다 — chosen 에 다른 점이 그대로 실린다. 하드 막힘(재고 부족)이면 listing 오류")
	void chosenListingWithMismatches() {
		save(base(sellerA, "20261105100000", 1000));
		save(base(sellerB, "20261105100001", 2000));
		CartBulkRowDto picked = new CartBulkRowDto(2, null, NAME, "Acme", null, "3", "2099-12-31", null, sellerB.toString(), "20261105100001", null, "1500",
				null, null, null, null, null, null);

		CartBulkRowResult r = only(picked);

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.fields()).isEmpty();
		assertThat(r.chosen().sellerId()).isEqualTo(sellerB.toString());
		assertThat(r.chosen().mismatches()).anySatisfy(m -> assertThat(m).contains("상한"));

		// 재고(50)보다 많이 사려는 건 하드 막힘 — 다른 매물로 바꾸지 않고 listing 오류
		CartBulkRowDto tooMany = new CartBulkRowDto(2, null, NAME, "Acme", null, "51", "2099-12-31", null, sellerB.toString(), "20261105100001", null, "1500", null, null,
				null, null, null, null);
		CartBulkRowResult blocked = only(tooMany);
		assertThat(blocked.status()).isEqualTo(Status.FAILED);
		assertThat(blocked.fields().get("listing")).contains("재고");
		assertThat(blocked.chosen()).isNull();
	}

	@Test
	@DisplayName("카드 순서는 고정: 단가 낮은 순 → 보증 긴 순 → 상태 좋은 순. 맞는 매물이 여럿이면 미리 고르지 않고 맨 위가 추천")
	void cardOrder() {
		save(base(sellerA, "20261105100000", 1000).prodState("신품대비 80~89%").warrantyPeriod(360));
		save(base(sellerB, "20261105100001", 900).prodState("신품대비 70~79%").warrantyPeriod(90));
		save(base(sellerC, "20261105100002", 1200).prodState("신품").warrantyPeriod(180));

		CartBulkRowResult r = only(plain());

		assertThat(r.status()).isEqualTo(Status.CHOOSE);
		assertThat(r.chosen()).isNull();
		assertThat(r.options()).extracting(ListingOption::sellerId).containsExactly(sellerB.toString(), sellerA.toString(), sellerC.toString());
		assertThat(recommended(r)).isEqualTo(sellerB.toString());
	}

	@Test
	@DisplayName("같은 단가면 보증이 긴 쪽, 그다음 상태가 좋은 쪽이 먼저")
	void priceTieBreaks() {
		save(base(sellerA, "20261105100000", 1000).warrantyPeriod(90).prodState("신품"));
		save(base(sellerB, "20261105100001", 1000).warrantyPeriod(360).prodState("신품대비 70~79%"));
		assertThat(recommended(only(plain()))).isEqualTo(sellerB.toString());

		cleanUp();
		setUp();
		save(base(sellerA, "20261105100000", 1000).warrantyPeriod(360).prodState("신품대비 70~79%"));
		save(base(sellerB, "20261105100001", 1000).warrantyPeriod(360).prodState("신품"));
		assertThat(recommended(only(plain()))).isEqualTo(sellerB.toString());
	}

	@Test
	@DisplayName("원래 상품에 조건과 다른 매물뿐이어도 조건에 맞는 대체품이 있으면 제안한다")
	void alternativesWhenOnlyMismatched() {
		Product alt = products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), "구매조건 대체 C", null, "Acme", null, null, null, null, null, null, null));
		jdbc.update("update trd_prod_master set alter_prod_name = ? where prod_id = ?", "구매조건 대체 C", master.getProdId());
		save(base(sellerA, "20261105100000", 2000));
		listings.saveAndFlush(base(sellerB, "20261105100001", 900).prodId(alt.getProdId()).build());

		CartBulkRowResult r = only(row(null, "1500", null, null, null, null, null, null));

		assertThat(r.status()).isEqualTo(Status.CHOOSE);
		assertThat(r.alternatives()).extracting(a -> a.prodId()).containsExactly(alt.getProdId());
	}

	@Test
	@DisplayName("최소 보증 칸에 \"개월\"만 적으면 조건 없음으로 넘기지 않고 오류")
	void monthsWordOnly() {
		save(base(sellerA, "20261105100000", 1000));

		assertThat(only(row(null, null, "개월", null, null, null, null, null)).fields()).containsKey("minWarrantyMonths");
	}

	@Test
	@DisplayName("정렬에서 제공가능일이 빈 글자인 매물은 날짜가 있는 매물보다 앞서지 않는다")
	void blankProvideDateSortsLast() {
		save(base(sellerA, "20261105100000", 1000).deliveryDate(""));
		save(base(sellerB, "20261105100001", 1000).deliveryDate("2099-01-01"));

		assertThat(recommended(only(plain()))).isEqualTo(sellerB.toString());
	}

	@Test
	@DisplayName("조건과 다른 대체 매물도 고르면 허용(substituted)하고 다른 점이 실린다 — 고른 대체품은 제안 목록에 그대로 남는다")
	void chosenAlternativeBreaksCondition() {
		Product alt = products.findOrCreate(new ProductDraft(CategoryFragments.parse("P01-Q01-R001"), "구매조건 대체 B", null, "Acme", null, null, null, null, null, null, null));
		jdbc.update("update trd_prod_master set alter_prod_name = ? where prod_id = ?", "구매조건 대체 B", master.getProdId());
		listings.saveAndFlush(base(sellerB, "20261105100001", 2000).prodId(alt.getProdId()).build());
		CartBulkRowDto picked = new CartBulkRowDto(2, null, NAME, "Acme", null, "3", "2099-12-31", null, sellerB.toString(), "20261105100001", null, "1500", null, null,
				null, null, null, null);

		CartBulkRowResult r = only(picked);

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(r.substituted()).isTrue();
		assertThat(r.chosen().mismatches()).anySatisfy(m -> assertThat(m).contains("상한"));
		assertThat(r.alternatives()).extracting(a -> a.prodId()).containsExactly(alt.getProdId());
	}

	@Test
	@DisplayName("조건 칸이 틀리면 그 칸 오류: 모르는 상태·0 이하 또는 글자 단가·목록 밖 보증 개월·Y 아닌 증빙")
	void badConditionFields() {
		save(base(sellerA, "20261105100000", 1000));

		CartBulkRowResult r = only(row("양호", "abc", "5", "예", null, null, null, null));

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.fields()).containsKeys("minState", "maxPrice", "minWarrantyMonths", "needDataSheet");
		assertThat(only(row(null, "0", null, null, null, null, null, null)).fields()).containsKey("maxPrice");
		assertThat(only(row(null, "1000000001", null, null, null, null, null, null)).fields()).containsKey("maxPrice");
		assertThat(only(row(null, null, "37", null, null, null, null, null)).fields()).containsKey("minWarrantyMonths");
	}

	@Test
	@DisplayName("조건이 하나도 없으면 매물 사유는 재고·수량 규칙뿐 (조건 추가 전과 같은 동작)")
	void noConditionsNoExtraReasons() {
		save(base(sellerA, "20261105100000", 1000).prodState("양호"));

		CartBulkRowResult r = only(plain());

		assertThat(r.status()).isEqualTo(Status.AVAILABLE);
		assertThat(option(r, sellerA).traits().prodState()).isEqualTo("양호");
	}

	@Test
	@DisplayName("상태 조건이 있으면 목록 밖 레거시 상태 글은 확인할 수 없어 탈락")
	void legacyStateWithCondition() {
		save(base(sellerA, "20261105100000", 1000).prodState("양호"));

		CartBulkRowResult r = only(row("신품대비 50% 미만", null, null, null, null, null, null, null));

		assertThat(r.status()).isEqualTo(Status.CHOOSE);
		assertThat(option(r, sellerA).mismatches()).anySatisfy(m -> assertThat(m).contains("알 수 없"));
	}

}
