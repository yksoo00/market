package com.company.market.listing.domain;

import java.util.List;
import java.util.UUID;

import com.company.market.listing.dto.ListingUpdateRequest;
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

	/** null 이 아닌 필드만 반영 (PATCH 부분수정). 상품마스터용 필드는 대상 아님 */
	public void applyUpdate(ListingUpdateRequest req, String dtUpdate) {
		if (req.tradeType() != null) {
			this.tradeType = req.tradeType();
		}
		if (req.prodState() != null) {
			this.prodState = req.prodState();
		}
		if (req.salesUnitPrice() != null) {
			this.salesUnitPrice = req.salesUnitPrice();
		}
		if (req.salesQuantity() != null) {
			this.salesQuantity = req.salesQuantity();
		}
		if (req.minOrderQuantity() != null) {
			this.minOrderQuantity = req.minOrderQuantity();
		}
		if (req.orderUnit() != null) {
			this.orderUnit = req.orderUnit();
		}
		if (req.deliveryDate() != null) {
			this.deliveryDate = req.deliveryDate();
		}
		if (req.stockQuantity() != null) {
			this.stockQuantity = req.stockQuantity();
		}
		if (req.description() != null) {
			this.prodDescription = req.description();
		}
		if (req.listingDataSheet() != null) {
			this.prodDataSheet = req.listingDataSheet();
		}
		if (req.photos() != null) {
			this.prodPhoto1 = photoAt(req.photos(), 0);
			this.prodPhoto2 = photoAt(req.photos(), 1);
			this.prodPhoto3 = photoAt(req.photos(), 2);
			this.prodImage4 = photoAt(req.photos(), 3);
		}
		if (req.warrantyPeriod() != null) {
			this.warrantyPeriod = req.warrantyPeriod();
		}
		if (req.warrantyCoverage() != null) {
			this.warrantyCoverage = req.warrantyCoverage();
		}
		if (req.replaceProd() != null) {
			this.replaceProd = req.replaceProd();
		}
		if (req.testReport() != null) {
			this.testReport = req.testReport();
		}
		if (req.certificateOfAuthen() != null) {
			this.certificateOfAuthen = req.certificateOfAuthen();
		}
		this.dtUpdate = dtUpdate;
	}

	private static String photoAt(List<String> photos, int index) {
		return index < photos.size() ? photos.get(index) : null;
	}

}
