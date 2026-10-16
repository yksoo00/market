package com.company.market.trade.service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class TradeIdGeneratorTest {

	/** 2026-09-29 08:30 UTC = 한국 17:30 */
	static final Clock KST_17H = Clock.fixed(Instant.parse("2026-09-29T08:30:00Z"), ZoneOffset.UTC);

	@Autowired
	TradeInfoRepository trades;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	UUID buyerId;

	@BeforeEach
	void setUp() {
		User buyer = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("tradeidtester")
			.passwordHash("$2a$12$hash").nickname("tradeidtester").email("tradeidtester@example.com")
			.name("홍길동").phone("01012345678").phoneHash(hasher.hash("01012345678")).build());
		buyerId = buyer.getId();
	}

	private TradeInfo trade(String tradeId) {
		return TradeInfo.builder().userId(buyerId).tradeId(tradeId).tradeType(TradeType.PURCHASE_REQUEST)
			.orderUnitPrice(1000).orderQuantity(1).reqDeliDate("2026-10-20").tradeStats(TradeStats.REQUESTED).build();
	}

	@Test
	@DisplayName("trade_id 는 한국 시간 yyMMddHH + 001 부터, 같은 시간대면 순번이 는다")
	void koreanHourPrefixAndSequence() {
		TradeIdGenerator generator = new TradeIdGenerator(trades, jdbc, KST_17H);

		String first = generator.next();
		assertThat(first).isEqualTo("26092917001");

		trades.saveAndFlush(trade(first));
		assertThat(generator.next()).isEqualTo("26092917002");
	}

	@Test
	@DisplayName("한 시간대 999건이 차면 TRADE_ID_EXHAUSTED")
	void exhaustedAfter999() {
		TradeInfoRepository full = mock(TradeInfoRepository.class);
		when(full.countByTradeIdStartingWith("26092917")).thenReturn(999L);
		TradeIdGenerator generator = new TradeIdGenerator(full, mock(JdbcTemplate.class), KST_17H);

		assertThatThrownBy(generator::next).isInstanceOfSatisfying(ApiException.class,
				e -> assertThat(e.getCode()).isEqualTo(ErrorCode.TRADE_ID_EXHAUSTED));
	}

	@Test
	@DisplayName("거래종류·거래상태는 한글 라벨로 저장된다")
	void codesAreStoredAsKoreanLabels() {
		trades.saveAndFlush(trade("26092917001"));

		assertThat(jdbc.queryForObject("select trade_stats from trd_trade_info where trade_id = '26092917001'", String.class))
			.isEqualTo("구매요청");
		assertThat(jdbc.queryForObject("select trade_type from trd_trade_info where trade_id = '26092917001'", String.class))
			.isEqualTo("구매요청");
		assertThat(trades.findByTradeId("26092917001")).get().extracting(TradeInfo::getTradeStats)
			.isEqualTo(TradeStats.REQUESTED);
	}

}
