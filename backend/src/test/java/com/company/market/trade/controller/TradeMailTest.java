package com.company.market.trade.controller;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.mail.Mailer;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ProductRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 견적·거래 단계마다 상대에게 가는 메일 (스펙 2026-10-20 "메일") */
@Import({ TestInfraConfiguration.class, TradeMailTest.RecordingMailerConfig.class })
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TradeMailTest {

	record Sent(String to, String subject, String body) {
	}

	/** 보낸 메일을 모은다. fail=true 면 SMTP 오류처럼 던진다 */
	static class RecordingMailer implements Mailer {

		final List<Sent> sent = new CopyOnWriteArrayList<>();

		volatile boolean fail;

		@Override
		public void send(String to, String subject, String body) {
			if (fail) {
				throw new IllegalStateException("SMTP down");
			}
			sent.add(new Sent(to, subject, body));
		}

	}

	@TestConfiguration
	static class RecordingMailerConfig {

		@Bean
		@Primary
		RecordingMailer recordingMailer() {
			return new RecordingMailer();
		}

	}

	static final String REG = "20261020110000";

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JwtProvider jwtProvider;

	@Autowired
	ListingRepository listingRepository;

	@Autowired
	ProductRepository productRepository;

	@Autowired
	RecordingMailer mailer;

	UUID sellerId;

	UUID buyerId;

	Cookie seller;

	Cookie buyer;

	@BeforeEach
	void setUp() {
		cleanUp();
		mailer.sent.clear();
		mailer.fail = false;
		sellerId = newUser("mailseller", "01033330001");
		buyerId = newUser("mailbuyer", "01033330002");
		seller = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(sellerId));
		buyer = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(buyerId));
		productRepository.saveAndFlush(Product.builder().prodId("MAILAPI01").categoryCode("P01-Q01-R001")
			.prodName("서버 R740").prodBrand("Dell").regDate(REG).build());
		listingRepository.saveAndFlush(Listing.builder().userId(sellerId).regDate(REG).prodId("MAILAPI01")
			.tradeType("등록").prodState("신품").salesUnitPrice(1000).salesQuantity(10).stockQuantity(10)
			.minOrderQuantity(1).orderUnit(1).deliveryDate("2099-12-31").build());
	}

	@AfterEach
	void cleanUp() {
		jdbc.update("delete from trd_trade_history");
		jdbc.update("delete from trd_trade_info");
		jdbc.update("delete from trd_prod_reg");
		jdbc.update("delete from trd_prod_master");
		jdbc.update("delete from trd_user_info");
	}

	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	private ResultActions quote(int price) throws Exception {
		return mvc.perform(post("/api/v1/trades/quotes").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"items":[{"sellerId":"%s","regDate":"%s","orderUnitPrice":%d,"orderQuantity":1}]}
					""".formatted(sellerId, REG, price)));
	}

	private String quoteId() {
		return jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '견적조정'", String.class);
	}

	private ResultActions purchase() throws Exception {
		return mvc.perform(post("/api/v1/trades").cookie(buyer).contentType(MediaType.APPLICATION_JSON)
			.content("{\"sellerId\":\"%s\",\"regDate\":\"%s\",\"orderQuantity\":2}".formatted(sellerId, REG)));
	}

	private String purchaseId() {
		return jdbc.queryForObject("select trade_id from trd_trade_info where trade_type = '거래'", String.class);
	}

	private ResultActions action(Cookie who, String tradeId, String what) throws Exception {
		return mvc.perform(post("/api/v1/trades/" + tradeId + "/" + what).cookie(who));
	}

	@Test
	@DisplayName("견적 요청 → 판매자에게 1통 (상품명·희망단가). 400 으로 롤백된 요청엔 0통")
	void quoteRequestMailsSeller() throws Exception {
		quote(1001).andExpect(status().isBadRequest());
		assertThat(mailer.sent).isEmpty();

		quote(900).andExpect(status().isCreated());
		assertThat(mailer.sent).singleElement().satisfies(m -> {
			assertThat(m.to()).isEqualTo("mailseller@example.com");
			assertThat(m.subject()).contains("견적 요청");
			assertThat(m.body()).contains("서버 R740").contains("900");
			assertThat(m.body()).doesNotContain("mailbuyer@example.com");
		});
	}

	@Test
	@DisplayName("수락·거절 → 구매자에게 1통, 제목으로 구분")
	void replyMailsBuyer() throws Exception {
		quote(900);
		action(seller, quoteId(), "accept").andExpect(status().isOk());
		assertThat(mailer.sent.get(1).to()).isEqualTo("mailbuyer@example.com");
		assertThat(mailer.sent.get(1).subject()).contains("수락");

		jdbc.update("delete from trd_trade_info");
		mailer.sent.clear();
		quote(800);
		action(seller, quoteId(), "reject").andExpect(status().isOk());
		assertThat(mailer.sent.get(1).to()).isEqualTo("mailbuyer@example.com");
		assertThat(mailer.sent.get(1).subject()).contains("거절");
	}

	@Test
	@DisplayName("견적 취소 → 판매자, 구매요청 → 판매자, 거래 취소 → 상대, 거래완료 → 둘 다")
	void otherSteps() throws Exception {
		quote(900);
		mailer.sent.clear();
		action(buyer, quoteId(), "cancel").andExpect(status().isNoContent());
		assertThat(mailer.sent).singleElement().satisfies(m -> {
			assertThat(m.to()).isEqualTo("mailseller@example.com");
			assertThat(m.subject()).contains("취소");
		});

		mailer.sent.clear();
		purchase().andExpect(status().isCreated());
		assertThat(mailer.sent).singleElement().satisfies(m -> assertThat(m.to()).isEqualTo("mailseller@example.com"));

		mailer.sent.clear();
		action(seller, purchaseId(), "cancel").andExpect(status().isNoContent());
		assertThat(mailer.sent).singleElement().satisfies(m -> assertThat(m.to()).isEqualTo("mailbuyer@example.com"));

		purchase();
		mailer.sent.clear();
		action(buyer, purchaseId(), "complete").andExpect(status().isOk());
		assertThat(mailer.sent).extracting(Sent::to).containsExactlyInAnyOrder("mailseller@example.com", "mailbuyer@example.com");
	}

	@Test
	@DisplayName("메일이 실패해도 요청은 성공으로 남는다")
	void mailFailureDoesNotFailRequest() throws Exception {
		mailer.fail = true;
		quote(900).andExpect(status().isCreated());
		assertThat(jdbc.queryForObject("select count(*) from trd_trade_info", Integer.class)).isEqualTo(1);
	}

	@Test
	@DisplayName("이메일이 없는 상대는 건너뛴다")
	void skipsUserWithoutEmail() throws Exception {
		jdbc.update("update trd_user_info set user_email = null where uid = ?", sellerId);
		quote(900).andExpect(status().isCreated());
		assertThat(mailer.sent).isEmpty();
	}

}
