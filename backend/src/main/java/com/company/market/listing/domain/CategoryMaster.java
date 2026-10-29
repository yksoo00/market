package com.company.market.listing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 카테고리 마스터(TRD_CTGR_MASTER). 코드는 조각(R001) 하나, 부모는 부모 조각(대분류는 null).
 * 마이그레이션이 trd_ctgr_code 에서 옮긴 읽기 전용 목록 — 상품마스터 조각의 확인·이름 경로에 쓴다 (2026-10-27 설계 PR 2)
 */
@Entity
@Table(name = "trd_ctgr_master")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CategoryMaster {

	@Id
	@Column(name = "category_code")
	private String categoryCode;

	@Column(nullable = false)
	private String categoryName;

	/** 분류레벨 대·중·소 */
	@Column(nullable = false)
	private String categoryDepth;

	private String parentCode;

	// 컬럼이 char(1) — 스키마 검증(validate)이 varchar 로 읽지 않게 CHAR 로 매핑
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(nullable = false)
	private String isDisplay;

}
