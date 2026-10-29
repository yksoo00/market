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
@Table(name = "trd_prod_master")
@Getter
public class Product implements Persistable<String> {

	@Transient
	private boolean isNew = true;

	@Id
	@Column(name = "prod_id")
	private String prodId;

	/** 카테고리 조각(대·중·소). 이름·부모는 trd_ctgr_master */
	private String majorCategory;

	private String middleCategory;

	private String minorCategory;

	private String prodName;

	@Column(name = "prod_part_no")
	private String prodNo;

	private String prodBrand;

	private String prodClassNo;

	/** 보증년수 — 값은 개월 수 (사용자 결정 2026-10-28, 목록 3·6·…·60) */
	private Integer prodUsefulLife;

	private String warrantyMethod;

	private String alterProdName;

	private String prodMufcDate;

	private String prodSpecInfo;

	private String prodDataSheet;

	@Column(name = "prod_image")
	private String prodPhoto1;

	private String regDate;

	private String spareCol;

	protected Product() {
	}

	@Builder
	private Product(String prodId, String majorCategory, String middleCategory, String minorCategory,
			String prodName, String prodNo, String prodBrand, String prodClassNo, Integer prodUsefulLife,
			String warrantyMethod, String alterProdName, String prodMufcDate, String prodSpecInfo, String prodDataSheet,
			String prodPhoto1, String regDate, String spareCol) {
		this.prodId = prodId;
		this.majorCategory = majorCategory;
		this.middleCategory = middleCategory;
		this.minorCategory = minorCategory;
		this.prodName = prodName;
		this.prodNo = prodNo;
		this.prodBrand = prodBrand;
		this.prodClassNo = prodClassNo;
		this.prodUsefulLife = prodUsefulLife;
		this.warrantyMethod = warrantyMethod;
		this.alterProdName = alterProdName;
		this.prodMufcDate = prodMufcDate;
		this.prodSpecInfo = prodSpecInfo;
		this.prodDataSheet = prodDataSheet;
		this.prodPhoto1 = prodPhoto1;
		this.regDate = regDate;
		this.spareCol = spareCol;
	}

	/** null 이 아닌 칸만 반영. 카테고리는 확인된 조각(CategoryService). 번호·제조일·사양은 "" = 비우기. 이 상품을 쓰는 매물이 하나뿐일 때만 서비스가 부른다 */
	public void applyEdit(CategoryFragments category, String prodNo, String prodMufcDate, String prodSpecInfo) {
		if (category != null) {
			this.majorCategory = category.major();
			this.middleCategory = category.middle();
			this.minorCategory = category.minor();
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

	public CategoryFragments category() {
		return new CategoryFragments(majorCategory, middleCategory, minorCategory);
	}

	/** 화면·API 의 카테고리 코드 = 조각을 '-' 로 이은 경로 (P01-Q01-R001) */
	public String getCategoryCode() {
		return category().code();
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
