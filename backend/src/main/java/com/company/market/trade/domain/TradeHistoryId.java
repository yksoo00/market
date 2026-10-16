package com.company.market.trade.domain;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** trd_trade_history 의 복합 PK: (trade_id, trade_date, prod_id). 정의서 그대로 */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class TradeHistoryId implements Serializable {

	private String tradeId;

	private String tradeDate;

	private String prodId;

}
