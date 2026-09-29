package com.company.market.listing.domain;

import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.Builder;
import lombok.Getter;

/** 상품등록정보(TRD_REG_INFO). uuid 서로게이트 PK 없음 — (user_id, reg_date) 복합 PK (decisions.md 2026-09-29) */
@Entity
@Table(name = "listings")
@IdClass(ListingId.class)
@Getter
public class Listing {

	@Id
	@Column(name = "user_id")
	private UUID userId;

	@Id
	@Column(name = "reg_date")
	private String regDate;

	@Column(nullable = false)
	private String prodId;

	@Column(nullable = false)
	private String tradeType;

	@Column(nullable = false)
	private String prodState;

	@Column(nullable = false)
	private Integer salesUnitPrice;

	@Column(nullable = false)
	private Integer salesQuantity;

	@Column(nullable = false)
	private Integer minOrderQuantity;

	@Column(nullable = false)
	private Integer orderUnit;

	private String deliveryDate;

	private Integer stockQuantity;

	private String prodDescription;

	private String prodDataSheet;

	@Column(name = "prod_photo_1")
	private String prodPhoto1;

	@Column(name = "prod_photo_2")
	private String prodPhoto2;

	@Column(name = "prod_photo_3")
	private String prodPhoto3;

	@Column(name = "prod_image_4")
	private String prodImage4;

	private Integer warrantyPeriod;

	private String warrantyCoverage;

	private String replaceProd;

	private String testReport;

	private String certificateOfAuthen;

	private String dtUpdate;

	private String dtExpire;

	private String spareCol;

	protected Listing() {
	}

	@Builder
	private Listing(UUID userId, String regDate, String prodId, String tradeType, String prodState,
			Integer salesUnitPrice, Integer salesQuantity, Integer minOrderQuantity, Integer orderUnit,
			String deliveryDate, Integer stockQuantity, String prodDescription, String prodDataSheet,
			String prodPhoto1, String prodPhoto2, String prodPhoto3, String prodImage4, Integer warrantyPeriod,
			String warrantyCoverage, String replaceProd, String testReport, String certificateOfAuthen,
			String spareCol) {
		this.userId = userId;
		this.regDate = regDate;
		this.prodId = prodId;
		this.tradeType = tradeType;
		this.prodState = prodState;
		this.salesUnitPrice = salesUnitPrice;
		this.salesQuantity = salesQuantity;
		this.minOrderQuantity = minOrderQuantity;
		this.orderUnit = orderUnit;
		this.deliveryDate = deliveryDate;
		this.stockQuantity = stockQuantity;
		this.prodDescription = prodDescription;
		this.prodDataSheet = prodDataSheet;
		this.prodPhoto1 = prodPhoto1;
		this.prodPhoto2 = prodPhoto2;
		this.prodPhoto3 = prodPhoto3;
		this.prodImage4 = prodImage4;
		this.warrantyPeriod = warrantyPeriod;
		this.warrantyCoverage = warrantyCoverage;
		this.replaceProd = replaceProd;
		this.testReport = testReport;
		this.certificateOfAuthen = certificateOfAuthen;
		this.spareCol = spareCol;
	}

}
