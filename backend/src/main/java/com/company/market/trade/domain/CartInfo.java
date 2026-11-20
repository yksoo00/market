package com.company.market.trade.domain;


import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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
 * 장바구니 정보(TRD_CART_INFO). 장바구니·비교 한 건 = trd_trade_info 1행 + 이 1행(같은 거래ID, 설계 2026-10-27 PR 3).
 * 상품 값(prod_name 등)은 담을 때 복사한 값이고, 화면은 지금 매물 값을 따로 읽는다. 매물은 (seller_id, prod_date, prod_no) 로 찾는다.
 * PK 를 직접 채우므로 Listing 과 같은 이유로 Persistable.
 */
@Entity
@Table(name = "trd_cart_info")
@IdClass(CartInfoId.class)
@Getter
public class CartInfo implements Persistable<CartInfoId> {

	@Transient
	private boolean isNew = true;

	@Id
	@Column(name = "user_id")
	private String userId;

	@Id
	@Column(name = "trade_id")
	private String tradeId;

	@Id
	@Column(name = "ser_no")
	private Integer serNo;

	@Convert(converter = CartType.DbConverter.class)
	private CartType cartType;

	private String sellerId;

	@Column(nullable = false)
	private String prodDate;

	@Column(nullable = false)
	private String prodName;

	@Column(nullable = false)
	private String prodNo;

	private String manufacturer;

	@Column(nullable = false)
	private String prodSpecInfo;

	@Column(nullable = false)
	private String prodState;

	@Column(nullable = false)
	private String provDate;

	@Column(nullable = false)
	private Integer orderUnitPrice;

	@Column(nullable = false)
	private Integer orderQuantity;

	@Column(nullable = false)
	private String reqDeliDate;

	private String remarks;

	@Column(nullable = false)
	private String regDate;

	protected CartInfo() {
	}

	@Builder
	private CartInfo(String userId, String tradeId, Integer serNo, CartType cartType, String sellerId, String prodDate,
			String prodName, String prodNo, String manufacturer, String prodSpecInfo, String prodState,
			String provDate, Integer orderUnitPrice, Integer orderQuantity, String reqDeliDate, String remarks,
			String regDate) {
		this.userId = userId;
		this.tradeId = tradeId;
		this.serNo = serNo;
		this.cartType = cartType;
		this.sellerId = sellerId;
		this.prodDate = prodDate;
		this.prodName = prodName;
		this.prodNo = prodNo;
		this.manufacturer = manufacturer;
		this.prodSpecInfo = prodSpecInfo;
		this.prodState = prodState;
		this.provDate = provDate;
		this.orderUnitPrice = orderUnitPrice;
		this.orderQuantity = orderQuantity;
		this.reqDeliDate = reqDeliDate;
		this.remarks = remarks;
		this.regDate = regDate;
	}

	@Override
	public CartInfoId getId() {
		return new CartInfoId(userId, tradeId, serNo);
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
