package com.company.market.trade.domain;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** trd_trade_history 의 복합 PK: (user_id 구매자, trade_id, trade_date). 정의서 그대로 (2026-10-27) */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class TradeHistoryId implements Serializable {

	private String userId;

	private String tradeId;

	private String tradeDate;

}
