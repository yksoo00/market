package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import com.company.market.common.exception.ValidationException;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.dto.ListingTradeSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** 구매·견적·장바구니가 같이 쓰는 주문 입력 규칙 (수량·납품희망일). 한 곳에 둬 세 흐름이 어긋나지 않게 */
@Component
@RequiredArgsConstructor
class TradeInputRules {

	private final Clock clock;

	/** 주문량과 납품희망일 중 틀린 것을 필드 이름으로 모아 던진다 (구매·수락된 견적 구매) */
	void validate(ListingTradeSnapshot listing, int quantity, String reqDeliDate) {
		Map<String, String> failures = new LinkedHashMap<>();
		String quantityFailure = quantityFailure(listing, quantity, listing.salesUnitPrice());
		if (quantityFailure != null) {
			failures.put("orderQuantity", quantityFailure);
		}
		String dateFailure = reqDeliDateFailure(reqDeliDate);
		if (dateFailure != null) {
			failures.put("reqDeliDate", dateFailure);
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
	}

	/** 납품희망일 규칙(구매·견적·장바구니 같음): 필수(빈 값은 DTO 가 먼저 막는다), 실제 날짜, 오늘(한국) 이후. 맞으면 null */
	String reqDeliDateFailure(String reqDeliDate) {
		LocalDate date = KoreanDates.parseIso(reqDeliDate);
		if (date == null) {
			return "납품희망일이 올바른 날짜가 아닙니다.";
		}
		return date.isBefore(KoreanDates.today(clock)) ? "납품희망일은 오늘 이후 날짜로 입력하세요." : null;
	}

	/** 주문량 규칙(구매·견적·장바구니 같음). 금액은 그 거래의 단가(구매 = 등록단가, 견적 = 희망단가)로 본다. 맞으면 null */
	String quantityFailure(ListingTradeSnapshot listing, int quantity, long unitPrice) {
		int minOrder = listing.minOrderQuantity() == null ? 1 : listing.minOrderQuantity();
		int unit = listing.orderUnit() == null ? 1 : listing.orderUnit();
		if (quantity < minOrder) {
			return "최소주문량(%d) 이상 주문해 주세요.".formatted(minOrder);
		}
		if (quantity % unit != 0) {
			return "주문단위(%d)의 배수로 주문해 주세요.".formatted(unit);
		}
		// 거래이력 금액(trade_amount)이 int 라 넘는 주문은 받지 않는다 (정의서 타입 유지, 사용자 결정)
		if (unitPrice * quantity > Integer.MAX_VALUE) {
			return "한 번에 주문할 수 있는 금액을 넘었습니다.";
		}
		return null;
	}

}
