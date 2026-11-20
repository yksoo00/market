package com.company.market.listing.service;

import com.company.market.TestUids;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ProductPageItemResponse;
import com.company.market.listing.dto.ProductSearchPageResponse;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** 상품마스터 검색(필터·페이지 번호) (계획 2026-11-09-product-search-modal.md 작업 1). 개발 DB 에 마스터가 많아도 섞이지 않게 제조사 SrchBrand* 로 가둔다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ProductSearchPageTest {

	private static final String CATEGORY_A = "P01-Q01-R001";

	private static final String CATEGORY_B = "E01-F01-G002";

	@Autowired
	ProductService service;

	@Autowired
	ListingRepository listings;

	@Autowired
	JdbcTemplate jdbc;

	final String seller = TestUids.random();

	@BeforeEach
	void setUp() {
		cleanUp();
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id = ?", seller);
		jdbc.update("delete from trd_prod_master where prod_brand like 'SrchBrand%'");
	}

	private Product master(String name, String brand, String category) {
		return service.findOrCreate(new ProductDraft(CategoryFragments.parse(category), name, null, brand, null, null, null, null, null, null, null));
	}

	private List<String> names(ProductSearchPageResponse r) {
		return r.items().stream().map(ProductPageItemResponse::prodName).toList();
	}

	@Test
	@DisplayName("검색어 없이 제조사로만 가두면 이름순이고, 20건씩 나뉘며 페이지를 넘겨도 중복·누락이 없다")
	void pagesWithoutDuplicates() {
		IntStream.rangeClosed(1, 25).forEach(i -> master("검색페이지 %02d".formatted(i), "SrchBrand", CATEGORY_A));

		ProductSearchPageResponse first = service.searchPage("", "", "SrchBrand", 1);
		ProductSearchPageResponse second = service.searchPage("", "", "SrchBrand", 2);

		assertThat(first.total()).isEqualTo(25);
		assertThat(first.totalPages()).isEqualTo(2);
		assertThat(first.page()).isEqualTo(1);
		assertThat(first.items()).hasSize(20);
		assertThat(second.items()).hasSize(5);
		Set<String> all = new HashSet<>(names(first));
		all.addAll(names(second));
		assertThat(all).hasSize(25);
		assertThat(names(first)).isSorted();
		assertThat(names(first).get(19)).isLessThan(names(second).get(0));
	}

	@Test
	@DisplayName("검색어가 있으면 관련도 순: 이름 정확히 같음 → 이름이 검색어로 시작 → 이름에 포함 → 제조사·번호에서만 걸림")
	void relevanceOrder() {
		master("zqx 뒤에", "SrchBrand", CATEGORY_A);
		master("앞에 zqx", "SrchBrand", CATEGORY_A);
		master("다른이름", "SrchBrand zqx", CATEGORY_A);
		master("zqx", "SrchBrand", CATEGORY_A);

		ProductSearchPageResponse r = service.searchPage("ZQX", "", "", 1);

		assertThat(names(r)).containsExactly("zqx", "zqx 뒤에", "앞에 zqx", "다른이름");
	}

	@Test
	@DisplayName("제조사 필터는 대소문자 무시 부분일치")
	void brandFilter() {
		master("검색페이지 A", "SrchBrand Alpha", CATEGORY_A);
		master("검색페이지 B", "SrchBrand Beta", CATEGORY_A);

		assertThat(names(service.searchPage("", "", "srchbrand ALPHA", 1))).containsExactly("검색페이지 A");
		assertThat(names(service.searchPage("", "", "brand b", 1))).contains("검색페이지 B").doesNotContain("검색페이지 A");
	}

	@Test
	@DisplayName("카테고리 필터는 대·중·소 어느 단계든 걸러 낸다")
	void categoryFilter() {
		master("검색페이지 가", "SrchBrand", CATEGORY_A);
		master("검색페이지 나", "SrchBrand", CATEGORY_B);

		assertThat(names(service.searchPage("", "P01", "SrchBrand", 1))).containsExactly("검색페이지 가");
		assertThat(names(service.searchPage("", "P01-Q01", "SrchBrand", 1))).containsExactly("검색페이지 가");
		assertThat(names(service.searchPage("", CATEGORY_A, "SrchBrand", 1))).containsExactly("검색페이지 가");
		assertThat(names(service.searchPage("", "E01", "SrchBrand", 1))).containsExactly("검색페이지 나");
		// 존재하지 않는 코드는 오류가 아니라 빈 결과
		assertThat(service.searchPage("", "P01-Q99", "SrchBrand", 1).total()).isZero();
	}

	@Test
	@DisplayName("검색어·카테고리·제조사를 함께 걸면 모두 만족하는 것만")
	void combination() {
		master("검색페이지 노트북", "SrchBrand Dell", CATEGORY_A);
		master("검색페이지 노트북", "SrchBrand Acme", CATEGORY_A);
		master("검색페이지 서버", "SrchBrand Dell", CATEGORY_B);

		ProductSearchPageResponse r = service.searchPage("노트북", "P01", "dell", 1);

		assertThat(r.total()).isEqualTo(1);
		assertThat(r.items().get(0).prodBrand()).isEqualTo("SrchBrand Dell");
	}

	@Test
	@DisplayName("검색어의 % · _ · \\ 는 와일드카드가 아니라 문자 그대로 찾는다")
	void wildcardsAreLiteral() {
		master("검색페이지 pct%x", "SrchBrand", CATEGORY_A);
		master("검색페이지 pctzzx", "SrchBrand", CATEGORY_A);
		master("검색페이지 us_x", "SrchBrand", CATEGORY_A);
		master("검색페이지 usax", "SrchBrand", CATEGORY_A);

		assertThat(names(service.searchPage("pct%x", "", "SrchBrand", 1))).containsExactly("검색페이지 pct%x");
		assertThat(names(service.searchPage("us_x", "", "SrchBrand", 1))).containsExactly("검색페이지 us_x");
		assertThat(service.searchPage("\\", "", "SrchBrand", 1).total()).isZero();
	}

	@Test
	@DisplayName("결과가 없어도 1페이지는 있고, 범위 밖 페이지는 ValidationException(page)")
	void pageRange() {
		master("검색페이지 하나", "SrchBrand", CATEGORY_A);

		ProductSearchPageResponse empty = service.searchPage("zzzzzzzzqq", "", "SrchBrand", 1);
		assertThat(empty.total()).isZero();
		assertThat(empty.totalPages()).isEqualTo(1);
		assertThat(empty.items()).isEmpty();

		assertThatThrownBy(() -> service.searchPage("", "", "SrchBrand", 0))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("page"));
		assertThatThrownBy(() -> service.searchPage("", "", "SrchBrand", 2))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("page"));
	}

	@Test
	@DisplayName("카테고리 형식이 틀리면 ValidationException(category)")
	void badCategory() {
		for (String bad : new String[] { "ZZZZZZ", "P01-", "P01-Q01-R001-X", "P 01", "P01/Q01" }) {
			assertThatThrownBy(() -> service.searchPage("", bad, "", 1))
				.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("category"));
		}
	}

	@Test
	@DisplayName("매물 수는 재고가 있고 거래완료가 아닌 매물만 센다")
	void listingCount() {
		Product p = master("검색페이지 매물", "SrchBrand", CATEGORY_A);
		listing("20261109100000", p, 5, false);
		listing("20261109100001", p, 3, false);
		listing("20261109100002", p, 0, false); // 재고 0
		listing("20261109100003", p, 4, true); // 거래완료
		Product none = master("검색페이지 매물없음", "SrchBrand", CATEGORY_A);

		ProductSearchPageResponse r = service.searchPage("검색페이지 매물", "", "SrchBrand", 1);

		assertThat(r.items()).filteredOn(i -> i.prodId().equals(p.getProdId())).extracting(ProductPageItemResponse::listingCount).containsExactly(2);
		assertThat(r.items()).filteredOn(i -> i.prodId().equals(none.getProdId())).extracting(ProductPageItemResponse::listingCount).containsExactly(0);
	}

	private void listing(String regDate, Product p, int stock, boolean completed) {
		listings.saveAndFlush(Listing.builder().userId(seller).regDate(regDate).prodId(p.getProdId()).tradeType("등록").prodState("신품")
			.salesUnitPrice(1000).salesQuantity(Math.max(stock, 1)).minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").stockQuantity(stock).build());
		if (completed) {
			jdbc.update("update trd_prod_reg set dt_expire = '20261101000000' where user_id = ? and reg_date = ?", seller, regDate);
		}
	}

}
