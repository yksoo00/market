package com.company.market.trade.service;

import java.util.Comparator;
import java.util.function.Function;

/** 거래 목록(거래이력·활동내역)의 키 정렬 도우미 — 키(Object[])의 한 칸을 값으로 보고 열 하나의 순서를 만든다 (열 머리 정렬 2026-11-03) */
final class TradeKeySorting {

	private TradeKeySorting() {
	}

	/** 열 하나의 순서. 값이 비어 있으면 오름·내림 모두 맨 뒤로 */
	static <T> Comparator<Object[]> columnOrder(Function<Object[], T> value, Comparator<T> order, boolean desc) {
		return (a, b) -> {
			T x = value.apply(a);
			T y = value.apply(b);
			if (x == null || y == null) {
				return x == null ? (y == null ? 0 : 1) : -1;
			}
			int c = order.compare(x, y);
			return desc ? -c : c;
		};
	}

}
