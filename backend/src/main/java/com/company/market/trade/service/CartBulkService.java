package com.company.market.trade.service;

import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.Product;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.service.ListingService;
import com.company.market.listing.service.ProductService;
import com.company.market.trade.domain.CartType;
import com.company.market.trade.dto.CartBulkCheckResult;
import com.company.market.trade.dto.CartBulkRowDto;
import com.company.market.trade.dto.CartBulkRowResult;
import com.company.market.trade.dto.CartBulkRowResult.Alternative;
import com.company.market.trade.dto.CartBulkRowResult.Candidate;
import com.company.market.trade.dto.CartBulkRowResult.ListingOption;
import com.company.market.trade.dto.CartBulkRowResult.Status;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md). 줄 → 상품마스터 → 그 마스터의 매물 후보를 대조해 "살 수 있는 매물"을 정한다.
 * 서버는 줄 상태를 저장하지 않는다: 브라우저가 들고 있다가 검사·담기 때마다 전부 다시 보낸다. 담기는 기존 CartService 를 줄마다 부른다.
 */
@Service
@RequiredArgsConstructor
public class CartBulkService {

	/** 장바구니 최대 줄 수와 같다 (CartService.MAX_ITEMS) — 한 번에 받는 줄 수 상한도 이 값이다 */
	static final int MAX_ROWS = CartBulkParser.MAX_ROWS;

	static final int MAX_QUANTITY = 100_000;

	static final int MAX_REMARKS = 100;

	private static final String REQUIRED = "필수 입력입니다.";

	private static final int CANDIDATE_LIMIT = 5;

	private final ProductService products;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final TradeInputRules rules;

	private final CartInfoRepository cartInfos;

	/** 줄별 검사 결과 + 지금 장바구니 줄 수. 저장은 안 한다 */
	public CartBulkCheckResult check(UUID buyerId, List<CartBulkRowDto> rows) {
		List<CartBulkRowResult> results = checkAll(buyerId, rows).stream().map(Checked::result).toList();
		return new CartBulkCheckResult(results, cartInfos.countByUserIdAndCartType(buyerId, CartType.CART), CartService.MAX_ITEMS);
	}

	/** 검사 결과 + 담기(commit)가 쓸 해석값 — 수량은 검사를 통과한 줄만 있다 */
	record Checked(CartBulkRowResult result, Integer quantity) {
	}

	List<Checked> checkAll(UUID buyerId, List<CartBulkRowDto> rows) {
		if (rows == null || rows.isEmpty() || rows.size() > MAX_ROWS) {
			throw new ValidationException(Map.of("rows", "담을 줄은 1~" + MAX_ROWS + "개여야 합니다."));
		}
		// 줄 번호가 겹치면 화면의 줄 매칭과 담기 결과가 섞인다
		if (rows.stream().map(CartBulkRowDto::rowNo).distinct().count() != rows.size()) {
			throw new ValidationException(Map.of("rows", "줄 번호가 겹칩니다."));
		}
		Set<String> seen = new HashSet<>();
		return rows.stream().map(row -> checkOne(buyerId, row, seen)).toList();
	}

	private Checked checkOne(UUID buyerId, CartBulkRowDto row, Set<String> seen) {
		Map<String, String> fields = new LinkedHashMap<>();
		String name = norm(row.prodName());
		String brand = norm(row.prodBrand());
		String classNo = norm(row.prodClassNo());
		String prodId = norm(row.prodId());

		Integer quantity = quantity(row.orderQuantity(), fields);
		dateFailure(norm(row.reqDeliDate()), fields);
		String remarks = row.remarks() == null ? null : row.remarks().trim();
		if (remarks != null && remarks.length() > MAX_REMARKS) {
			fields.put("remarks", "요청사항은 " + MAX_REMARKS + "자 이하로 입력해 주세요.");
		}

		Product master = null;
		List<Candidate> candidates = List.of();
		if (prodId != null) {
			master = products.find(prodId).orElse(null);
			if (master == null) {
				fields.put("prodId", "없는 상품입니다.");
			}
		}
		else {
			if (name == null) {
				fields.put("prodName", REQUIRED);
			}
			if (brand == null) {
				fields.put("prodBrand", REQUIRED);
			}
			if (name != null && brand != null) {
				master = products.findSameIgnoreCase(name, brand, classNo).orElse(null);
				if (master == null) {
					// 마스터에 없는 상품은 살 매물이 없다 — 판매 쪽의 "새 상품" 같은 건 없다
					fields.put("prodName", "상품마스터에 없는 상품이에요. 아래에서 찾아 고르세요.");
					candidates = products.search(name).stream().limit(CANDIDATE_LIMIT)
						.map(p -> new Candidate(p.prodId(), p.prodName(), p.prodBrand(), p.prodClassNo())).toList();
				}
			}
		}

		List<ListingOption> options = List.of();
		List<Alternative> alternatives = List.of();
		ListingOption chosen = null;
		boolean substituted = false;
		if (master != null) {
			if (!seen.add(master.getProdId())) {
				fields.putIfAbsent(name != null ? "prodName" : "prodId", "파일 안에서 같은 상품이 이미 있어요.");
			}
			options = optionsOf(master.getProdId(), quantity, buyerId);
			alternatives = alternativesOf(master, quantity, buyerId);
			String sellerId = norm(row.sellerId());
			String regDate = norm(row.regDate());
			if (sellerId != null && regDate != null) {
				// 사용자가 고른 매물 — 후보와 대조한다. 못 찾거나 못 사면 서버가 다른 매물로 바꾸지 않고 줄 오류로 돌려준다(조용한 교체 금지)
				Optional<ListingOption> inMain = find(options, sellerId, regDate);
				Optional<ListingOption> inAlt = inMain.isPresent() ? Optional.empty()
						: alternatives.stream().flatMap(a -> a.options().stream()).filter(o -> same(o, sellerId, regDate)).findFirst();
				ListingOption found = inMain.or(() -> inAlt).orElse(null);
				if (found == null) {
					fields.put("listing", "고른 매물을 찾을 수 없어요. 다시 골라 주세요.");
				}
				else if (found.reason() != null) {
					fields.put("listing", found.reason());
				}
				else {
					chosen = found;
					substituted = inAlt.isPresent();
				}
			}
			else {
				chosen = defaultPick(options);
			}
		}

		Status status = !fields.isEmpty() ? Status.FAILED : chosen == null ? Status.UNAVAILABLE : Status.AVAILABLE;
		CartBulkRowResult result = new CartBulkRowResult(row.rowNo(), status, master == null ? null : master.getProdId(),
				master == null ? null : master.getProdName(), chosen, options, alternatives, candidates, List.of(), fields, substituted);
		return new Checked(result, fields.containsKey("orderQuantity") ? null : quantity);
	}

	/** 그 마스터의 모든 매물을 후보로 — 못 사는 매물도 사유(reason)와 함께 남긴다 */
	private List<ListingOption> optionsOf(String prodId, Integer quantity, UUID buyerId) {
		List<ListingTradeSnapshot> snapshots = listings.snapshotsOfProduct(prodId);
		if (snapshots.isEmpty()) {
			return List.of();
		}
		Map<UUID, String> nicknames = userDirectory.nicknamesOf(snapshots.stream().map(ListingTradeSnapshot::sellerId).distinct().toList());
		Map<ListingId, String> hints = listings.replaceHints(snapshots.stream().map(ListingTradeSnapshot::id).toList());
		List<ListingOption> options = new ArrayList<>();
		for (ListingTradeSnapshot s : snapshots) {
			int price = s.salesUnitPrice() == null ? 0 : s.salesUnitPrice();
			options.add(new ListingOption(s.sellerId().toString(), s.regDate(), nicknames.get(s.sellerId()), price,
					s.stockQuantity() == null ? 0 : s.stockQuantity(), s.minOrderQuantity() == null ? 1 : s.minOrderQuantity(),
					s.orderUnit() == null ? 1 : s.orderUnit(), s.provDate(), hints.get(s.id()), reasonOf(s, quantity, buyerId)));
		}
		return options;
	}

	/**
	 * 못 사는 이유. 담기(CartService.add)가 거절하는 것과 같은 조건을 미리 보인다 — 거래완료·내 매물·최소주문량·주문단위·재고.
	 * 수량이 틀렸으면(null) 수량 때문에 못 사는지는 알 수 없어 거래완료·내 매물만 본다
	 */
	private String reasonOf(ListingTradeSnapshot s, Integer quantity, UUID buyerId) {
		if (s.completed()) {
			return "거래가 끝난 매물이에요.";
		}
		if (buyerId.equals(s.sellerId())) {
			return "내 매물이에요.";
		}
		if (quantity == null) {
			return null;
		}
		String failure = rules.quantityFailure(s, quantity, s.salesUnitPrice() == null ? 0 : s.salesUnitPrice());
		if (failure == null && (s.stockQuantity() == null || quantity > s.stockQuantity())) {
			failure = "재고(%d)가 수량보다 적어요.".formatted(s.stockQuantity() == null ? 0 : s.stockQuantity());
		}
		return failure;
	}

	/** 마스터의 대체상품명과 이름이 같은 마스터 중 살 수 있는 매물이 있는 것만 — 제안일 뿐 고르지 않는다 */
	private List<Alternative> alternativesOf(Product master, Integer quantity, UUID buyerId) {
		List<Alternative> out = new ArrayList<>();
		for (Product alt : products.alternatesOf(master)) {
			List<ListingOption> options = optionsOf(alt.getProdId(), quantity, buyerId);
			if (options.stream().anyMatch(o -> o.reason() == null)) {
				out.add(new Alternative(alt.getProdId(), alt.getProdName(), alt.getProdBrand(), options));
			}
		}
		return out;
	}

	/** 살 수 있는 매물 중 단가가 가장 낮은 것, 같으면 재고가 많은 것, 그래도 같으면 등록일시가 빠른 것 */
	private static ListingOption defaultPick(List<ListingOption> options) {
		return options.stream().filter(o -> o.reason() == null)
			.min(Comparator.comparingInt(ListingOption::unitPrice).thenComparing(Comparator.comparingInt(ListingOption::stock).reversed())
				.thenComparing(ListingOption::regDate))
			.orElse(null);
	}

	private static Optional<ListingOption> find(List<ListingOption> options, String sellerId, String regDate) {
		return options.stream().filter(o -> same(o, sellerId, regDate)).findFirst();
	}

	private static boolean same(ListingOption o, String sellerId, String regDate) {
		return o.sellerId().equalsIgnoreCase(sellerId) && o.regDate().equals(regDate);
	}

	/** 수량. 비면 필수, 글자면 형식 오류, 1~100,000 밖은 범위 오류(큰 수도 정수 형식 오류가 아니라 범위 오류로). 쉼표("1,000")는 허용 */
	private static Integer quantity(String raw, Map<String, String> fields) {
		if (raw == null || raw.isBlank()) {
			fields.put("orderQuantity", REQUIRED);
			return null;
		}
		String digits = raw.replace(",", "").replaceAll("\\s+", "");
		if (!digits.matches("-?\\d+")) {
			fields.put("orderQuantity", "숫자(정수)로 입력해 주세요.");
			return null;
		}
		BigInteger value = new BigInteger(digits);
		if (value.compareTo(BigInteger.ONE) < 0 || value.compareTo(BigInteger.valueOf(MAX_QUANTITY)) > 0) {
			fields.put("orderQuantity", "수량은 1 이상 100,000 이하로 입력해 주세요.");
			return null;
		}
		return value.intValue();
	}

	private void dateFailure(String date, Map<String, String> fields) {
		if (date == null) {
			fields.put("reqDeliDate", TradeCreateRequest.REQ_DELI_DATE_REQUIRED);
		}
		else if (!date.matches(ListingCreateRequest.DELIVERY_DATE_PATTERN)) {
			fields.put("reqDeliDate", TradeCreateRequest.REQ_DELI_DATE_MESSAGE);
		}
		else {
			String failure = rules.reqDeliDateFailure(date);
			if (failure != null) {
				fields.put("reqDeliDate", failure);
			}
		}
	}

	/** 앞뒤 공백을 떼고 안쪽 공백 여러 개는 하나로. 빈 칸은 null */
	private static String norm(String s) {
		if (s == null) {
			return null;
		}
		String t = s.trim().replaceAll("\\s+", " ");
		return t.isEmpty() ? null : t;
	}

}
