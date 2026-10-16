package com.company.market.trade.domain;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** trd_trade_info 의 복합 PK: (user_id 구매자, trade_id). 정의서 그대로 */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class TradeInfoId implements Serializable {

	private UUID userId;

	private String tradeId;

}
