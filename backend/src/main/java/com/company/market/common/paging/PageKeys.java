package com.company.market.common.paging;

import java.util.List;
import java.util.Map;

import com.company.market.common.exception.ValidationException;

/**
 * 페이지 번호 목록의 경계 계산 (설계 2026-10-27 PR 5). offset 을 쓰지 않는다 — 같은 조건의 정렬 키를 순서대로 모두 받아
 * 전체 건수와 "page 쪽의 바로 앞 줄 키"를 구하고, 호출자가 그 키 다음부터 키셋으로 size 줄을 읽는다.
 * 조건에 맞는 행의 키를 전부 훑으므로 건수 세기와 비슷한 비용이다(수만 건을 넘어 느려지면 다시 본다, decisions.md 2026-10-29).
 */
public record PageKeys<K>(int page, int totalPages, long total, K after) {

	/** orderedKeys = 정렬 순서대로 전체 키. page 는 1부터, 범위 밖이면 400 (결과가 비어도 1페이지는 있다). after = 1페이지면 null */
	public static <K> PageKeys<K> of(List<K> orderedKeys, int page, int size) {
		int totalPages = Math.max(1, (orderedKeys.size() + size - 1) / size);
		if (page < 1 || page > totalPages) {
			throw new ValidationException(Map.of("page", "page 는 1 이상 " + totalPages + " 이하여야 합니다."));
		}
		return new PageKeys<>(page, totalPages, orderedKeys.size(), page == 1 ? null : orderedKeys.get((page - 1) * size - 1));
	}

}
