package com.company.market.listing.dto;

/**
 * 엑셀 대량구매의 조건 판정에 쓰는 매물 특성. 증빙은 **있는지만** 담는다 — 파일 키·URL 은 넣지 않는다(비공개 파일 키 노출 방지). 불량지원방법(warrantyCoverage)은 파일이 아니라 짧은 글(대체/환불)이라 글 그대로, 없으면 null.
 * warrantyDays 는 보증기한(일), 보증이 없으면 null
 */
public record ListingTraits(String prodState, Integer warrantyDays, boolean hasDataSheet, boolean hasPhoto, String warrantyCoverage,
		boolean hasTestReport, boolean hasCertificate) {
}
