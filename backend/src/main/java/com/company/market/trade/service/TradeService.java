package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.dto.TradeResponse;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


/**
 * 직접 구매 (스펙 2026-10-15-purchase-design.md). 구매요청 즉시 재고 차감, 판매자 승인 없음.
 * 매물은 ListingService 로만 다룬다 (도메인 간 service 경유).
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TradeService {

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("uuuu-MM-dd")
		.withResolverStyle(ResolverStyle.STRICT);

	private final TradeInfoRepository trades;

	private final TradeIdGenerator tradeIds;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final Clock clock;

	@Transactional
	public TradeResponse request(UUID buyerId, TradeCreateRequest req) {
		ListingTradeSnapshot listing = listings.snapshotForTrade(req.sellerId(), req.regDate());
		if (buyerId.equals(listing.sellerId())) {
			throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
		}
		if (listing.completed()) {
			throw new ApiException(ErrorCode.LISTING_COMPLETED);
		}
		String reqDeliDate = req.reqDeliDate() == null || req.reqDeliDate().isEmpty() ? listing.provDate() : req.reqDeliDate();
		validate(listing, req.orderQuantity(), reqDeliDate);
		// 재고는 아래 조건부 UPDATE 가 최종 판정. 여기선 거래ID·락을 잡기 전에 뻔한 초과를 먼저 돌려보낸다
		if (listing.stockQuantity() == null || req.orderQuantity() > listing.stockQuantity()) {
			throw new ApiException(ErrorCode.TRADE_OUT_OF_STOCK);
		}

		TradeInfo trade = trades.saveAndFlush(TradeInfo.builder()
			.userId(buyerId)
			.tradeId(tradeIds.next())
			.tradeType(TradeType.PURCHASE_REQUEST)
			.sellerId(listing.sellerId())
			.regDate(listing.regDate())
			.prodId(listing.prodId())
			.prodState(listing.prodState())
			.salesUnitPrice(listing.salesUnitPrice())
			.stockQuantity(listing.stockQuantity())
			.minOrderQuantity(listing.minOrderQuantity())
			.orderUnit(listing.orderUnit())
			.provDate(listing.provDate())
			.orderUnitPrice(listing.salesUnitPrice())
			.orderQuantity(req.orderQuantity())
			.reqDeliDate(reqDeliDate)
			.remarks(req.remarks() == null || req.remarks().isBlank() ? null : req.remarks().trim())
			.tradeStats(TradeStats.REQUESTED)
			.build());
		listings.reserveStock(listing.sellerId(), listing.regDate(), req.orderQuantity());
		return toResponse(trade, listing, nicknameOf(listing.sellerId()));
	}

	/** 구매자·판매자만 본다. 남이면 없는 것과 같게 404 (거래ID 존재 여부를 흘리지 않게) */
	public TradeResponse get(UUID viewerId, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId)
			.filter(t -> viewerId.equals(t.getUserId()) || viewerId.equals(t.getSellerId()))
			.orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		ListingTradeSnapshot listing = listings.snapshotForTrade(trade.getSellerId(), trade.getRegDate());
		UUID counterpart = viewerId.equals(trade.getUserId()) ? trade.getSellerId() : trade.getUserId();
		return toResponse(trade, listing, nicknameOf(counterpart));
	}

	private void validate(ListingTradeSnapshot listing, int quantity, String reqDeliDate) {
		Map<String, String> failures = new LinkedHashMap<>();
		int minOrder = listing.minOrderQuantity() == null ? 1 : listing.minOrderQuantity();
		int unit = listing.orderUnit() == null ? 1 : listing.orderUnit();
		if (quantity < minOrder) {
			failures.put("orderQuantity", "최소주문량(%d) 이상 주문해 주세요.".formatted(minOrder));
		}
		else if (quantity % unit != 0) {
			failures.put("orderQuantity", "주문단위(%d)의 배수로 주문해 주세요.".formatted(unit));
		}
		// 거래이력 금액(trade_amount)이 int 라 넘는 주문은 받지 않는다 (정의서 타입 유지, 사용자 결정)
		else if ((long) listing.salesUnitPrice() * quantity > Integer.MAX_VALUE) {
			failures.put("orderQuantity", "한 번에 주문할 수 있는 금액을 넘었습니다.");
		}
		if (reqDeliDate == null) {
			failures.put("reqDeliDate", "납품희망일을 입력해 주세요.");
		}
		else {
			LocalDate date = parse(reqDeliDate);
			if (date == null) {
				failures.put("reqDeliDate", "납품희망일이 올바른 날짜가 아닙니다.");
			}
			// "오늘"은 한국 날짜 — 서버 Clock 은 UTC
			else if (date.isBefore(LocalDate.now(clock.withZone(SEOUL)))) {
				failures.put("reqDeliDate", "납품희망일은 오늘 이후 날짜로 입력하세요.");
			}
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
	}

	private static LocalDate parse(String value) {
		try {
			return LocalDate.parse(value, DATE_FORMAT);
		}
		catch (DateTimeParseException e) {
			return null;
		}
	}

	private String nicknameOf(UUID userId) {
		return userDirectory.nicknamesOf(List.of(userId)).get(userId);
	}

	static TradeResponse toResponse(TradeInfo trade, ListingTradeSnapshot listing, String counterpartNickname) {
		return new TradeResponse(trade.getTradeId(), trade.getTradeStats().name().toLowerCase(Locale.ROOT),
				trade.getSellerId(), trade.getRegDate(), listing.prodName(), trade.getOrderQuantity(),
				trade.getOrderUnitPrice(), (long) trade.getOrderUnitPrice() * trade.getOrderQuantity(),
				trade.getReqDeliDate(), trade.getRemarks(), counterpartNickname, listing.photo());
	}

}
