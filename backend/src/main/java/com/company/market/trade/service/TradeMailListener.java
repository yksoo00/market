package com.company.market.trade.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.config.AppProperties;
import com.company.market.common.mail.Mailer;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 견적·거래 알림 메일. 커밋 뒤에만 보낸다 — 롤백된 요청(400·409)에 메일이 가지 않게.
 * 메일이 실패해도 업무는 이미 끝났으므로 WARN 로그만 (거래ID·받는 uid — 메일 주소는 개인정보라 쓰지 않는다).
 * TODO(메일 재시도·발송 기록 없음, 스펙 2026-10-20 범위 밖): 실패하면 그 알림은 사라진다. 필요해지면 발송 테이블로
 */
@Component
@RequiredArgsConstructor
class TradeMailListener {

	private static final Logger log = LoggerFactory.getLogger(TradeMailListener.class);

	private final Mailer mailer;

	private final UserDirectory userDirectory;

	private final AppProperties app;

	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	void on(TradeMailEvent e) {
		List<UUID> recipients = recipients(e);
		Map<UUID, String> emails = userDirectory.emailsOf(List.of(e.buyerId(), e.sellerId()));
		Map<UUID, String> names = userDirectory.nicknamesOf(List.of(e.buyerId(), e.sellerId()));
		for (UUID to : recipients) {
			String address = emails.get(to);
			if (address == null) {
				log.info("메일 건너뜀(이메일 없음): trade={} to={}", e.tradeId(), to);
				continue;
			}
			boolean toSeller = to.equals(e.sellerId());
			UUID other = toSeller ? e.buyerId() : e.sellerId();
			TradeMailComposer.Mail mail = TradeMailComposer.compose(e, toSeller, names.get(other), app.appUrl());
			try {
				mailer.send(address, mail.subject(), mail.body());
			}
			catch (RuntimeException ex) {
				log.warn("메일 발송 실패: trade={} kind={} to={} ({})", e.tradeId(), e.kind(), to, ex.getClass().getSimpleName());
			}
		}
	}

	private static List<UUID> recipients(TradeMailEvent e) {
		return switch (e.kind()) {
			case QUOTE_REQUESTED, QUOTE_CANCELED, PURCHASE_REQUESTED -> List.of(e.sellerId());
			case QUOTE_ACCEPTED, QUOTE_REJECTED -> List.of(e.buyerId());
			case PURCHASE_CANCELED -> List.of(e.buyerId().equals(e.actorId()) ? e.sellerId() : e.buyerId());
			case PURCHASE_CONFIRMED -> List.of(e.sellerId(), e.buyerId());
		};
	}

}
