package com.company.market.listing.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ProdStatesTest {

	@Test
	@DisplayName("신품이 가장 좋고 50% 미만이 가장 나쁜 7단계 순서")
	void order() {
		assertThat(ProdStates.rank("신품")).isZero();
		assertThat(ProdStates.rank("신품대비 90~99%")).isEqualTo(1);
		assertThat(ProdStates.rank("신품대비 50~59%")).isEqualTo(5);
		assertThat(ProdStates.rank("신품대비 50% 미만")).isEqualTo(6);
		assertThat(ProdStates.LABELS).hasSize(7);
	}

	@Test
	@DisplayName("목록 밖 값(레거시 자유 글)·null 은 -1, 앞뒤 공백은 무시")
	void unknown() {
		assertThat(ProdStates.rank("양호")).isEqualTo(-1);
		assertThat(ProdStates.rank(null)).isEqualTo(-1);
		assertThat(ProdStates.rank(" 신품 ")).isZero();
	}

}
