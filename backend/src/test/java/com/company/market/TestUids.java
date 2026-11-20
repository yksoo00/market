package com.company.market;

import java.util.concurrent.ThreadLocalRandom;

/** 테스트용 가짜 사용자 식별자 — 실제 uid 와 같은 11자(UP + yyMMdd + 3자리)지만 접두사를 달리해(UT) 서로·실제와 겹치지 않는다 */
public final class TestUids {

	private TestUids() {
	}

	public static String random() {
		return "UT%09d".formatted(ThreadLocalRandom.current().nextLong(1_000_000_000L));
	}

}
