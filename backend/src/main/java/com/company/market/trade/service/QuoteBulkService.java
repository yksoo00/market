package com.company.market.trade.service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.trade.domain.TradeInfo;
import com.company.market.trade.domain.TradeStats;
import com.company.market.trade.domain.TradeType;
import com.company.market.trade.dto.QuoteReplyResponse;
import com.company.market.trade.dto.QuoteRequestListResponse;
import com.company.market.trade.repository.TradeInfoRepository;
import com.company.market.trade.service.TradeMailEvent.Kind;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 받은 견적요청 한꺼번에 처리 (계획 2026-11-03-quote-bulk-reply.md). 판매자가 모달 하나에서 모든 견적요청을 보고 [모두 수락]·[모두 거절]한다.
 * 수락·거절 정책은 단건(TradeService.accept·reject)과 같고 길만 하나 더다 — 수락 = 견적 수량을 구매자 몫으로 묶기, 거절 = 상태만.
 * 건별 결과를 돌려준다: 한 건이 틀려도 전체가 실패하지 않는다. 같은 매물의 견적끼리 묶어 그 묶음 안에서만 한꺼번에 성공/실패한다.
 */
@Service
@RequiredArgsConstructor
public class QuoteBulkService {

	private static final Logger log = LoggerFactory.getLogger(QuoteBulkService.class);

	/** 한 번에 보여 주고 처리하는 상한 — 건마다 재고 묶기·메일이 나가므로 */
	public static final int MAX = 30;

	private final TradeInfoRepository trades;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final ApplicationEventPublisher events;

	private final PlatformTransactionManager txManager;

	/** 내가 받은 견적요청 — 오래된 요청부터 30건, total 은 전체 건수. 재고는 지금 값 */
	@Transactional(readOnly = true)
	public QuoteRequestListResponse list(String sellerId) {
		List<TradeInfo> rows = trades.findPendingBySeller(sellerId, TradeType.QUOTE, TradeStats.QUOTE_REQUESTED, PageRequest.of(0, MAX));
		long total = trades.countPendingBySeller(sellerId, TradeType.QUOTE, TradeStats.QUOTE_REQUESTED);
		Map<String, String> nicknames = userDirectory.nicknamesOf(rows.stream().map(TradeInfo::getUserId).distinct().toList());
		Map<ListingId, ListingTradeSnapshot> snapshots = new LinkedHashMap<>();
		List<QuoteRequestListResponse.Item> items = new ArrayList<>();
		for (TradeInfo t : rows) {
			ListingTradeSnapshot listing = snapshots.get(t.listingId());
			if (listing == null) {
				try {
					listing = listings.snapshotForTrade(t.listingId());
				}
				catch (ApiException e) {
					// 매물이 이미 없으면 그 견적도 곧 정리된다 — 목록 전체를 깨지 않는다
					continue;
				}
				snapshots.put(t.listingId(), listing);
			}
			items.add(new QuoteRequestListResponse.Item(t.getTradeId(), t.getProdRegDate(), listing.prodName(), nicknames.get(t.getUserId()),
					t.getOrderQuantity(), t.getSalesUnitPrice(), t.getOrderUnitPrice(), (long) t.getOrderUnitPrice() * t.getOrderQuantity(),
					t.getReqDeliDate(), t.getRemarks(), listing.stockQuantity()));
		}
		return new QuoteRequestListResponse(items, total);
	}

	/**
	 * 한꺼번에 수락·거절. 같은 매물 묶음마다 자기 트랜잭션이라 한 묶음이 실패해도 다른 묶음의 성공은 남는다.
	 * 묶음 안은 전부 처리하거나 전부 못 한다 — 수락 합계가 재고를 넘으면 서버가 누구를 먼저 받을지 고르지 않고 그 묶음을 통째로 막는다
	 * (판매자가 건별로 고른다). 결과는 요청한 순서(중복은 한 번)로 돌려준다
	 */
	public QuoteReplyResponse reply(String sellerId, List<String> tradeIds, boolean accept) {
		List<String> ids = new ArrayList<>(new LinkedHashSet<>(tradeIds));
		Map<String, QuoteReplyResponse.Result> results = new LinkedHashMap<>();
		// 내 견적이 아니거나 없는 건은 같은 404 — 남의 거래 존재를 흘리지 않는다. 같은 매물 건은 한 묶음으로
		Map<ListingId, List<String>> groups = new LinkedHashMap<>();
		TransactionTemplate read = new TransactionTemplate(txManager);
		read.setReadOnly(true);
		read.executeWithoutResult(status -> {
			for (String id : ids) {
				TradeInfo t = trades.findByTradeId(id).filter(x -> sellerId.equals(x.getSellerId())).orElse(null);
				if (t == null) {
					results.put(id, fail(id, ErrorCode.TRADE_NOT_FOUND, "찾을 수 없는 견적입니다."));
				}
				else {
					groups.computeIfAbsent(t.listingId(), k -> new ArrayList<>()).add(id);
				}
			}
		});
		// 묶음은 등록일시 순 — 같은 판매자가 동시에 두 번 눌러도 매물을 잠그는 순서가 같아 서로를 기다리다 교착하지 않는다 (판매자는 하나뿐이다)
		List<Map.Entry<ListingId, List<String>>> ordered = new ArrayList<>(groups.entrySet());
		ordered.sort(Comparator.comparing((Map.Entry<ListingId, List<String>> e) -> e.getKey().getRegDate()));
		for (Map.Entry<ListingId, List<String>> group : ordered) {
			try {
				new TransactionTemplate(txManager).executeWithoutResult(status -> results.putAll(replyGroup(sellerId, group.getKey(), group.getValue(), accept)));
			}
			catch (ApiException e) {
				// 묶음 처리 중 예외가 나면 그 묶음은 롤백됐다 — 묶음의 모든 건을 같은 사유로 실패 처리
				group.getValue().forEach(id -> results.put(id, fail(id, e.getCode(), e.getMessage())));
			}
			catch (RuntimeException e) {
				// 잠금 시간 초과·교착 같은 예상 밖 오류도 이미 커밋된 다른 묶음의 결과를 버리지 않게 이 묶음만 실패로 돌린다 (전체가 500 이면 화면이 성공한 건을 모른다)
				log.warn("견적 일괄 처리 묶음 실패 listing={}", group.getKey(), e);
				group.getValue().forEach(id -> results.put(id, fail(id, ErrorCode.INTERNAL, ErrorCode.INTERNAL.message())));
			}
		}
		return new QuoteReplyResponse(ids.stream().map(results::get).toList());
	}

	/**
	 * 한 매물 묶음 — 이 트랜잭션 안에서 매물을 잠그고 합계·재고를 판정한 뒤 처리한다.
	 * TODO(수락 규칙 중복): 아래 "상태 바꾸기 → 재고 묶기 → 메일" 은 단건 수락(TradeService.reply)과 같은 규칙을 따로 구현한 것이다.
	 * 수락 규칙을 바꾸거나 세 번째 수락 경로가 생기기 전에 공용으로 뽑아 합친다. 합칠 때 지킬 것: 공용 부분엔 @Transactional 을 달지 않고
	 * (부르는 쪽 트랜잭션에 합류) 예외를 잡지 않는다 — 던지는 쪽이 롤백 전용 표시를 만들어 일괄의 묶음 트랜잭션이 커밋을 못 하게 되는 걸
	 * 막으려고. 재고 묶기는 던지는 reserveStock 으로 통일해도 되고(묶음은 합계를 확인하고 매물을 잠갔으니 모자라면 묶음 롤백이 맞다),
	 * 처리 순서는 단건의 "재고 먼저"를 따른다. 테스트: QuoteApiTest·TradeApiTest·QuoteBulkReplyApiTest·E2E quote/quote-bulk 를 다시 돌린다
	 */
	private Map<String, QuoteReplyResponse.Result> replyGroup(String sellerId, ListingId listingId, List<String> ids, boolean accept) {
		Map<String, QuoteReplyResponse.Result> out = new LinkedHashMap<>();
		ListingTradeSnapshot listing = listings.lockForTrade(listingId);
		List<TradeInfo> pending = new ArrayList<>();
		for (String id : ids) {
			TradeInfo t = trades.findForUpdateByTradeId(id).orElse(null);
			// 그 사이 구매자가 취소했거나(행 삭제) 다른 곳에서 이미 처리한 건
			if (t == null || t.getTradeType() != TradeType.QUOTE || t.getTradeStats() != TradeStats.QUOTE_REQUESTED) {
				out.put(id, fail(id, ErrorCode.TRADE_NOT_PENDING, "이미 처리된 견적입니다."));
			}
			else {
				pending.add(t);
			}
		}
		if (pending.isEmpty()) {
			return out;
		}
		if (accept) {
			if (listing.completed()) {
				pending.forEach(t -> out.put(t.getTradeId(), fail(t.getTradeId(), ErrorCode.LISTING_COMPLETED, ErrorCode.LISTING_COMPLETED.message())));
				return out;
			}
			int stock = listing.stockQuantity() == null ? 0 : listing.stockQuantity();
			int sum = pending.stream().mapToInt(TradeInfo::getOrderQuantity).sum();
			if (sum > stock) {
				String message = "견적 합계 %d개가 재고 %d개를 넘어요. 아래에서 건별로 골라 수락해 주세요.".formatted(sum, stock);
				pending.forEach(t -> out.put(t.getTradeId(), fail(t.getTradeId(), ErrorCode.TRADE_OUT_OF_STOCK, message)));
				return out;
			}
		}
		TradeStats result = accept ? TradeStats.QUOTE_ACCEPTED : TradeStats.QUOTE_REJECTED;
		for (TradeInfo t : pending) {
			// 상태를 먼저 바꾼다 — 같이 눌린 취소·단건 수락 중 하나만 이기고, 진 쪽은 0행이라 묶지 않는다
			if (trades.updateStatus(t.getTradeId(), TradeStats.QUOTE_REQUESTED, result) == 0) {
				out.put(t.getTradeId(), fail(t.getTradeId(), ErrorCode.TRADE_NOT_PENDING, "이미 처리된 견적입니다."));
				continue;
			}
			// 매물을 잠그고 합계를 확인했으니 여기서 모자랄 일은 없다. 그래도 모자라면 이 묶음 전체를 롤백한다
			if (accept && !listings.tryReserveStock(listingId, t.getOrderQuantity())) {
				throw new ApiException(ErrorCode.TRADE_OUT_OF_STOCK);
			}
			events.publishEvent(new TradeMailEvent(accept ? Kind.QUOTE_ACCEPTED : Kind.QUOTE_REJECTED, t.getTradeId(), t.getUserId(), t.getSellerId(),
					sellerId, listing.prodName(), t.getSalesUnitPrice(), t.getOrderUnitPrice(), t.getOrderQuantity()));
			out.put(t.getTradeId(), new QuoteReplyResponse.Result(t.getTradeId(), true, result.code(), null, null));
		}
		return out;
	}

	private static QuoteReplyResponse.Result fail(String tradeId, ErrorCode code, String message) {
		return new QuoteReplyResponse.Result(tradeId, false, null, code.name(), message);
	}

}
