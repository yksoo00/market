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
 * 거래이력(TRD_TRADE_HISTORY). 구매확정된 거래만 1줄 — 취소는 쌓지 않는다. PK 는 정의서 (user_id 구매자, trade_id, trade_date)
 * (2026-10-27). PK 직접 채움이라 Persistable (TradeInfo 와 같은 이유)
 */
@Entity
@Table(name = "trd_trade_history")
@IdClass(TradeHistoryId.class)
@Getter
public class TradeHistory implements Persistable<TradeHistoryId> {

	@Transient
	private boolean isNew = true;

	/** 구매자 */
	@Id
	@Column(name = "user_id")
	private String userId;

	@Id
	@Column(name = "trade_id")
	private String tradeId;

	@Id
	@Column(name = "trade_date")
	private String tradeDate;

	@Column(nullable = false)
	private String prodId;

	@Convert(converter = TradeType.DbConverter.class)
	@Column(nullable = false)
	private TradeType tradeType;

	@Column(nullable = false)
	private String sellerId;

	private Integer tradeUnitPrice;

	private Integer tradeQuantity;

	private Integer tradeAmount;

	private String spareCol;

	protected TradeHistory() {
	}

	@Builder
	private TradeHistory(String userId, String tradeId, String tradeDate, String prodId, TradeType tradeType, String sellerId,
			Integer tradeUnitPrice, Integer tradeQuantity, Integer tradeAmount) {
		this.userId = userId;
		this.tradeId = tradeId;
		this.tradeDate = tradeDate;
		this.prodId = prodId;
		this.tradeType = tradeType;
		this.sellerId = sellerId;
		this.tradeUnitPrice = tradeUnitPrice;
		this.tradeQuantity = tradeQuantity;
		this.tradeAmount = tradeAmount;
	}

	@Override
	public TradeHistoryId getId() {
		return new TradeHistoryId(userId, tradeId, tradeDate);
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
