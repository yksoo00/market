package com.company.market.listing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/** 상품마스터(TRD_PROD_MASTER). uuid 서로게이트 PK 없음 — prod_id 가 PK (decisions.md 2026-09-29) */
@Entity
@Table(name = "products")
@Getter
public class Product {

	@Id
	@Column(name = "prod_id")
	private String prodId;

	@Column(nullable = false)
	private String categoryCode;

	@Column(nullable = false)
	private String prodName;

	private String prodNo;

	@Column(nullable = false)
	private String prodBrand;

	private String prodMufcDate;

	private String prodSpecInfo;

	private String prodDataSheet;

	@Column(name = "prod_photo_1")
	private String prodPhoto1;

	@Column(nullable = false)
	private String regDate;

	private String spareCol;

	protected Product() {
	}

	@Builder
	private Product(String prodId, String categoryCode, String prodName, String prodNo, String prodBrand,
			String prodMufcDate, String prodSpecInfo, String prodDataSheet, String prodPhoto1, String regDate,
			String spareCol) {
		this.prodId = prodId;
		this.categoryCode = categoryCode;
		this.prodName = prodName;
		this.prodNo = prodNo;
		this.prodBrand = prodBrand;
		this.prodMufcDate = prodMufcDate;
		this.prodSpecInfo = prodSpecInfo;
		this.prodDataSheet = prodDataSheet;
		this.prodPhoto1 = prodPhoto1;
		this.regDate = regDate;
		this.spareCol = spareCol;
	}

}
