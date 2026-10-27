package com.company.market.listing.service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.storage.UploadService;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.repository.CategoryRepository;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ListingSearchRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

/**
 * 같은 사용자가 같은 초에 다른 상품 두 개를 등록할 때 (탭 두 개). 정의서 PK 는 (user_id, reg_date, prod_id) 라 DB 는 막지 않는다 —
 * 서버 잠금으로 두 번째를 409 로 막아 매물 주소 두 값(userId, regDate)이 매물 하나를 가리키게 한다. 시각을 고정하려고
 * 실제 빈들로 서비스를 따로 만든다 (업로드 소유 확인만 mock)
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
class ListingSameSecondTest {

	@Autowired
	ListingRepository listings;

	@Autowired
	ListingSearchRepository searchRepository;

	@Autowired
	ProductService products;

	@Autowired
	CategoryRepository categories;

	@Autowired
	ApplicationEventPublisher events;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	TransactionTemplate tx;

	ListingService service;

	UUID sellerId;

	@BeforeEach
	void setUp() {
		cleanUp();
		Clock sameSecond = Clock.fixed(Instant.parse("2026-10-27T03:00:00Z"), ZoneOffset.UTC);
		service = new ListingService(listings, searchRepository, products, categories, mock(UploadService.class), sameSecond,
				events);
		sellerId = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("samesecond")
			.passwordHash("$2a$12$hash").nickname("samesecond").email("samesecond@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build()).getId();
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master where prod_name like '같은초 %'");
		jdbc.update("delete from trd_user_info where user_id = 'samesecond'");
	}

	private ListingCreateRequest request(String prodName) {
		return new ListingCreateRequest(null, "P01-Q01-R001", prodName, null, "삼성", null, null, null, "판매", "신품", 1000, 1,
				null, null, "2099-12-31", null, null, List.of("public/listings/photos/2026/10/a.jpg"));
	}

	@Test
	@DisplayName("같은 사용자가 같은 초에 다른 상품을 등록하면 두 번째는 409 LISTING_DUPLICATE_REG_TIME, 매물은 하나")
	void secondListingInSameSecondIsRejected() {
		tx.executeWithoutResult(s -> service.create(sellerId, request("같은초 A")));

		assertThatThrownBy(() -> tx.executeWithoutResult(s -> service.create(sellerId, request("같은초 B"))))
			.isInstanceOf(ApiException.class)
			.extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LISTING_DUPLICATE_REG_TIME);
		assertThat(jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ?", Integer.class, sellerId))
			.isEqualTo(1);
	}

}
