package com.company.market.trade.dto;

import java.util.List;
import java.util.Map;

import com.company.market.listing.dto.ListingTraits;

/**
 * 엑셀 대량구매 한 줄의 검사 결과 (계획 2026-11-09-bulk-purchase-excel.md). fields 의 키는 CartBulkRowDto 필드 이름 + 고른 매물의 사유(listing).
 * options 는 그 마스터의 모든 매물 — 못 사는 매물도 reason(사유)과 함께 남는다(reason 이 null 이면 살 수 있음).
 * alternatives 는 마스터의 대체상품명과 이름이 같은 마스터의 매물(제안일 뿐, 자동으로 고르지 않는다).
 */
public record CartBulkRowResult(
		int rowNo,
		Status status,
		String prodId,
		String matchedName,
		ListingOption chosen,
		List<ListingOption> options,
		List<Alternative> alternatives,
		List<Candidate> candidates,
		List<String> notices,
		Map<String, String> fields,
		boolean substituted) {

	/** AVAILABLE = 살 매물이 골라져 있음, UNAVAILABLE = 마스터는 있는데 살 수 있는 매물이 없음, FAILED = 입력 오류·상품 못 찾음·고른 매물이 못 사게 바뀜 */
	public enum Status { AVAILABLE, UNAVAILABLE, FAILED }

	/** 매물 한 건. sellerId 는 UUID 글자. 판매자는 별명만 (이메일·전화는 없다). traits 는 상태·보증일·증빙 유무(파일 키 없음) */
	public record ListingOption(
			String sellerId,
			String regDate,
			String sellerNickname,
			int unitPrice,
			int stock,
			int minOrder,
			int orderUnit,
			String deliveryDate,
			String replaceHint,
			String reason,
			ListingTraits traits) {
	}

	public record Alternative(String prodId, String prodName, String prodBrand, List<ListingOption> options) {
	}

	public record Candidate(String prodId, String prodName, String prodBrand, String prodClassNo) {
	}

}
