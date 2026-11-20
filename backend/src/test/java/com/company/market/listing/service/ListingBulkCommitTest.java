package com.company.market.listing.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.storage.UploadService;
import com.company.market.listing.domain.CategoryFragments;
import com.company.market.listing.dto.BulkRowDto;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/** 엑셀 다량 등록 확정 (계획 2026-11-05-bulk-listing-excel.md 작업 3). 등록 시각을 고정하려고 실제 빈으로 서비스를 따로 만든다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingBulkCommitTest {

	private static final String CATEGORY = "P01-Q01-R001";

	@Autowired
	ProductService products;

	@Autowired
	CategoryService categories;

	@Autowired
	Validator validator;

	@Autowired
	ListingRepository listings;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UploadService uploads;

	ListingBulkService service;

	String sellerId;

	String withPhotoId;

	String noPhotoId;

	@BeforeEach
	void setUp() {
		cleanUp();
		Clock fixed = Clock.fixed(Instant.parse("2026-11-05T03:00:00Z"), ZoneId.of("Asia/Seoul"));
		service = new ListingBulkService(products, categories, validator, fixed, listings, new ListingBulkParser(), uploads, new ListingBulkArchive());
		sellerId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("bulkcommit")
			.passwordHash("$2a$12$hash").nickname("bulkcommit").email("bulkcommit@example.com")
			.name("홍길동").phone("01077770124").phoneHash(hasher.hash("01077770124")).build()).getId();
		withPhotoId = products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "일괄 스위치", null, "Cisco",
				null, null, null, null, null, "master-sheet.pdf", "public/listings/photos/2026/10/a.jpg")).getProdId();
		noPhotoId = products.findOrCreate(new ProductDraft(CategoryFragments.parse(CATEGORY), "일괄 라우터", null, "Cisco",
				null, null, null, null, null, null, null)).getProdId();
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg where user_id in (select uid from trd_user_info where user_id = 'bulkcommit')");
		jdbc.update("delete from trd_prod_master where prod_name like '일괄 %'");
		jdbc.update("delete from trd_user_info where user_id = 'bulkcommit'");
	}

	private static BulkRowDto row(int rowNo, String name, String quantity) {
		return new BulkRowDto(rowNo, null, name, "Cisco", null, null, null, "신품", "1000", quantity, null, null, "2099-12-31", "메모");
	}

	private int count() {
		return jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ?", Integer.class, sellerId);
	}

	@Test
	@DisplayName("전부 통과하면 모두 저장되고 등록 시각이 1초씩 다르다. 사진·데이터시트는 마스터 값")
	void commitsAllWithSequentialRegDates() {
		int created = service.commit(sellerId, List.of(row(2, "일괄 스위치", "3"), row(3, "일괄 라우터", "5")));

		assertThat(created).isEqualTo(2);
		List<Map<String, Object>> saved = jdbc.queryForList(
				"select reg_date, prod_id, prod_photo_1, prod_data_sheet, trade_type, stock_quantity from trd_prod_reg where user_id = ? order by reg_date", sellerId);
		assertThat(saved).extracting(m -> m.get("reg_date")).containsExactly("20261105120000", "20261105120001");
		assertThat(saved.get(0).get("prod_id")).isEqualTo(withPhotoId);
		assertThat(saved.get(0).get("prod_photo_1")).isEqualTo("public/listings/photos/2026/10/a.jpg");
		assertThat(saved.get(0).get("prod_data_sheet")).isEqualTo("master-sheet.pdf");
		assertThat(saved.get(0).get("trade_type")).isEqualTo("등록");
		assertThat(saved.get(1).get("prod_photo_1")).isNull();
	}

	@Test
	@DisplayName("한 줄이 틀리면 하나도 저장되지 않고 줄 번호.칸 으로 사유가 돌아온다")
	void rollsBackWhenAnyRowFails() {
		assertThatThrownBy(() -> service.commit(sellerId, List.of(row(2, "일괄 스위치", "3"), row(3, "일괄 라우터", "0"))))
			.isInstanceOfSatisfying(ApiException.class, e -> {
				assertThat(e.getCode()).isEqualTo(ErrorCode.LISTING_BULK_INVALID);
				assertThat(e.getFields()).containsKey("3.salesQuantity");
			});

		assertThat(count()).isZero();
	}

	@Test
	@DisplayName("신규 마스터 줄은 마스터가 새로 생기고 그 상품으로 매물이 붙는다")
	void createsNewMaster() {
		BulkRowDto fresh = new BulkRowDto(2, null, "일괄 새상품", "Acme", "CLS-9", "NO-1", CATEGORY, "신품", "1000", "2", null, null, "2099-12-31", null);

		service.commit(sellerId, List.of(fresh));

		assertThat(jdbc.queryForObject("select count(*) from trd_prod_master where prod_name = '일괄 새상품' and prod_brand = 'Acme'", Integer.class))
			.isEqualTo(1);
		assertThat(jdbc.queryForObject(
				"select count(*) from trd_prod_reg r join trd_prod_master m on m.prod_id = r.prod_id where r.user_id = ? and m.prod_name = '일괄 새상품'",
				Integer.class, sellerId)).isEqualTo(1);
	}

	@Test
	@DisplayName("두 번 확정해도 이미 있는 등록 시각은 건너뛰어 겹치지 않는다")
	void skipsTakenSeconds() {
		service.commit(sellerId, List.of(row(2, "일괄 스위치", "3"), row(3, "일괄 라우터", "5")));

		service.commit(sellerId, List.of(new BulkRowDto(2, null, "일괄 새상품", "Acme", null, null, CATEGORY, "신품", "1", "1", null, null, "2099-12-31", null)));

		List<String> regDates = jdbc.queryForList("select reg_date from trd_prod_reg where user_id = ? order by reg_date", String.class, sellerId);
		assertThat(regDates).containsExactly("20261105120000", "20261105120001", "20261105120002");
	}

	@Test
	@DisplayName("줄 없음은 거절")
	void emptyRows() {
		assertThatThrownBy(() -> service.commit(sellerId, List.of()))
			.isInstanceOf(com.company.market.common.exception.ValidationException.class);
		assertThat(noPhotoId).isNotNull();
	}

}
