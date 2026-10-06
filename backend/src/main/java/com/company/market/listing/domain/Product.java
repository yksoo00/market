package com.company.market.listing.domain;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Persistable;

/**
 * 상품마스터(TRD_PROD_MASTER). uuid 서로게이트 PK 없음 — prod_id 가 PK (decisions.md 2026-09-29).
 * PK 를 직접 채우므로(@GeneratedValue 없음) Persistable 없이는 save() 가 항상 id!=null → merge 로 가서
 * 중복 prod_id 를 UPDATE 로 조용히 덮어쓴다. Persistable.isNew() 로 진짜 신규만 INSERT(persist) 하게 한다.
 */
@Entity
@Table(name = "products")
@Getter
public class Product implements Persistable<String> {

	@Transient
	private boolean isNew = true;

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

	/** null 이 아닌 칸만 반영. 번호·제조일·사양은 "" = 비우기. 이 상품을 쓰는 매물이 하나뿐일 때만 서비스가 부른다 */
	public void applyEdit(String categoryCode, String prodNo, String prodMufcDate, String prodSpecInfo) {
		if (categoryCode != null) {
			this.categoryCode = categoryCode.trim();
		}
		if (prodNo != null) {
			this.prodNo = prodNo.isEmpty() ? null : prodNo;
		}
		if (prodMufcDate != null) {
			this.prodMufcDate = prodMufcDate.isEmpty() ? null : prodMufcDate;
		}
		if (prodSpecInfo != null) {
			this.prodSpecInfo = prodSpecInfo.isEmpty() ? null : prodSpecInfo;
		}
	}

	/** 제조일을 YYYY-MM-DD 로. 등록 API 가 형식을 검사하지 않아, 날짜로 읽히지 않는 값은 버리지 않고 원문 그대로 둔다 */
	public String mufcDateIso() {
		if (prodMufcDate == null || !prodMufcDate.matches("\\d{8}|\\d{14}")) {
			return prodMufcDate;
		}
		try {
			return LocalDate.parse(prodMufcDate.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE).toString();
		}
		catch (DateTimeParseException e) {
			return prodMufcDate;
		}
	}

	@Override
	public String getId() {
		return prodId;
	}

	@Override
	public boolean isNew() {
		return isNew;
	}

	@PostPersist
	@PostLoad
	void markNotNew() {
		this.isNew = false;
	}

}
