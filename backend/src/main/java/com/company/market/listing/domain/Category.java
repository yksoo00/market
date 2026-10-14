package com.company.market.listing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.AccessLevel;

/** 카테고리 코드(TRD_CTGR_CODE). 엑셀 시드를 마이그레이션이 넣는 읽기 전용 목록 — 코드 존재 검사에만 쓴다. */
@Entity
@Table(name = "trd_ctgr_code")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Category {

	@Id
	@Column(name = "category_code")
	private String categoryCode;

	@Column(nullable = false)
	private String categoryName;

}
