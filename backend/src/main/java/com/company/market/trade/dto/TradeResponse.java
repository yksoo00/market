package com.company.market.trade.dto;

import java.util.UUID;

/**
 * 거래 한 건 (구매요청 응답·목록 항목). tradeStats 는 requested|confirmed|canceled.
 * counterpartNickname 은 보는 사람의 상대방(구매자가 보면 판매자) 닉네임 — 이메일·전화는 담지 않는다.
 * photo 는 매물 대표 사진의 공개 키만.
 */
public record TradeResponse(
		String tradeId,
		String tradeStats,
		UUID sellerId,
		String regDate,
		String prodName,
		int orderQuantity,
		int orderUnitPrice,
		long amount,
		String reqDeliDate,
		String remarks,
		String counterpartNickname,
		String photo) {
}
