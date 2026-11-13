package com.company.market.trade.dto;

import java.util.List;
import java.util.Map;

import com.company.market.listing.dto.ListingTraits;

/**
 * 엑셀 대량구매 한 줄의 검사 결과 (계획 2026-11-09-bulk-purchase-excel.md). fields 의 키는 CartBulkRowDto 필드 이름 + 고른 매물의 사유(listing).
 * options 는 그 마스터의 모든 매물 — 고정 순서(단가 → 보증 → 상태 → 제공가능일 → 재고 → 등록일시)로 정렬되어 오고, 못 사는 매물도 reason(사유)과 함께 남는다(reason 이 null 이면 살 수 있음).
 * alternatives 는 마스터의 대체상품명과 이름이 같은 마스터의 매물(제안일 뿐, 자동으로 고르지 않는다). prodId·matchedName 은 상품이 **하나로 정해졌을 때만** 채워지고(이름이 같은 마스터가 여럿이면 null),
 * masterCount 는 찾은 서로 다른 상품 수 — options 는 그 상품들의 매물을 합친 것이고 각 매물이 자기 상품(prodId·prodName·prodBrand·prodClassNo)을 가진다.
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
		boolean substituted,
		int masterCount) {

	/**
	 * AVAILABLE = 살 매물이 골라져 있음(사용자가 골랐거나, 조건에 맞는 매물이 딱 하나라 미리 골라짐), CHOOSE = 고를 수 있는 매물이 있는데 아직 안 골랐음
	 * (맞는 매물이 여럿이거나 조건과 다른 매물뿐 — 사용자가 고른다), UNAVAILABLE = 마스터는 있는데 고를 수 있는 매물이 하나도 없음,
	 * FAILED = 입력 오류·상품 못 찾음·고른 매물이 못 사게 바뀜
	 */
	public enum Status { AVAILABLE, CHOOSE, UNAVAILABLE, FAILED }

	/**
	 * 매물 한 건. sellerId 는 UUID 글자. 판매자는 별명만 (이메일·전화는 없다). traits 는 상태·보증일·증빙 유무(파일 키 없음).
	 * reason 은 **하드 막힘**(거래완료·내 매물·재고·최소주문량·주문단위 — 담기가 거절해서 못 고름, null 이면 살 수 있음),
	 * mismatches 는 **조건과 다른 점**(상태·단가·보증·서류·제공가능일 — 사용자가 알고 고를 수 있음, 기본 매물로는 안 뽑힘)
	 */
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
			List<String> mismatches,
			ListingTraits traits,
			String prodId,
			String prodName,
			String prodBrand,
			String prodClassNo) {
	}

	public record Alternative(String prodId, String prodName, String prodBrand, List<ListingOption> options) {
	}

	public record Candidate(String prodId, String prodName, String prodBrand, String prodClassNo) {
	}

}
