package com.company.market.trade.dto;

import java.util.UUID;

/**
 * 거래 한 건 (요청 응답·목록 항목). tradeType 은 quote|purchase, tradeStats 는 quoteRequested|quoteReplied|requested|confirmed.
 * salesUnitPrice 는 요청 때 등록단가, orderUnitPrice 는 거래 단가(견적이면 희망단가). reqDeliDate 는 견적이면 null.
 * counterpartNickname 은 보는 사람의 상대방(구매자가 보면 판매자) 닉네임 — 이메일·전화는 담지 않는다.
 * photo 는 매물 대표 사진의 공개 키만.
 */
public record TradeResponse(
		String tradeId,
		String tradeType,
		String tradeStats,
		UUID sellerId,
		String regDate,
		String prodName,
		int orderQuantity,
		Integer salesUnitPrice,
		int orderUnitPrice,
		long amount,
		String reqDeliDate,
		String remarks,
		String counterpartNickname,
		String photo) {
}
