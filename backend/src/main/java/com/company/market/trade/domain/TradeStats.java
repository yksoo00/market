package com.company.market.trade.domain;

import java.util.List;

import jakarta.persistence.Converter;

/**
 * 거래상태(trade_stats) = 지금 어디까지 왔나. 앞으로만 바뀐다 (사용자 결정 2026-10-20).
 * 견적조정: 견적요청 → 견적수락 | 견적거절 (재요청하면 같은 행이 견적요청으로 돌아간다). 수락된 견적에서 [구매]하면 같은 행이
 * 구매요청 → 구매확정으로 이어진다(견적서 한 건 = 한 행, 사용자 결정 2026-10-21). 거래: 구매요청 → 구매확정.
 * 취소는 값 없이 행을 지운다. DB 에는 정의서의 한글 라벨로 저장한다 — 숫자 코드로 바뀌면 라벨만 고친다.
 */
public enum TradeStats implements TradeCode {

	CART("장바구니", "cart"),
	COMPARE("비교용", "compare"),
	QUOTE_REQUESTED("견적요청", "quoteRequested"),
	/** 정의서 밖 값 둘 (사용자 결정 2026-10-21 — 처음엔 견적회신 하나였으나 수락·거절이 안 보여 헷갈린다고 나눔) */
	QUOTE_ACCEPTED("견적수락", "quoteAccepted"),
	QUOTE_REJECTED("견적거절", "quoteRejected"),
	REQUESTED("구매요청", "requested"),
	CONFIRMED("구매확정", "confirmed");

	/** 견적 단계 — 구매자·매물당 이 단계 행은 하나(ux_trd_trade_info_one_quote)이고, 재요청이 덮어쓰며, 매물 삭제 때 같이 지워진다 */
	public static final List<TradeStats> QUOTE_STAGES = List.of(QUOTE_REQUESTED, QUOTE_ACCEPTED, QUOTE_REJECTED);

	private final String label;

	private final String code;

	TradeStats(String label, String code) {
		this.label = label;
		this.code = code;
	}

	@Override
	public String label() {
		return label;
	}

	public String code() {
		return code;
	}

	@Converter
	public static class DbConverter extends TradeCodeConverter<TradeStats> {

		public DbConverter() {
			super(TradeStats.class);
		}

	}

}
