package com.company.market.trade.dto;

import java.util.List;

/**
 * 내가 받은 견적요청(견적요청 상태) — 판매자가 한 모달에서 한꺼번에 처리하는 목록. 오래된 요청부터 최대 30건이고 total 은 전체 건수.
 * stockQuantity 는 그 매물의 지금 재고(수락하면 묶이는 수량과 견주어 보라고). 구매자는 닉네임만 — 이메일·전화는 담지 않는다
 */
public record QuoteRequestListResponse(List<Item> items, long total) {

	public record Item(
			String tradeId,
			String regDate,
			String prodName,
			String buyerNickname,
			int orderQuantity,
			Integer salesUnitPrice,
			int orderUnitPrice,
			long amount,
			String reqDeliDate,
			String remarks,
			Integer stockQuantity) {
	}

}
