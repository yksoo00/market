package com.company.market.trade.service;

import java.util.List;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 담은 지 1시간이 지난 장바구니 줄을 지우고 묶인 수량을 푼다 (사용자 결정 2026-11-02). 1분마다.
 * 컨테이너 둘이 동시에 돌아도 CartService.expire 가 조건부로 한 번만 풀므로 안전하다 — 상태는 DB 에만 있다(stateless).
 * 한 줄이 실패해도 나머지는 계속한다.
 */
@Component
@RequiredArgsConstructor
class CartExpiryJob {

	private static final Logger log = LoggerFactory.getLogger(CartExpiryJob.class);

	private final CartService carts;

	@Scheduled(fixedDelayString = "${app.cart.expire-interval-ms:60000}", initialDelayString = "${app.cart.expire-interval-ms:60000}")
	void run() {
		expireStale();
	}

	/** 지운 줄 수. 테스트가 시간을 옮긴 뒤 직접 부른다 */
	int expireStale() {
		int expired = 0;
		List<String> ids = carts.staleTradeIds();
		for (String id : ids) {
			try {
				if (carts.expire(id)) {
					expired++;
				}
			}
			catch (RuntimeException e) {
				log.warn("장바구니 자동 정리 실패 tradeId={}", id, e);
			}
		}
		if (expired > 0) {
			log.info("장바구니 {}줄 자동 정리", expired);
		}
		return expired;
	}

}
