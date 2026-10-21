package com.company.market.trade.service;

import java.util.Locale;

/** 견적·거래 알림 메일의 제목·본문 (한 곳). 상대 연락처는 넣지 않는다 — 처리는 화면 링크로 */
final class TradeMailComposer {

	private TradeMailComposer() {
	}

	record Mail(String subject, String body) {
	}

	/** toSeller: 받는 사람이 판매자인가 (링크·문구가 갈린다). counterpart: 상대 표시 이름(없으면 null) */
	static Mail compose(TradeMailEvent e, boolean toSeller, String counterpart, String appUrl) {
		String who = counterpart == null ? "상대방" : counterpart;
		String link = appUrl + (toSeller ? "/my/sales" : "/my/purchases");
		String item = "상품: %s\n수량: %s개\n".formatted(e.prodName(), won(e.quantity()));
		return switch (e.kind()) {
			case QUOTE_REQUESTED -> new Mail("[커널마켓] 견적 요청이 왔어요 — " + e.prodName(),
					"%s 님이 견적을 요청했어요.\n\n%s등록단가: %s원\n희망단가: %s원\n\n수락하면 매물 단가가 희망단가로 바뀌어요.\n받은 구매요청에서 수락·거절: %s\n"
						.formatted(who, item, won(e.salesUnitPrice()), won(e.unitPrice()), link));
			case QUOTE_ACCEPTED -> new Mail("[커널마켓] 견적이 수락됐어요 — " + e.prodName(),
					// 매물이 이미 희망단가보다 싸면 단가는 안 바뀐다 — 금액을 단정하지 않고 "희망단가 이하"로
					"%s 님이 견적을 수락했어요. 매물 단가가 희망단가(%s원) 이하로 맞춰졌어요.\n\n%s\n내 구매목록에서 [구매]로 살 수 있어요: %s\n"
						.formatted(who, won(e.unitPrice()), item, link));
			case QUOTE_REJECTED -> new Mail("[커널마켓] 견적이 거절됐어요 — " + e.prodName(),
					"%s 님이 견적을 거절했어요. 매물 단가는 그대로예요.\n\n%s희망단가: %s원\n\n내 구매목록: %s\n"
						.formatted(who, item, won(e.unitPrice()), link));
			case QUOTE_CANCELED -> new Mail("[커널마켓] 견적 요청이 취소됐어요 — " + e.prodName(),
					"%s 님이 견적 요청을 취소했어요.\n\n%s희망단가: %s원\n".formatted(who, item, won(e.unitPrice())));
			case PURCHASE_REQUESTED -> new Mail("[커널마켓] 구매요청이 왔어요 — " + e.prodName(),
					"%s 님이 구매를 요청했어요. 재고는 이미 줄었어요.\n\n%s단가: %s원\n\n받은 구매요청: %s\n"
						.formatted(who, item, won(e.unitPrice()), link));
			case PURCHASE_CANCELED -> new Mail("[커널마켓] 거래가 취소됐어요 — " + e.prodName(),
					"%s 님이 거래를 취소했어요.\n\n%s단가: %s원\n\n%s\n".formatted(who, item, won(e.unitPrice()), link));
			case PURCHASE_CONFIRMED -> new Mail("[커널마켓] 거래가 완료됐어요 — " + e.prodName(),
					"구매자가 거래완료를 눌러 거래가 확정됐어요. 상대: %s\n\n%s단가: %s원\n금액: %s원\n\n%s\n".formatted(who, item,
							won(e.unitPrice()), won((long) e.unitPrice() * e.quantity()), link));
		};
	}

	private static String won(Number n) {
		return n == null ? "-" : String.format(Locale.KOREA, "%,d", n.longValue());
	}

}
