package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeHistory;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.dto.TradePageResponse;
import com.company.market.trade.dto.TradeResponse;
import com.company.market.trade.repository.TradeHistoryRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
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

	private static final int PAGE_SIZE = 20;

	private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final TradeInfoRepository trades;

	private final TradeHistoryRepository histories;

	private final TradeIdGenerator tradeIds;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final Clock clock;

	@Transactional
	public TradeResponse request(UUID buyerId, TradeCreateRequest req) {
		ListingTradeSnapshot listing = listings.lockForTrade(req.sellerId(), req.regDate());
		if (buyerId.equals(listing.sellerId())) {
			throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
		}
		if (listing.completed()) {
			throw new ApiException(ErrorCode.LISTING_COMPLETED);
		}
		boolean deliDateFromListing = req.reqDeliDate() == null || req.reqDeliDate().isEmpty();
		String reqDeliDate = deliDateFromListing ? listing.provDate() : req.reqDeliDate();
		validate(listing, req.orderQuantity(), reqDeliDate, deliDateFromListing);
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
		return toResponse(trade, TradeStats.REQUESTED, listing.prodName(), listing.photo(), nicknameOf(listing.sellerId()));
	}

	/** 구매자 [거래완료] → 구매확정 + 거래이력 1줄. 판매자는 못 한다 (사용자 결정 2026-10-15) */
	@Transactional
	public TradeResponse complete(UUID me, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		if (!me.equals(trade.getUserId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trades.updateStatus(tradeId, TradeStats.REQUESTED, TradeStats.CONFIRMED, TradeType.PURCHASE_CONFIRM) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		histories.save(TradeHistory.builder()
			.tradeId(tradeId)
			.tradeDate(LocalDateTime.now(clock).format(TIMESTAMP_FORMAT))
			.prodId(trade.getProdId())
			.tradeType(TradeType.PURCHASE_CONFIRM)
			.sellerId(trade.getSellerId())
			.buyerId(trade.getUserId())
			.tradeUnitPrice(trade.getOrderUnitPrice())
			.tradeQuantity(trade.getOrderQuantity())
			// 요청 때 int 범위를 넘는 금액은 거절했으므로 넘치지 않는다
			.tradeAmount(trade.getOrderUnitPrice() * trade.getOrderQuantity())
			.build());
		return respond(me, trade, TradeStats.CONFIRMED);
	}

	/** 확정 전이면 구매자·판매자 누구나 취소. 재고를 돌려준다. 취소는 이력에 쌓지 않는다 */
	@Transactional
	public TradeResponse cancel(UUID me, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		if (!me.equals(trade.getUserId()) && !me.equals(trade.getSellerId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trades.updateStatus(tradeId, TradeStats.REQUESTED, TradeStats.CANCELED, TradeType.PURCHASE_CANCEL) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		listings.releaseStock(trade.getSellerId(), trade.getRegDate(), trade.getOrderQuantity());
		return respond(me, trade, TradeStats.CANCELED);
	}

	/** 구매자·판매자만 본다. 남이면 없는 것과 같게 404 (거래ID 존재 여부를 흘리지 않게) */
	public TradeResponse get(UUID viewerId, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId)
			.filter(t -> viewerId.equals(t.getUserId()) || viewerId.equals(t.getSellerId()))
			.orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		return respond(viewerId, trade, trade.getTradeStats());
	}

	/** role = buyer(내 구매) | seller(받은 구매요청, regDate 로 한 매물만). 최신순 20개 + 커서 */
	public TradePageResponse list(UUID me, String role, String regDate, String cursor) {
		if (cursor != null && !cursor.isEmpty() && !cursor.matches("\\d{11}")) {
			throw new ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."));
		}
		String after = cursor == null || cursor.isEmpty() ? null : cursor;
		PageRequest page = PageRequest.of(0, PAGE_SIZE + 1);
		boolean asBuyer;
		List<TradeInfo> rows;
		if ("buyer".equals(role)) {
			asBuyer = true;
			rows = trades.findBuyerPage(me, after, page);
		}
		else if ("seller".equals(role)) {
			asBuyer = false;
			rows = trades.findSellerPage(me, regDate == null || regDate.isBlank() ? null : regDate, after, page);
		}
		else {
			throw new ValidationException(Map.of("role", "role 은 buyer 또는 seller 여야 합니다."));
		}
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<TradeInfo> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;

		Map<ListingId, ListingTradeSnapshot> listingsById = listings.snapshotsForTrades(
				pageRows.stream().map(t -> new ListingId(t.getSellerId(), t.getRegDate())).collect(Collectors.toSet()));
		Map<String, String> names = listings.productNames(pageRows.stream().map(TradeInfo::getProdId).collect(Collectors.toSet()));
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(
				pageRows.stream().map(t -> asBuyer ? t.getSellerId() : t.getUserId()).collect(Collectors.toSet()));
		List<TradeResponse> items = pageRows.stream()
			.map(t -> toResponse(t, t.getTradeStats(), names.get(t.getProdId()),
					listingsById.get(new ListingId(t.getSellerId(), t.getRegDate())).photo(),
					nicknames.get(asBuyer ? t.getSellerId() : t.getUserId())))
			.toList();
		return new TradePageResponse(items, hasMore ? pageRows.get(pageRows.size() - 1).getTradeId() : null);
	}

	/** 내 매물별 구매요청(대기) 건수. 키 = 매물 regDate. 내 판매글 표의 "구매요청 N건" */
	public Map<String, Long> pendingCounts(UUID sellerId) {
		return trades.countBySellerGroupByListing(sellerId, TradeStats.REQUESTED).stream()
			.collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
	}

	/** deliDateFromListing: 구매자가 비워서 매물 납기일을 쓴 경우 — 그 납기일이 지났으면 그렇다고 알려야 고칠 수 있다 */
	private void validate(ListingTradeSnapshot listing, int quantity, String reqDeliDate, boolean deliDateFromListing) {
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
			LocalDate date = KoreanDates.parseIso(reqDeliDate);
			if (date == null) {
				failures.put("reqDeliDate", "납품희망일이 올바른 날짜가 아닙니다.");
			}
			else if (date.isBefore(KoreanDates.today(clock))) {
				failures.put("reqDeliDate", deliDateFromListing ? "매물 납기일이 지났습니다. 납품희망일을 입력해 주세요."
						: "납품희망일은 오늘 이후 날짜로 입력하세요.");
			}
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
	}

	private String nicknameOf(UUID userId) {
		return userDirectory.nicknamesOf(List.of(userId)).get(userId);
	}

	/**
	 * 이미 읽은 거래 행으로 응답을 만든다. status 를 따로 받는 이유: 확정·취소는 벌크 UPDATE 라 읽어 둔 엔티티의 상태가 옛 값이다.
	 * 상품명은 거래에 복사된 상품ID 의 마스터에서(구매 때 이름), 사진은 지금 매물에서 (거래에 사진 칸이 없다)
	 */
	private TradeResponse respond(UUID viewerId, TradeInfo trade, TradeStats status) {
		String photo = listings.snapshotForTrade(trade.getSellerId(), trade.getRegDate()).photo();
		String prodName = listings.productNames(List.of(trade.getProdId())).get(trade.getProdId());
		UUID counterpart = viewerId.equals(trade.getUserId()) ? trade.getSellerId() : trade.getUserId();
		return toResponse(trade, status, prodName, photo, nicknameOf(counterpart));
	}

	static TradeResponse toResponse(TradeInfo trade, TradeStats status, String prodName, String photo,
			String counterpartNickname) {
		return new TradeResponse(trade.getTradeId(), status.name().toLowerCase(Locale.ROOT),
				trade.getSellerId(), trade.getRegDate(), prodName, trade.getOrderQuantity(),
				trade.getOrderUnitPrice(), (long) trade.getOrderUnitPrice() * trade.getOrderQuantity(),
				trade.getReqDeliDate(), trade.getRemarks(), counterpartNickname, photo);
	}

}
