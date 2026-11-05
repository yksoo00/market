package com.company.market.listing.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.dto.BulkRowDto;
import com.company.market.listing.dto.BulkRowResult;
import com.company.market.listing.dto.BulkRowResult.Status;
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

/** 엑셀 다량 등록 줄 검사·마스터 매칭 (계획 2026-11-05-bulk-listing-excel.md 작업 2) */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingBulkServiceTest {

	private static final String CATEGORY = "P01-Q01-R001";

	@Autowired
	ListingBulkService service;

	@Autowired
	ProductService products;

	@Autowired
	JdbcTemplate jdbc;

	String withPhotoId;

	String noPhotoId;

	@BeforeEach
	void setUp() {
		cleanUp();
		withPhotoId = products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "벌크 스위치 C9300", null, "Cisco",
				"CLS-1", null, null, null, null, null, "public/listings/photos/2026/10/a.jpg")).getProdId();
		noPhotoId = products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "벌크 라우터 ISR", null, "Cisco",
				null, null, null, null, null, null, null)).getProdId();
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_master where prod_name like '벌크 %'");
	}

	/** 통과하는 기본 줄. 바꾸고 싶은 칸만 바꿔 쓴다 */
	private static BulkRowDto row(int rowNo, String name, String brand, String classNo) {
		return new BulkRowDto(rowNo, null, name, brand, classNo, null, null, "신품", "500000", "3", null, null, "2099-12-31", "메모");
	}

	private BulkRowResult only(BulkRowDto row) {
		return service.check(UUID.randomUUID(), List.of(row)).get(0);
	}

	@Test
	@DisplayName("이름·제조사·분류번호가 대소문자·공백만 달라도 마스터를 찾는다")
	void matchesIgnoringCaseAndSpaces() {
		BulkRowResult r = only(row(2, "  벌크   스위치  c9300 ", "CISCO", "cls-1"));

		assertThat(r.status()).isEqualTo(Status.MATCHED);
		assertThat(r.prodId()).isEqualTo(withPhotoId);
		assertThat(r.matchedName()).isEqualTo("벌크 스위치 C9300");
		assertThat(r.fields()).isEmpty();
		assertThat(r.notices()).isEmpty();
	}

	@Test
	@DisplayName("prodId 를 직접 주면 그 마스터, 없는 prodId 는 prodId 칸 오류")
	void byProdId() {
		BulkRowDto ok = new BulkRowDto(2, withPhotoId, null, null, null, null, null, "신품", "1", "1", null, null, "2099-12-31", null);
		BulkRowDto missing = new BulkRowDto(3, "KP-0000-000000", null, null, null, null, null, "신품", "1", "1", null, null, "2099-12-31", null);

		List<BulkRowResult> r = service.check(UUID.randomUUID(), List.of(ok, missing));

		assertThat(r.get(0).status()).isEqualTo(Status.MATCHED);
		assertThat(r.get(1).status()).isEqualTo(Status.FAILED);
		assertThat(r.get(1).fields()).containsKey("prodId");
	}

	@Test
	@DisplayName("마스터를 못 찾으면 신규 마스터 후보. 이름이 겹치는 기존 상품은 candidates 에 나온다")
	void newMasterWithCandidates() {
		BulkRowDto typo = new BulkRowDto(2, null, "벌크 스위치", "Cisco", null, null, CATEGORY, "신품", "1", "1", null, null, "2099-12-31", null);

		BulkRowResult r = only(typo);

		assertThat(r.status()).isEqualTo(Status.NEW_MASTER);
		assertThat(r.candidates()).extracting(BulkRowResult.Candidate::prodId).contains(withPhotoId);
		assertThat(r.notices()).isNotEmpty();
	}

	@Test
	@DisplayName("신규 마스터인데 카테고리 코드가 없거나 없는 코드면 categoryCode 오류")
	void newMasterNeedsCategory() {
		BulkRowDto none = new BulkRowDto(2, null, "벌크 새상품", "Acme", null, null, null, "신품", "1", "1", null, null, "2099-12-31", null);
		BulkRowDto unknown = new BulkRowDto(3, null, "벌크 새상품2", "Acme", null, null, "ZZZ-ZZZ-ZZZ", "신품", "1", "1", null, null, "2099-12-31", null);

		List<BulkRowResult> r = service.check(UUID.randomUUID(), List.of(none, unknown));

		assertThat(r.get(0).status()).isEqualTo(Status.FAILED);
		assertThat(r.get(0).fields()).containsKey("categoryCode");
		assertThat(r.get(1).fields()).containsKey("categoryCode");
	}

	@Test
	@DisplayName("상품명·제조사가 비면 각 칸 오류")
	void nameAndBrandRequired() {
		BulkRowResult r = only(new BulkRowDto(2, null, null, null, null, null, null, "신품", "1", "1", null, null, "2099-12-31", null));

		assertThat(r.status()).isEqualTo(Status.FAILED);
		assertThat(r.fields()).containsKeys("prodName", "prodBrand");
	}

	@Test
	@DisplayName("상품상태가 목록 밖이면 prodState 오류")
	void prodStateOutsideList() {
		BulkRowDto bad = new BulkRowDto(2, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "새것", "1", "1", null, null, "2099-12-31", null);

		assertThat(only(bad).fields()).containsKey("prodState");
	}

	@Test
	@DisplayName("수량 0·단가 음수·글자 숫자·쉼표 숫자: 0·음수·글자는 오류, \"1,000\" 은 통과")
	void numberFields() {
		BulkRowDto qtyZero = new BulkRowDto(2, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1", "0", null, null, "2099-12-31", null);
		BulkRowDto priceNeg = new BulkRowDto(3, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "-5", "1", null, null, "2099-12-31", null);
		BulkRowDto priceText = new BulkRowDto(4, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "오백", "1", null, null, "2099-12-31", null);
		BulkRowDto comma = new BulkRowDto(5, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1,000", "1", null, null, "2099-12-31", null);

		// 같은 상품 네 줄을 한 파일에 넣으면 파일 안 중복이 끼므로 줄마다 따로 검사한다
		assertThat(only(qtyZero).fields()).containsKey("salesQuantity");
		assertThat(only(priceNeg).fields()).containsKey("salesUnitPrice");
		assertThat(only(priceText).fields()).containsKey("salesUnitPrice");
		assertThat(only(comma).fields()).isEmpty();
	}

	@Test
	@DisplayName("최소주문량이 수량보다 크면 minOrderQuantity 오류")
	void minOrderOverQuantity() {
		BulkRowDto bad = new BulkRowDto(2, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1", "3", "5", null, "2099-12-31", null);

		assertThat(only(bad).fields()).containsKey("minOrderQuantity");
	}

	@Test
	@DisplayName("제공가능일이 비었거나 형식이 틀리거나 지난 날짜면 deliveryDate 오류")
	void deliveryDate() {
		BulkRowDto empty = new BulkRowDto(2, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1", "1", null, null, null, null);
		BulkRowDto format = new BulkRowDto(3, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1", "1", null, null, "2099/12/31", null);
		BulkRowDto past = new BulkRowDto(4, null, "벌크 스위치 C9300", "Cisco", "CLS-1", null, null, "신품", "1", "1", null, null, "2020-01-01", null);

		List<BulkRowResult> r = service.check(UUID.randomUUID(), List.of(empty, format, past));

		r.forEach(x -> assertThat(x.fields()).containsKey("deliveryDate"));
	}

	@Test
	@DisplayName("같은 상품이 한 파일에 두 줄이면 둘째 줄부터 실패")
	void duplicateInFile() {
		List<BulkRowResult> r = service.check(UUID.randomUUID(),
				List.of(row(2, "벌크 스위치 C9300", "Cisco", "CLS-1"), row(3, "벌크 스위치 c9300", "cisco", "cls-1")));

		assertThat(r.get(0).status()).isEqualTo(Status.MATCHED);
		assertThat(r.get(1).status()).isEqualTo(Status.FAILED);
		assertThat(r.get(1).fields()).containsKey("prodName");
	}

	@Test
	@DisplayName("사진 없는 마스터는 MATCHED 이고 안내가 붙는다")
	void noPhotoNotice() {
		BulkRowResult r = only(row(2, "벌크 라우터 ISR", "Cisco", null));

		assertThat(r.status()).isEqualTo(Status.MATCHED);
		assertThat(r.prodId()).isEqualTo(noPhotoId);
		assertThat(r.notices()).hasSize(1);
	}

	@Test
	@DisplayName("줄이 0개이거나 200개를 넘으면 거절")
	void rowCountBounds() {
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.check(UUID.randomUUID(), List.of()))
			.isInstanceOf(com.company.market.common.exception.ValidationException.class);
		List<BulkRowDto> many = java.util.stream.IntStream.range(0, 201).mapToObj(i -> row(i + 2, "벌크 스위치 C9300", "Cisco", "CLS-1")).toList();
		org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.check(UUID.randomUUID(), many))
			.isInstanceOf(com.company.market.common.exception.ValidationException.class);
	}

}
