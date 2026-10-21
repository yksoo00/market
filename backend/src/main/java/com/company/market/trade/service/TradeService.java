package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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
import com.company.market.trade.dto.QuoteCreateRequest;
import com.company.market.trade.service.TradeMailEvent.Kind;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.dto.TradePageResponse;
import com.company.market.trade.dto.TradeResponse;
import com.company.market.trade.repository.TradeHistoryRepository;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.dao.DataIntegrityViolationException;
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

	/** 메일 이벤트 — 커밋 뒤 TradeMailListener 가 보낸다 */
	private final ApplicationEventPublisher events;

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
			.tradeType(TradeType.PURCHASE)
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
		mail(Kind.PURCHASE_REQUESTED, trade, buyerId, listing.prodName());
		return toResponse(trade, TradeStats.REQUESTED, listing.prodName(), listing.photo(), nicknameOf(listing.sellerId()));
	}

	/**
	 * 견적 요청 N건 (스펙 2026-10-20). 매물마다 견적조정 1행(구매자·매물당 하나 — 있으면 덮어써 견적요청으로 되돌린다,
	 * 사용자 결정 2026-10-21), 재고는 건드리지 않는다.
	 * 하나라도 틀리면 아무것도 저장하지 않는다(트랜잭션). 재고를 바꾸지 않으니 매물을 잠그지 않는다 — 여러 매물을
	 * 잠그면 다른 요청과 순서가 엇갈려 교착될 수 있다. 한 요청에 같은 매물이 두 번 오면 409
	 */
	@Transactional
	public List<TradeResponse> requestQuotes(UUID buyerId, QuoteCreateRequest req) {
		Map<String, String> failures = new LinkedHashMap<>();
		List<TradeInfo> saved = new ArrayList<>();
		List<ListingTradeSnapshot> snapshots = new ArrayList<>();
		// 다른 칸 오류와 함께 한 번에 알리려고 첫 매물 조회 전에 본다
		Set<String> seen = new HashSet<>();
		for (QuoteCreateRequest.Item item : req.items()) {
			if (!seen.add(item.sellerId() + "/" + item.regDate())) {
				throw new ApiException(ErrorCode.QUOTE_ALREADY_REQUESTED);
			}
		}
		for (int i = 0; i < req.items().size(); i++) {
			QuoteCreateRequest.Item item = req.items().get(i);
			ListingTradeSnapshot listing = listings.snapshotForTrade(item.sellerId(), item.regDate());
			if (buyerId.equals(listing.sellerId())) {
				throw new ApiException(ErrorCode.TRADE_OWN_LISTING);
			}
			if (listing.completed()) {
				throw new ApiException(ErrorCode.LISTING_COMPLETED);
			}
			String prefix = "items[" + i + "].";
			if (item.orderUnitPrice() > listing.salesUnitPrice()) {
				failures.put(prefix + "orderUnitPrice", "희망단가는 등록단가(%d원) 이하로 입력해 주세요.".formatted(listing.salesUnitPrice()));
			}
			String quantityFailure = quantityFailure(listing, item.orderQuantity(), item.orderUnitPrice());
			if (quantityFailure == null && (listing.stockQuantity() == null || item.orderQuantity() > listing.stockQuantity())) {
				quantityFailure = "현재 재고(%d)보다 많이 요청할 수 없습니다.".formatted(listing.stockQuantity() == null ? 0 : listing.stockQuantity());
			}
			if (quantityFailure != null) {
				failures.put(prefix + "orderQuantity", quantityFailure);
			}
			if (!failures.isEmpty()) {
				continue;
			}
			String remarks = item.remarks() == null || item.remarks().isBlank() ? null : item.remarks().trim();
			TradeInfo existing = trades.findByUserIdAndSellerIdAndRegDateAndTradeType(buyerId, listing.sellerId(),
					listing.regDate(), TradeType.QUOTE).orElse(null);
			if (existing != null) {
				existing.requote(listing.prodId(), listing.prodState(), listing.salesUnitPrice(), listing.stockQuantity(),
						listing.minOrderQuantity(), listing.orderUnit(), listing.provDate(), item.orderUnitPrice(),
						item.orderQuantity(), remarks);
				saved.add(trades.saveAndFlush(existing));
			}
			else {
				try {
					saved.add(trades.saveAndFlush(TradeInfo.builder()
						.userId(buyerId)
						.tradeId(tradeIds.next())
						.tradeType(TradeType.QUOTE)
						.sellerId(listing.sellerId())
						.regDate(listing.regDate())
						.prodId(listing.prodId())
						.prodState(listing.prodState())
						.salesUnitPrice(listing.salesUnitPrice())
						.stockQuantity(listing.stockQuantity())
						.minOrderQuantity(listing.minOrderQuantity())
						.orderUnit(listing.orderUnit())
						.provDate(listing.provDate())
						.orderUnitPrice(item.orderUnitPrice())
						.orderQuantity(item.orderQuantity())
						.remarks(remarks)
						.tradeStats(TradeStats.QUOTE_REQUESTED)
						.build()));
				}
				catch (DataIntegrityViolationException e) {
					// 같은 구매자의 요청이 동시에 둘 들어와 부분 unique 인덱스에 걸렸다. 다시 보내면 먼저 저장된 행을 덮어쓴다
					throw new ApiException(ErrorCode.QUOTE_ALREADY_REQUESTED);
				}
			}
			snapshots.add(listing);
			// 커밋 뒤에만 나가므로 뒤에서 실패(400·409)해 롤백되면 이 메일도 안 간다
			mail(Kind.QUOTE_REQUESTED, saved.getLast(), buyerId, listing.prodName());
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(saved.stream().map(TradeInfo::getSellerId).collect(Collectors.toSet()));
		List<TradeResponse> responses = new ArrayList<>();
		for (int i = 0; i < saved.size(); i++) {
			TradeInfo trade = saved.get(i);
			ListingTradeSnapshot listing = snapshots.get(i);
			responses.add(toResponse(trade, TradeStats.QUOTE_REQUESTED, listing.prodName(), listing.photo(),
					nicknames.get(trade.getSellerId())));
		}
		return responses;
	}

	/** 구매자 [거래완료] → 구매확정 + 거래이력 1줄. 판매자는 못 한다 (사용자 결정 2026-10-15) */
	@Transactional
	public TradeResponse complete(UUID me, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		if (!me.equals(trade.getUserId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trades.updateStatus(tradeId, TradeStats.REQUESTED, TradeStats.CONFIRMED) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		histories.save(TradeHistory.builder()
			.tradeId(tradeId)
			.tradeDate(LocalDateTime.now(clock).format(TIMESTAMP_FORMAT))
			.prodId(trade.getProdId())
			.tradeType(TradeType.PURCHASE)
			.sellerId(trade.getSellerId())
			.buyerId(trade.getUserId())
			.tradeUnitPrice(trade.getOrderUnitPrice())
			.tradeQuantity(trade.getOrderQuantity())
			// 요청 때 int 범위를 넘는 금액은 거절했으므로 넘치지 않는다
			.tradeAmount(trade.getOrderUnitPrice() * trade.getOrderQuantity())
			.build());
		TradeResponse confirmed = respond(me, trade, TradeStats.CONFIRMED);
		mail(Kind.PURCHASE_CONFIRMED, trade, me, confirmed.prodName());
		return confirmed;
	}

	/**
	 * 확정 전이면 구매자·판매자 누구나 취소. 취소는 값 없이 행을 지우고(사용자 결정 2026-10-20) 재고를 돌려준다.
	 * 이력에도 쌓지 않는다
	 */
	@Transactional
	public void cancel(UUID me, String tradeId) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		// 견적은 보낸 구매자만 거둔다(판매자는 거절). 판매자 답이 오기 전(견적요청)에만, 재고는 잡지 않았으니 그대로
		if (trade.getTradeType() == TradeType.QUOTE) {
			if (!me.equals(trade.getUserId())) {
				throw new ApiException(ErrorCode.FORBIDDEN);
			}
			if (trades.deleteIfStatus(tradeId, TradeStats.QUOTE_REQUESTED) == 0) {
				throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
			}
			mail(Kind.QUOTE_CANCELED, trade, me, productNameOf(trade));
			return;
		}
		if (!me.equals(trade.getUserId()) && !me.equals(trade.getSellerId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trades.deleteIfStatus(tradeId, TradeStats.REQUESTED) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		listings.releaseStock(trade.getSellerId(), trade.getRegDate(), trade.getOrderQuantity());
		mail(Kind.PURCHASE_CANCELED, trade, me, productNameOf(trade));
	}

	/** 판매자 견적 수락 — 매물 단가를 희망단가로 내리고 견적회신. 결과(수락)는 메일로만 구분된다 (사용자 결정 2026-10-20) */
	@Transactional
	public TradeResponse accept(UUID me, String tradeId) {
		return reply(me, tradeId, true);
	}

	/** 판매자 견적 거절 — 매물은 그대로, 견적회신 */
	@Transactional
	public TradeResponse reject(UUID me, String tradeId) {
		return reply(me, tradeId, false);
	}

	private TradeResponse reply(UUID me, String tradeId, boolean accepted) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		if (!me.equals(trade.getSellerId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trade.getTradeType() != TradeType.QUOTE) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		if (accepted) {
			listings.applyQuotePrice(trade.getSellerId(), trade.getRegDate(), trade.getOrderUnitPrice());
		}
		// 동시 수락·거절·취소 중 하나만 — 지면 단가 변경도 같이 롤백된다
		if (trades.updateStatus(tradeId, TradeStats.QUOTE_REQUESTED, TradeStats.QUOTE_REPLIED) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		TradeResponse replied = respond(me, trade, TradeStats.QUOTE_REPLIED);
		mail(accepted ? Kind.QUOTE_ACCEPTED : Kind.QUOTE_REJECTED, trade, me, replied.prodName());
		return replied;
	}

	private void mail(Kind kind, TradeInfo trade, UUID actorId, String prodName) {
		events.publishEvent(new TradeMailEvent(kind, trade.getTradeId(), trade.getUserId(), trade.getSellerId(), actorId,
				prodName, trade.getSalesUnitPrice(), trade.getOrderUnitPrice(), trade.getOrderQuantity()));
	}

	/** 구매 때 상품 이름 (거래에 복사된 상품ID 의 마스터) */
	private String productNameOf(TradeInfo trade) {
		return listings.productNames(List.of(trade.getProdId())).get(trade.getProdId());
	}

	/** 구매자·판매자만 본다. 남이면 없는 것과 같게 404 (거래ID 존재 여부를 흘리지 않게) */
	public TradeResponse get(UUID viewerId, String tradeId) {
		return find(viewerId, tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
	}

	/** get 과 같되 없으면(남의 거래 포함) 빈 값 — 멱등 재전송이 지워진 거래를 건너뛰게 */
	public Optional<TradeResponse> find(UUID viewerId, String tradeId) {
		return trades.findByTradeId(tradeId)
			.filter(t -> viewerId.equals(t.getUserId()) || viewerId.equals(t.getSellerId()))
			.map(trade -> respond(viewerId, trade, trade.getTradeStats()));
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
		Set<String> renamed = pageRows.stream()
			.filter(t -> !sameProduct(t, listingsById.get(new ListingId(t.getSellerId(), t.getRegDate()))))
			.map(TradeInfo::getProdId)
			.collect(Collectors.toSet());
		Map<String, String> oldNames = renamed.isEmpty() ? Map.of() : listings.productNames(renamed);
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(
				pageRows.stream().map(t -> asBuyer ? t.getSellerId() : t.getUserId()).collect(Collectors.toSet()));
		List<TradeResponse> items = pageRows.stream()
			.map(t -> {
				ListingTradeSnapshot listing = listingsById.get(new ListingId(t.getSellerId(), t.getRegDate()));
				String prodName = sameProduct(t, listing) ? listing.prodName() : oldNames.get(t.getProdId());
				return toResponse(t, t.getTradeStats(), prodName, listing.photo(),
						nicknames.get(asBuyer ? t.getSellerId() : t.getUserId()));
			})
			.toList();
		return new TradePageResponse(items, hasMore ? pageRows.get(pageRows.size() - 1).getTradeId() : null);
	}

	/** 내 매물별 판매자가 처리할 건수(견적요청 + 구매요청). 키 = 매물 regDate. 내 판매글 표의 "구매요청 N건" */
	public Map<String, Long> pendingCounts(UUID sellerId) {
		return trades.countBySellerGroupByListing(sellerId, List.of(TradeStats.QUOTE_REQUESTED, TradeStats.REQUESTED)).stream()
			.collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
	}

	/** deliDateFromListing: 구매자가 비워서 매물 납기일을 쓴 경우 — 그 납기일이 지났으면 그렇다고 알려야 고칠 수 있다 */
	private void validate(ListingTradeSnapshot listing, int quantity, String reqDeliDate, boolean deliDateFromListing) {
		Map<String, String> failures = new LinkedHashMap<>();
		String quantityFailure = quantityFailure(listing, quantity, listing.salesUnitPrice());
		if (quantityFailure != null) {
			failures.put("orderQuantity", quantityFailure);
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

	/** 주문량 규칙(구매·견적 같음). 금액은 그 거래의 단가(구매 = 등록단가, 견적 = 희망단가)로 본다. 맞으면 null */
	private static String quantityFailure(ListingTradeSnapshot listing, int quantity, long unitPrice) {
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

	private String nicknameOf(UUID userId) {
		return userDirectory.nicknamesOf(List.of(userId)).get(userId);
	}

	/**
	 * 이미 읽은 거래 행으로 응답을 만든다. status 를 따로 받는 이유: 확정·취소는 벌크 UPDATE 라 읽어 둔 엔티티의 상태가 옛 값이다.
	 * 상품명은 거래에 복사된 상품ID 의 마스터에서(구매 때 이름), 사진은 지금 매물에서 (거래에 사진 칸이 없다)
	 */
	private TradeResponse respond(UUID viewerId, TradeInfo trade, TradeStats status) {
		ListingTradeSnapshot listing = listings.snapshotForTrade(trade.getSellerId(), trade.getRegDate());
		String prodName = sameProduct(trade, listing) ? listing.prodName()
				: listings.productNames(List.of(trade.getProdId())).get(trade.getProdId());
		UUID counterpart = viewerId.equals(trade.getUserId()) ? trade.getSellerId() : trade.getUserId();
		return toResponse(trade, status, prodName, listing.photo(), nicknameOf(counterpart));
	}

	/** 매물이 아직 구매 때 상품을 가리키면 스냅샷의 이름이 곧 구매 때 이름 — 마스터를 다시 읽지 않는다 */
	private static boolean sameProduct(TradeInfo trade, ListingTradeSnapshot listing) {
		return trade.getProdId().equals(listing.prodId());
	}

	static TradeResponse toResponse(TradeInfo trade, TradeStats status, String prodName, String photo,
			String counterpartNickname) {
		return new TradeResponse(trade.getTradeId(), trade.getTradeType().code(), status.code(),
				trade.getSellerId(), trade.getRegDate(), prodName, trade.getOrderQuantity(),
				trade.getSalesUnitPrice(), trade.getOrderUnitPrice(), (long) trade.getOrderUnitPrice() * trade.getOrderQuantity(),
				trade.getReqDeliDate(), trade.getRemarks(), counterpartNickname, photo);
	}

}
