package com.company.market.listing.domain;

import java.io.Serializable;
import java.util.UUID;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/** listings 의 복합 PK: (user_id, reg_date). uuid 서로게이트 PK 없음 (decisions.md 2026-09-29) */
@EqualsAndHashCode
@NoArgsConstructor
@AllArgsConstructor
public class ListingId implements Serializable {

	private UUID userId;

	private String regDate;

}
