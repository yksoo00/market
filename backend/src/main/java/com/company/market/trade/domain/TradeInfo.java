package com.company.market.trade.domain;

import java.util.UUID;

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
 * 거래정보(TRD_TRADE_INFO). 구매요청 1건 = 1행. user_id 는 구매자, (seller_id, reg_date) 는 매물.
 * prod_id ~ prov_date 는 요청 때 매물에서 복사한 값(스냅샷)이라 매물이 나중에 바뀌어도 그대로다.
 * PK 를 직접 채우므로 Listing 과 같은 이유로 Persistable 이 필요하다 (없으면 save 가 merge 로 가서 중복 키를 덮어쓴다).
 */
@Entity
@Table(name = "trd_trade_info")
@IdClass(TradeInfoId.class)
@Getter
public class TradeInfo implements Persistable<TradeInfoId> {

	@Transient
	private boolean isNew = true;

	@Id
	@Column(name = "user_id")
	private UUID userId;

	@Id
	@Column(name = "trade_id")
	private String tradeId;

	@Convert(converter = TradeType.DbConverter.class)
	@Column(nullable = false)
	private TradeType tradeType;

	private UUID sellerId;

	private String regDate;

	private String prodId;

	private String prodState;

	private Integer salesUnitPrice;

	private Integer stockQuantity;

	private Integer minOrderQuantity;

	private Integer orderUnit;

	private String provDate;

	@Column(nullable = false)
	private Integer orderUnitPrice;

	@Column(nullable = false)
	private Integer orderQuantity;

	@Column(nullable = false)
	private String reqDeliDate;

	private String remarks;

	@Convert(converter = TradeStats.DbConverter.class)
	@Column(nullable = false)
	private TradeStats tradeStats;

	private String spareCol;

	protected TradeInfo() {
	}

	@Builder
	private TradeInfo(UUID userId, String tradeId, TradeType tradeType, UUID sellerId, String regDate, String prodId,
			String prodState, Integer salesUnitPrice, Integer stockQuantity, Integer minOrderQuantity, Integer orderUnit,
			String provDate, Integer orderUnitPrice, Integer orderQuantity, String reqDeliDate, String remarks,
			TradeStats tradeStats) {
		this.userId = userId;
		this.tradeId = tradeId;
		this.tradeType = tradeType;
		this.sellerId = sellerId;
		this.regDate = regDate;
		this.prodId = prodId;
		this.prodState = prodState;
		this.salesUnitPrice = salesUnitPrice;
		this.stockQuantity = stockQuantity;
		this.minOrderQuantity = minOrderQuantity;
		this.orderUnit = orderUnit;
		this.provDate = provDate;
		this.orderUnitPrice = orderUnitPrice;
		this.orderQuantity = orderQuantity;
		this.reqDeliDate = reqDeliDate;
		this.remarks = remarks;
		this.tradeStats = tradeStats;
	}

	@Override
	public TradeInfoId getId() {
		return new TradeInfoId(userId, tradeId);
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
