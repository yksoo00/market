package com.company.market.listing.dto;

/**
 * 엑셀 대량구매의 조건 판정에 쓰는 매물 특성. 증빙은 **있는지만** 담는다 — 파일 키·URL 은 넣지 않는다(비공개 파일 키 노출 방지).
 * warrantyDays 는 보증기한(일), 보증이 없으면 null
 */
public record ListingTraits(String prodState, Integer warrantyDays, boolean hasDataSheet, boolean hasPhoto, boolean hasWarrantyCoverage,
		boolean hasTestReport, boolean hasCertificate) {
}
