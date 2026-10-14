package com.company.market.listing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import lombok.NoArgsConstructor;
import lombok.AccessLevel;

/** 카테고리 코드(TRD_CTGR_CODE). 엑셀 시드를 마이그레이션이 넣는 읽기 전용 목록 — 코드 존재 검사와 등록 폼의 목록에 쓴다. */
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

	@Column(nullable = false)
	private String categoryDepth;

	@Column(nullable = false)
	private String categoryClass;

	/** 부모 코드의 조각(`Q01`). 대분류는 null */
	private String parentCode;

	// 컬럼이 char(1) — 스키마 검증(validate)이 varchar 로 읽지 않게 CHAR 로 매핑
	@JdbcTypeCode(SqlTypes.CHAR)
	@Column(nullable = false)
	private String isDisplay;

}
