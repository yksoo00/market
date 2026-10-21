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
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 견적·거래 알림 메일. 커밋 뒤에만 보낸다 — 롤백된 요청(400·409)에 메일이 가지 않게.
 * 별도 스레드(`mailExecutor`)에서 보낸다: 동기로 보내면 SMTP 가 느릴 때 요청이 길어지고(견적 20건이면 메일 20통) 그동안
 * DB 커넥션을 잡으며, 멱등 키 만료(1분)가 지나 재전송이 거래를 중복 만들 수 있다 (코드리뷰 지적).
 * 어디서 실패해도(DB 조회·본문 만들기·SMTP) 업무는 이미 끝났으므로 WARN 로그만 남긴다 — 거래ID·종류·uid 만, 메일 주소는 개인정보라 쓰지 않는다.
 * TODO(메일 재시도·발송 기록 없음, 스펙 2026-10-20 범위 밖): 실패하면 그 알림은 사라진다. 필요해지면 발송 테이블로
 */
@Component
@RequiredArgsConstructor
public class TradeMailListener {

	private static final Logger log = LoggerFactory.getLogger(TradeMailListener.class);

	private final Mailer mailer;

	private final UserDirectory userDirectory;

	private final AppProperties app;

	@Async("mailExecutor")
	@TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
	public void on(TradeMailEvent e) {
		try {
			send(e);
		}
		catch (RuntimeException ex) {
			log.warn("메일 처리 실패: trade={} kind={} ({})", e.tradeId(), e.kind(), ex.getClass().getSimpleName());
		}
	}

	private void send(TradeMailEvent e) {
		Map<UUID, String> emails = userDirectory.emailsOf(List.of(e.buyerId(), e.sellerId()));
		Map<UUID, String> names = userDirectory.nicknamesOf(List.of(e.buyerId(), e.sellerId()));
		for (UUID to : recipients(e)) {
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
