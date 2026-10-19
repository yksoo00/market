package com.company.market.trade.service;

import java.time.Clock;
import java.time.format.DateTimeFormatter;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.time.KoreanDates;
import com.company.market.trade.repository.TradeInfoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 거래ID = 한국 시간 yyMMddHH + 그 시간대 순번 3자리 (예 26092917001, 사용자 지시 2026-10-15).
 * 순번은 "그 시간대 건수 + 1". 같은 시간대에 동시에 만들면 같은 번호가 나오는데, 겹친 뒤 다시 시도할 수는 없다 —
 * Postgres 는 실패한 문장 하나로 트랜잭션 전체가 중단돼서. 그래서 시간대별 advisory lock 으로 세기부터 저장·커밋까지 줄 세운다.
 * 락은 호출자 트랜잭션이 끝날 때 풀리므로 그 트랜잭션 안에서만 부른다(MANDATORY).
 */
@Component
@RequiredArgsConstructor
public class TradeIdGenerator {

	private static final DateTimeFormatter PREFIX_FORMAT = DateTimeFormatter.ofPattern("yyMMddHH");

	private static final int MAX_SEQUENCE = 999;

	private final TradeInfoRepository trades;

	private final JdbcTemplate jdbc;

	private final Clock clock;

	@Transactional(propagation = Propagation.MANDATORY)
	public String next() {
		String prefix = KoreanDates.now(clock).format(PREFIX_FORMAT);
		jdbc.queryForList("select pg_advisory_xact_lock(hashtext('trade_id:' || ?))", prefix);
		long sequence = trades.countByTradeIdStartingWith(prefix) + 1;
		if (sequence > MAX_SEQUENCE) {
			throw new ApiException(ErrorCode.TRADE_ID_EXHAUSTED);
		}
		return prefix + String.format("%03d", sequence);
	}

}
