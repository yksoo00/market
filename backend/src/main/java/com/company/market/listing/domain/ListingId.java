package com.company.market.listing.domain;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * trd_prod_reg 의 정의서 복합 PK: (user_id, reg_date, prod_id) (2026-10-27). 거래가 매물을 찾는 키이기도 하다 —
 * 거래 행의 (seller_id, prod_reg_date, prod_id).
 */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
@Getter
public class ListingId implements Serializable {

	private String userId;

	private String regDate;

	private String prodId;

}
