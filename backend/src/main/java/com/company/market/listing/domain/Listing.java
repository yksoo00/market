package com.company.market.listing.domain;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import com.company.market.listing.dto.ListingUpdateRequest;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Builder;
import lombok.Getter;
import org.springframework.data.domain.Persistable;

/**
 * 상품등록정보(TRD_REG_INFO). uuid 서로게이트 PK 없음 — (user_id, reg_date) 복합 PK (decisions.md 2026-09-29).
 * PK 를 직접 채우므로(@GeneratedValue 없음) Persistable 없이는 save() 가 항상 id!=null → merge 로 가서
 * 같은 초 중복 등록을 INSERT 충돌이 아니라 UPDATE 로 조용히 덮어쓴다. Persistable.isNew() 로 진짜 신규만 INSERT(persist) 하게 한다.
 */
@Entity
@Table(name = "listings")
@IdClass(ListingId.class)
@Getter
public class Listing implements Persistable<ListingId> {

	@Transient
	private boolean isNew = true;

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
			this.deliveryDate = emptyToNull(req.deliveryDate());
		}
		if (req.stockQuantity() != null) {
			this.stockQuantity = req.stockQuantity();
		}
		if (req.description() != null) {
			this.prodDescription = req.description();
		}
		if (req.listingDataSheet() != null) {
			this.prodDataSheet = emptyToNull(req.listingDataSheet());
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
			this.warrantyCoverage = emptyToNull(req.warrantyCoverage());
		}
		if (req.replaceProd() != null) {
			this.replaceProd = emptyToNull(req.replaceProd());
		}
		if (req.testReport() != null) {
			this.testReport = emptyToNull(req.testReport());
		}
		if (req.certificateOfAuthen() != null) {
			this.certificateOfAuthen = emptyToNull(req.certificateOfAuthen());
		}
		this.dtUpdate = dtUpdate;
	}

	/** 파일 칸은 null = 안 바꿈, "" = 비우기 (PATCH 에서 null 과 생략을 구분하지 않으므로, decisions.md 2026-10-02) */
	private static String emptyToNull(String value) {
		return value.isEmpty() ? null : value;
	}

	private static String photoAt(List<String> photos, int index) {
		return index < photos.size() ? photos.get(index) : null;
	}

	/** 거래 흐름이 정해지기 전까지 거래완료일시 유무로만 판단 (decisions.md 2026-10-01 검색 결과) */
	public String tradeStatus() {
		return dtExpire == null ? "available" : "completed";
	}

	/** 판매정보 추가등록 5칸(보증기간·불량지원·대체품·테스트리포트·인증서) 중 채운 개수. 보증 0일(없음)은 보여 줄 정보가 없어 센 것에서 뺀다 */
	public int extraFilledCount() {
		return (int) Stream.<Object>of(warrantyPeriod, warrantyCoverage, replaceProd, testReport, certificateOfAuthen)
			.filter(v -> v != null && !Integer.valueOf(0).equals(v) && !(v instanceof String s && s.isBlank()))
			.count();
	}

	/** DB 는 보증 일수만 갖고 있어 등록일 + 일수로 만료일(YYYY-MM-DD)을 계산한다 */
	public String warrantyUntil() {
		if (warrantyPeriod == null) {
			return null;
		}
		return LocalDate.parse(regDate.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE).plusDays(warrantyPeriod).toString();
	}

	@Override
	public ListingId getId() {
		return new ListingId(userId, regDate);
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
