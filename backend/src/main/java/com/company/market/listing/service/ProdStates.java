package com.company.market.listing.service;

import java.util.List;

/**
 * 상품상태 7단계와 좋은 순서 (신품이 가장 좋다). 대량구매의 "최소 상태" 비교가 쓴다 — 프론트 PROD_STATES·서버 PROD_STATE_PATTERN 과 같은 문구.
 * 레거시 매물에는 이 목록 밖의 자유 글이 있을 수 있어 그런 값은 순서를 알 수 없다(-1)
 */
public final class ProdStates {

	/** 좋은 것부터 */
	public static final List<String> LABELS = List.of("신품", "신품대비 90~99%", "신품대비 80~89%", "신품대비 70~79%", "신품대비 60~69%",
			"신품대비 50~59%", "신품대비 50% 미만");

	private ProdStates() {
	}

	/** 0 = 신품(가장 좋음) … 6 = 50% 미만. 목록 밖이거나 null 이면 -1 */
	public static int rank(String state) {
		return state == null ? -1 : LABELS.indexOf(state.trim());
	}

}
