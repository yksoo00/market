package com.company.market.listing.dto;

import java.util.List;
import java.util.Map;

/**
 * 다량 등록 한 줄의 검사 결과. fields 의 키는 BulkRowDto 필드 이름, notices 는 오류는 아니지만 알려 줄 것(사진 없음 등).
 * candidates 는 마스터를 못 찾았을 때 이름이 비슷한 기존 상품(최대 5) — 고르면 그 줄의 prodId 가 된다.
 */
public record BulkRowResult(
		int rowNo,
		Status status,
		String prodId,
		String matchedName,
		List<Candidate> candidates,
		List<String> notices,
		Map<String, String> fields) {

	public enum Status { MATCHED, NEW_MASTER, FAILED }

	public record Candidate(String prodId, String prodName, String prodBrand, String prodClassNo) {
	}

}
