package com.company.market.trade.service;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.text.Collator;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.paging.PageKeys;
import com.company.market.common.time.KoreanDates;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeHistory;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeInfoId;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.QuoteCreateRequest;
import com.company.market.trade.dto.QuotePurchaseRequest;
import com.company.market.trade.service.TradeMailEvent.Kind;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.dto.TradeFilter;
import com.company.market.trade.dto.TradePageResponse;
import com.company.market.trade.dto.TradeResponse;
import com.company.market.trade.repository.CartInfoRepository;
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

	/** 수량을 묶고 있는 거래 상태 — 구매요청·수락된 견적·장바구니. 이게 없고 재고가 0 일 때만 구매 확정이 판매완료로 만든다 */
	private static final List<TradeStats> HOLDING_STATS = List.of(TradeStats.REQUESTED, TradeStats.QUOTE_ACCEPTED, TradeStats.CART);

	private static final DateTimeFormatter TIMESTAMP_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private final TradeInfoRepository trades;

	private final TradeHistoryRepository histories;

	private final TradeIdGenerator tradeIds;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final TradeInputRules rules;

	private final CartInfoRepository cartInfos;

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
		String reqDeliDate = req.reqDeliDate();
		rules.validate(listing, req.orderQuantity(), reqDeliDate);
		// 장바구니에서 누른 구매면 그 줄(cartTradeId)이 구매요청이 된다 — 같은 매물이 여러 줄이라 줄을 가리켜야 한다. 직접 구매는 새 거래.
		// 그 줄이 묶고 있던 수량은 이 구매가 쓸 수 있는 재고다
		TradeInfo cartRow = takeCartRow(buyerId, listing, req.cartTradeId());
		int usable = (listing.stockQuantity() == null ? 0 : listing.stockQuantity()) + (cartRow == null ? 0 : cartRow.getOrderQuantity());
		// 재고는 아래 조건부 UPDATE 가 최종 판정. 여기선 거래ID·락을 잡기 전에 뻔한 초과를 먼저 돌려보낸다
		if (req.orderQuantity() > usable) {
			throw new ApiException(ErrorCode.TRADE_OUT_OF_STOCK);
		}

		String remarks = req.remarks() == null || req.remarks().isBlank() ? null : req.remarks().trim();
		// 아래에서 실패하면 같이 롤백돼 장바구니 줄과 묶은 수량이 그대로 남는다
		TradeInfo trade;
		if (cartRow != null) {
			// 줄이 묶었던 수량은 저장한 뒤에 푼다 (풀 때 영속성 컨텍스트가 비워지고, 저장 뒤엔 줄의 수량이 요청 수량으로 바뀌므로 먼저 챙긴다)
			ListingId heldListing = cartRow.listingId();
			int heldQuantity = cartRow.getOrderQuantity();
			cartRow.convertCartToPurchase(listing.prodId(), listing.prodState(), listing.salesUnitPrice(), listing.stockQuantity(),
					listing.minOrderQuantity(), listing.orderUnit(), listing.provDate(), req.orderQuantity(), reqDeliDate, remarks);
			trade = trades.saveAndFlush(cartRow);
			cartInfos.deleteByTradeId(trade.getTradeId());
			listings.releaseStock(heldListing, heldQuantity);
		}
		else {
			trade = trades.saveAndFlush(TradeInfo.builder()
				.userId(buyerId)
				.tradeId(tradeIds.next())
				.tradeType(TradeType.PURCHASE)
				.sellerId(listing.sellerId())
				.prodRegDate(listing.regDate())
				.regDate(LocalDateTime.now(clock).format(TIMESTAMP_FORMAT))
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
				.remarks(remarks)
				.tradeStats(TradeStats.REQUESTED)
				.build());
		}
		listings.reserveStock(listing.id(), req.orderQuantity());
		dropCompareRow(buyerId, listing.sellerId(), listing.regDate(), listing.prodId());
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
			TradeInfo cartRow = takeCartRow(buyerId, listing, item.cartTradeId());
			int usable = (listing.stockQuantity() == null ? 0 : listing.stockQuantity()) + (cartRow == null ? 0 : cartRow.getOrderQuantity());
			if (item.orderUnitPrice() > listing.salesUnitPrice()) {
				failures.put(prefix + "orderUnitPrice", "희망단가는 등록단가(%d원) 이하로 입력해 주세요.".formatted(listing.salesUnitPrice()));
			}
			String quantityFailure = rules.quantityFailure(listing, item.orderQuantity(), item.orderUnitPrice());
			if (quantityFailure == null && item.orderQuantity() > usable) {
				quantityFailure = "현재 재고(%d)보다 많이 요청할 수 없습니다.".formatted(usable);
			}
			if (quantityFailure != null) {
				failures.put(prefix + "orderQuantity", quantityFailure);
			}
			String dateFailure = rules.reqDeliDateFailure(item.reqDeliDate());
			if (dateFailure != null) {
				failures.put(prefix + "reqDeliDate", dateFailure);
			}
			if (!failures.isEmpty()) {
				continue;
			}
			String remarks = item.remarks() == null || item.remarks().isBlank() ? null : item.remarks().trim();
			TradeInfo existing = trades.findByUserIdAndSellerIdAndProdRegDateAndProdIdAndTradeTypeAndTradeStatsIn(buyerId,
					listing.sellerId(), listing.regDate(), listing.prodId(), TradeType.QUOTE, TradeStats.QUOTE_STAGES).orElse(null);
			if (existing != null) {
				// 수락된 견적을 다시 요청하면 수락 때 묶은 수량을 푼다 (2026-11-02). 덮어쓰기 전 수량을 챙긴다
				ListingId acceptedListing = existing.getTradeStats() == TradeStats.QUOTE_ACCEPTED ? existing.listingId() : null;
				int acceptedQuantity = existing.getOrderQuantity();
				existing.requote(listing.prodId(), listing.prodState(), listing.salesUnitPrice(), listing.stockQuantity(),
						listing.minOrderQuantity(), listing.orderUnit(), listing.provDate(), item.orderUnitPrice(),
						item.orderQuantity(), item.reqDeliDate(), remarks);
				saved.add(trades.saveAndFlush(existing));
				if (acceptedListing != null) {
					listings.releaseStock(acceptedListing, acceptedQuantity);
				}
				// 장바구니에서 누른 견적인데 이미 견적 행이 있어 그 행을 덮어쓴 경우엔 그 장바구니 줄을 지운다(견적 행이 둘이 되지 않게)
				if (cartRow != null) {
					releaseAndDropCartRow(cartRow);
				}
			}
			else if (cartRow != null) {
				// 장바구니에서 누른 견적이면 그 줄이 견적요청이 된다 — 견적은 수량을 안 묶으므로 줄이 묶었던 수량을 푼다
				ListingId heldListing = cartRow.listingId();
				int heldQuantity = cartRow.getOrderQuantity();
				cartRow.convertCartToQuote(listing.prodId(), listing.prodState(), listing.salesUnitPrice(), listing.stockQuantity(),
						listing.minOrderQuantity(), listing.orderUnit(), listing.provDate(), item.orderUnitPrice(),
						item.orderQuantity(), item.reqDeliDate(), remarks);
				saved.add(trades.saveAndFlush(cartRow));
				cartInfos.deleteByTradeId(cartRow.getTradeId());
				listings.releaseStock(heldListing, heldQuantity);
			}
			else {
				try {
					saved.add(trades.saveAndFlush(TradeInfo.builder()
						.userId(buyerId)
						.tradeId(tradeIds.next())
						.tradeType(TradeType.QUOTE)
						.sellerId(listing.sellerId())
						.prodRegDate(listing.regDate())
						.regDate(LocalDateTime.now(clock).format(TIMESTAMP_FORMAT))
						.prodId(listing.prodId())
						.prodState(listing.prodState())
						.salesUnitPrice(listing.salesUnitPrice())
						.stockQuantity(listing.stockQuantity())
						.minOrderQuantity(listing.minOrderQuantity())
						.orderUnit(listing.orderUnit())
						.provDate(listing.provDate())
						.orderUnitPrice(item.orderUnitPrice())
						.orderQuantity(item.orderQuantity())
						.reqDeliDate(item.reqDeliDate())
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
			.userId(trade.getUserId())
			.tradeUnitPrice(trade.getOrderUnitPrice())
			.tradeQuantity(trade.getOrderQuantity())
			// 요청 때 int 범위를 넘는 금액은 거절했으므로 넘치지 않는다
			.tradeAmount(trade.getOrderUnitPrice() * trade.getOrderQuantity())
			.build());
		// 판매완료는 재고가 0 이 된 때가 아니라 구매 확정 때 정한다 — 더 묶인 건(구매요청·수락된 견적)이 없고 재고가 0 일 때만 (2026-11-02)
		// 같이 확정하는 다른 구매자와 서로의 확정이 안 보여 둘 다 "아직 묶인 건이 있다"고 판단하지 않게, 매물 행을 잠가 차례로 본다
		// (뒤에 온 쪽은 앞 쪽의 커밋을 보고 판정한다)
		listings.lockForTrade(trade.listingId());
		if (!trades.existsBySellerIdAndProdRegDateAndProdIdAndTradeStatsIn(trade.getSellerId(), trade.getProdRegDate(), trade.getProdId(),
				HOLDING_STATS)) {
			listings.markSoldOutIfEmpty(trade.listingId());
		}
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
		TradeStats stats = trade.getTradeStats();
		// 견적 단계: 보낸 구매자만 거둔다(판매자는 거절). 답 오기 전(견적요청)이나 거절 뒤(견적거절)에만, 재고는 잡지 않았으니 그대로.
		// 수락된 견적은 [구매]로 가야 하므로 지울 수 없다
		if (stats == TradeStats.QUOTE_REQUESTED || stats == TradeStats.QUOTE_REJECTED) {
			if (!me.equals(trade.getUserId())) {
				throw new ApiException(ErrorCode.FORBIDDEN);
			}
			if (trades.deleteIfStatus(tradeId, stats) == 0) {
				throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
			}
			// 거절 뒤 취소는 판매자가 이미 답한 건이라 메일을 보내지 않는다
			if (stats == TradeStats.QUOTE_REQUESTED) {
				mail(Kind.QUOTE_CANCELED, trade, me, productNameOf(trade));
			}
			return;
		}
		// 수락된 견적: 구매자·판매자 누구나 (구매요청 취소와 같다). 수락 때 묶은 수량을 돌려준다 (2026-11-02)
		if (stats == TradeStats.QUOTE_ACCEPTED) {
			if (!me.equals(trade.getUserId()) && !me.equals(trade.getSellerId())) {
				throw new ApiException(ErrorCode.FORBIDDEN);
			}
			if (trades.deleteIfStatus(tradeId, TradeStats.QUOTE_ACCEPTED) == 0) {
				throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
			}
			listings.releaseStock(trade.listingId(), trade.getOrderQuantity());
			mail(Kind.QUOTE_CANCELED, trade, me, productNameOf(trade));
			return;
		}
		// 구매 단계: 구매자·판매자 누구나 (견적에서 이어진 행도 같다). 구매확정은 취소할 수 없다
		if (stats != TradeStats.REQUESTED) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		if (!me.equals(trade.getUserId()) && !me.equals(trade.getSellerId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trades.deleteIfStatus(tradeId, TradeStats.REQUESTED) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		listings.releaseStock(trade.listingId(), trade.getOrderQuantity());
		mail(Kind.PURCHASE_CANCELED, trade, me, productNameOf(trade));
	}

	/**
	 * 수락된 견적에서 구매자 [구매] — 새 행을 만들지 않고 그 행이 구매요청이 된다 (견적서 한 건 = 한 행, 사용자 결정 2026-10-21).
	 * 단가·수량은 수락된 값 그대로(수락 단가는 이 거래 안에서만 쓴다 — 매물 단가는 안 바뀐다), 재고는 수락 때 이미 묶였다.
	 * 두 번 눌러도 하나만 — 상태 조건부 UPDATE (2026-11-02)
	 */
	@Transactional
	public TradeResponse purchaseFromQuote(UUID buyerId, String tradeId, QuotePurchaseRequest req) {
		TradeInfo trade = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		if (!buyerId.equals(trade.getUserId())) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		if (trade.getTradeType() != TradeType.QUOTE || trade.getTradeStats() != TradeStats.QUOTE_ACCEPTED) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		ListingTradeSnapshot listing = listings.lockForTrade(trade.listingId());
		if (listing.completed()) {
			throw new ApiException(ErrorCode.LISTING_COMPLETED);
		}
		String reqDeliDate = req.reqDeliDate();
		// 수량은 수락된 그대로 — 바꾸려면 취소하고 새로 견적한다
		if (!req.orderQuantity().equals(trade.getOrderQuantity())) {
			throw new ValidationException(Map.of("orderQuantity", "수락된 수량(%d) 그대로 구매해야 합니다.".formatted(trade.getOrderQuantity())));
		}
		String dateFailure = rules.reqDeliDateFailure(reqDeliDate);
		if (dateFailure != null) {
			throw new ValidationException(Map.of("reqDeliDate", dateFailure));
		}
		// 같이 눌린 [구매]·재요청 덮어쓰기 중 하나만 — 지면 0행
		if (trades.updateStatus(tradeId, TradeStats.QUOTE_ACCEPTED, TradeStats.REQUESTED) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		TradeInfo continued = trades.findByTradeId(tradeId).orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
		continued.continueQuoteAsPurchase(listing.prodId(), listing.prodState(), listing.salesUnitPrice(),
				listing.minOrderQuantity(), listing.orderUnit(), listing.provDate(), reqDeliDate,
				req.remarks() == null || req.remarks().isBlank() ? null : req.remarks().trim());
		trades.saveAndFlush(continued);
		dropCompareRow(buyerId, listing.sellerId(), listing.regDate(), listing.prodId());
		mail(Kind.PURCHASE_REQUESTED, continued, buyerId, listing.prodName());
		return toResponse(continued, TradeStats.REQUESTED, listing.prodName(), listing.photo(), nicknameOf(listing.sellerId()));
	}

	/** 판매자 견적 수락 — 매물 단가를 희망단가로 내리고 견적수락 (사용자 결정 2026-10-21) */
	@Transactional
	public TradeResponse accept(UUID me, String tradeId) {
		return reply(me, tradeId, true);
	}

	/** 판매자 견적 거절 — 매물은 그대로, 견적거절 */
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
		// 수락하면 그 수량을 구매자 몫으로 묶는다 (재고 부족·거래완료면 409 — 판매자에게 알린다). 매물 단가는 안 바꾼다:
		// 수락 단가는 이 거래 안에서만 쓴다 (2026-11-02)
		if (accepted) {
			listings.reserveStock(trade.listingId(), trade.getOrderQuantity());
		}
		// 동시 수락·거절·취소 중 하나만 — 지면 묶은 수량도 같이 롤백된다
		TradeStats result = accepted ? TradeStats.QUOTE_ACCEPTED : TradeStats.QUOTE_REJECTED;
		if (trades.updateStatus(tradeId, TradeStats.QUOTE_REQUESTED, result) == 0) {
			throw new ApiException(ErrorCode.TRADE_NOT_PENDING);
		}
		TradeResponse replied = respond(me, trade, result);
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

	/** 내 활동내역에 보이는 진행 중 상태 — 구매자: 보낸 견적·구매중, 판매자: 처리할 견적요청·구매요청 (설계 2026-10-27 PR 4) */
	private static final List<TradeStats> BUYER_ACTIVE = List.of(TradeStats.QUOTE_REQUESTED, TradeStats.QUOTE_ACCEPTED,
			TradeStats.QUOTE_REJECTED, TradeStats.REQUESTED);

	private static final List<TradeStats> SELLER_ACTIVE = List.of(TradeStats.QUOTE_REQUESTED, TradeStats.REQUESTED);

	/**
	 * role = buyer(내 구매) | seller(받은 구매요청, regDate 로 한 매물만). active 면 진행 중 상태만. 최신순 20개 + 커서.
	 * 검색·필터(상품명·상태·기간·금액·정렬, 계획 2026-10-30)는 본인 거래 조건 안에서만 걸린다. status 는 이 목록에서 보일 수 있는 상태
	 * (active 면 진행 중 상태) 중 하나 — 아니면 400. 최신순이 아닌 정렬은 page 가 필요하다 (커서는 최신순 전용)
	 */
	public TradePageResponse list(UUID me, String role, String regDate, String cursor, boolean active, Integer pageNo, String status,
			TradeFilter filter) {
		if (cursor != null && !cursor.isEmpty() && !cursor.matches("\\d{11}")) {
			throw new ValidationException(Map.of("cursor", "커서 형식이 올바르지 않습니다."));
		}
		boolean asBuyer;
		List<TradeStats> allowed;
		if ("buyer".equals(role)) {
			asBuyer = true;
			allowed = active ? BUYER_ACTIVE : List.of(TradeStats.values());
		}
		else if ("seller".equals(role)) {
			asBuyer = false;
			allowed = active ? SELLER_ACTIVE : List.of(TradeStats.values());
		}
		else {
			throw new ValidationException(Map.of("role", "role 은 buyer 또는 seller 여야 합니다."));
		}
		Map<String, String> errors = new LinkedHashMap<>();
		TradeFilterRules.Parsed f = TradeFilterRules.parse(filter == null ? TradeFilter.none() : filter, pageNo != null, errors, TradeFilterRules.ACTIVITY_SORTS);
		List<TradeStats> stats = allowed;
		if (status != null && !status.isBlank()) {
			TradeStats picked = Arrays.stream(TradeStats.values()).filter(s -> s.code().equals(status)).findFirst().orElse(null);
			if (picked == null || !allowed.contains(picked)) {
				errors.put("status", "status 는 이 목록에서 볼 수 있는 거래상태 중 하나여야 합니다.");
			}
			else {
				stats = List.of(picked);
			}
		}
		if (!errors.isEmpty()) {
			throw new ValidationException(errors);
		}
		String after = cursor == null || cursor.isEmpty() ? null : cursor;
		String reg = regDate == null || regDate.isBlank() ? null : regDate;
		boolean useProds = f.q() != null;
		// 검색어는 이 목록 범위에 나온 상품 안에서만 맞춰 본다 — 전체 상품에서 찾으면 상한이 필요해 결과가 빠진다 (decisions.md 2026-11-02)
		List<String> prodIds = !useProds ? List.of("")
				: listings.productIdsMatching(f.field(), f.q(), asBuyer
						? trades.findBuyerProdIds(me, TradeType.REVIEW, stats)
						: trades.findSellerProdIds(me, TradeType.REVIEW, stats, reg));
		if (useProds && prodIds.isEmpty()) {
			// 맞는 상품이 없으면 쿼리 없이 빈 결과. 페이지 번호면 1페이지만 있다
			PageKeys<Object[]> empty = pageNo == null ? null : PageKeys.of(List.of(), pageNo, PAGE_SIZE);
			return empty == null ? new TradePageResponse(List.of(), null, null, null, null)
					: new TradePageResponse(List.of(), null, empty.page(), empty.totalPages(), empty.total());
		}

		List<TradeInfo> pageRows;
		PageKeys<Object[]> pageKeys = null;
		boolean hasMore;
		if (pageNo == null) {
			PageRequest page = PageRequest.of(0, PAGE_SIZE + 1);
			List<TradeInfo> rows = asBuyer
					? trades.findBuyerPage(me, TradeType.REVIEW, stats, f.from(), f.to(), f.min(), f.max(), useProds, prodIds, after, page)
					: trades.findSellerPage(me, TradeType.REVIEW, stats, reg, f.from(), f.to(), f.min(), f.max(), useProds, prodIds, after, page);
			hasMore = rows.size() > PAGE_SIZE;
			pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
		}
		else {
			// 페이지 번호: 같은 조건의 키를 전부 읽어 자바에서 정렬하고 그 페이지의 키 20개를 잘라 읽는다 (offset 아님 — 키는 이미 다 읽었다)
			List<Object[]> keys = new ArrayList<>(asBuyer
					? trades.findBuyerKeys(me, TradeType.REVIEW, stats, f.from(), f.to(), f.min(), f.max(), useProds, prodIds)
					: trades.findSellerKeys(me, TradeType.REVIEW, stats, reg, f.from(), f.to(), f.min(), f.max(), useProds, prodIds));
			keys.sort(keyOrder(f.sort(), me, asBuyer, keys));
			pageKeys = PageKeys.of(keys, pageNo, PAGE_SIZE);
			List<Object[]> slice = keys.subList((pageNo - 1) * PAGE_SIZE, Math.min(pageNo * PAGE_SIZE, keys.size()));
			Map<TradeInfoId, TradeInfo> byId = trades
				.findAllById(slice.stream().map(k -> new TradeInfoId((UUID) k[1], (String) k[0])).toList()).stream()
				.collect(Collectors.toMap(TradeInfo::getId, t -> t));
			pageRows = slice.stream().map(k -> byId.get(new TradeInfoId((UUID) k[1], (String) k[0]))).filter(Objects::nonNull).toList();
			hasMore = (long) pageNo * PAGE_SIZE < pageKeys.total();
		}

		Map<ListingId, ListingTradeSnapshot> listingsById = listings.snapshotsForTrades(
				pageRows.stream().map(t -> t.listingId()).collect(Collectors.toSet()));
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(
				pageRows.stream().map(t -> asBuyer ? t.getSellerId() : t.getUserId()).collect(Collectors.toSet()));
		List<TradeResponse> items = pageRows.stream()
			.map(t -> {
				ListingTradeSnapshot listing = listingsById.get(t.listingId());
				return toResponse(t, t.getTradeStats(), listing.prodName(), listing.photo(),
						nicknames.get(asBuyer ? t.getSellerId() : t.getUserId()));
			})
			.toList();
		// 커서는 최신순 전용 — 다른 정렬의 다음 장은 page 로만 간다
		String nextCursor = hasMore && "latest".equals(f.sort()) ? pageRows.get(pageRows.size() - 1).getTradeId() : null;
		return pageKeys == null ? new TradePageResponse(items, nextCursor, null, null, null)
				: new TradePageResponse(items, nextCursor, pageKeys.page(), pageKeys.totalPages(), pageKeys.total());
	}

	/**
	 * 키 [거래ID, 구매자ID, 금액, 판매자ID, 상품ID, 수량, 단가, 납품희망일, 거래상태] 의 정렬 (열 머리 정렬 2026-11-03).
	 * sort = latest | oldest | 열이름Asc|Desc(name·party·quantity·unitPrice·amount·reqDeli·status). 거래ID 는 11자 고정 길이라 문자열 순서가
	 * 시간 순서 — 같은 값이면 최신(거래ID 내림차순)으로 끝을 맞추고, 값이 비어 있는 줄(이름 모름·납품희망일 없음)은 오름·내림 모두 맨 뒤.
	 * 상품명은 상품마스터에서, 상대는 화면에 보이는 별명(내 구매는 판매자, 받은 요청은 구매자)으로 정렬해 목록에 보이는 값과 같다.
	 * 상태는 진행 순서(견적요청 → 견적수락 → 견적거절 → 구매요청)
	 */
	private Comparator<Object[]> keyOrder(String sort, UUID me, boolean asBuyer, List<Object[]> keys) {
		Comparator<Object[]> byIdDesc = Comparator.comparing((Object[] k) -> (String) k[0]).reversed();
		if ("oldest".equals(sort)) {
			return Comparator.comparing((Object[] k) -> (String) k[0]);
		}
		boolean desc = sort.endsWith("Desc");
		String column = sort.replaceFirst("(Asc|Desc)$", "");
		Collator collator = Collator.getInstance(Locale.KOREAN);
		Comparator<Object[]> by = switch (column) {
			case "name" -> {
				Map<String, String> names = listings.productNames(keys.stream().map(k -> (String) k[4]).collect(Collectors.toSet()));
				yield TradeKeySorting.columnOrder(k -> names.get((String) k[4]), (a, b) -> collator.compare(a, b), desc);
			}
			case "party" -> {
				Map<UUID, String> nicknames = userDirectory.nicknamesOf(keys.stream().map(k -> asBuyer ? (UUID) k[3] : (UUID) k[1]).collect(Collectors.toSet()));
				yield TradeKeySorting.columnOrder(k -> nicknames.get(asBuyer ? (UUID) k[3] : (UUID) k[1]), (a, b) -> collator.compare(a, b), desc);
			}
			case "amount" -> TradeKeySorting.columnOrder(k -> (Number) k[2], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			case "quantity" -> TradeKeySorting.columnOrder(k -> (Number) k[5], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			case "unitPrice" -> TradeKeySorting.columnOrder(k -> (Number) k[6], (a, b) -> Long.compare(a.longValue(), b.longValue()), desc);
			// yyyy-MM-dd 문자열이라 문자열 순서가 날짜 순서
			case "reqDeli" -> TradeKeySorting.columnOrder(k -> (String) k[7], String::compareTo, desc);
			case "status" -> TradeKeySorting.columnOrder(k -> (TradeStats) k[8], Comparator.comparingInt(TradeStats::ordinal), desc);
			default -> null;
		};
		return by == null ? byIdDesc : by.thenComparing(byIdDesc);
	}

	/** 내 매물별 판매자가 처리할 건수(견적요청 + 구매요청). 키 = 매물 regDate. 내 판매글 표의 "구매요청 N건" */
	public Map<String, Long> pendingCounts(UUID sellerId) {
		return trades.countBySellerGroupByListing(sellerId, List.of(TradeStats.QUOTE_REQUESTED, TradeStats.REQUESTED)).stream()
			.collect(Collectors.toMap(r -> (String) r[0], r -> (Long) r[1]));
	}

	/**
	 * 장바구니에서 누른 구매·견적이 가리키는 내 장바구니 줄 (cartTradeId 없으면 null = 새 거래). 내 줄이 아니거나 그 매물의 줄이
	 * 아니거나 장바구니 상태가 아니면 404 — 다른 사람의 줄 존재를 흘리지 않게 없는 것과 같게
	 */
	private TradeInfo takeCartRow(UUID buyerId, ListingTradeSnapshot listing, String cartTradeId) {
		if (cartTradeId == null || cartTradeId.isBlank()) {
			return null;
		}
		return trades.findForUpdateByTradeId(cartTradeId)
			.filter(t -> buyerId.equals(t.getUserId()) && t.getTradeType() == TradeType.REVIEW && t.getTradeStats() == TradeStats.CART
					&& listing.sellerId().equals(t.getSellerId()) && listing.regDate().equals(t.getProdRegDate())
					&& listing.prodId().equals(t.getProdId()))
			.orElseThrow(() -> new ApiException(ErrorCode.TRADE_NOT_FOUND));
	}

	/** 장바구니 줄 하나를 지우고(거래·장바구니 정보 두 행) 그 줄이 묶었던 수량을 푼다 */
	private void releaseAndDropCartRow(TradeInfo cartRow) {
		ListingId listing = cartRow.listingId();
		int quantity = cartRow.getOrderQuantity();
		trades.deleteCartRows(cartRow.getUserId(), List.of(cartRow.getTradeId()), TradeStats.CART);
		cartInfos.deleteByTradeId(cartRow.getTradeId());
		listings.releaseStock(listing, quantity);
	}

	/**
	 * 구매요청이 만들어지면 그 구매자의 비교 목록에서 그 매물을 뺀다 (사용자 결정 2026-11-03). 샀으니 더 비교할 일이 없다.
	 * 견적 요청은 아직 사는 게 아니라 비교 행을 건드리지 않는다. 없으면 아무것도 안 한다
	 */
	private void dropCompareRow(UUID buyerId, UUID sellerId, String regDate, String prodId) {
		trades.findReviewRow(buyerId, sellerId, regDate, prodId, TradeType.REVIEW, TradeStats.COMPARE).ifPresent(row -> {
			trades.deleteCartRows(buyerId, List.of(row.getTradeId()), TradeStats.COMPARE);
			cartInfos.deleteByTradeId(row.getTradeId());
		});
	}

	private String nicknameOf(UUID userId) {
		return userDirectory.nicknamesOf(List.of(userId)).get(userId);
	}

	/**
	 * 이미 읽은 거래 행으로 응답을 만든다. status 를 따로 받는 이유: 확정·취소는 벌크 UPDATE 라 읽어 둔 엔티티의 상태가 옛 값이다.
	 * 상품명·사진은 지금 매물에서 — 거래 행의 prod_id 는 매물 상품이 바뀌면 같이 바뀐다 (2026-10-27)
	 */
	private TradeResponse respond(UUID viewerId, TradeInfo trade, TradeStats status) {
		ListingTradeSnapshot listing = listings.snapshotForTrade(trade.listingId());
		UUID counterpart = viewerId.equals(trade.getUserId()) ? trade.getSellerId() : trade.getUserId();
		return toResponse(trade, status, listing.prodName(), listing.photo(), nicknameOf(counterpart));
	}

	static TradeResponse toResponse(TradeInfo trade, TradeStats status, String prodName, String photo,
			String counterpartNickname) {
		return new TradeResponse(trade.getTradeId(), trade.getTradeType().code(), status.code(),
				trade.getSellerId(), trade.getProdRegDate(), prodName, trade.getOrderQuantity(),
				trade.getSalesUnitPrice(), trade.getOrderUnitPrice(), (long) trade.getOrderUnitPrice() * trade.getOrderQuantity(),
				trade.getReqDeliDate(), trade.getRemarks(), counterpartNickname, photo);
	}

}
