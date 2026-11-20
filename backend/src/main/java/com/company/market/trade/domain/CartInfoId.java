package com.company.market.trade.domain;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** trd_cart_info 의 복합 PK: (user_id 구매자, trade_id, ser_no). 정의서 그대로 */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class CartInfoId implements Serializable {

	private String userId;

	private String tradeId;

	private Integer serNo;

}
