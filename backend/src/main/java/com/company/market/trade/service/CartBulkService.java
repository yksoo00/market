package com.company.market.trade.service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.Product;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.dto.ListingTraits;
import com.company.market.listing.service.ListingService;
import com.company.market.listing.service.ProductService;
import com.company.market.trade.domain.CartType;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartBulkCheckResult;
import com.company.market.trade.dto.CartBulkCommitResult;
import com.company.market.trade.dto.CartBulkCommitResult.Outcome;
import com.company.market.trade.dto.CartBulkParseResponse;
import com.company.market.trade.dto.CartBulkRowDto;
import com.company.market.trade.dto.CartBulkRowResult;
import com.company.market.trade.dto.CartBulkRowResult.Alternative;
import com.company.market.trade.dto.CartBulkRowResult.ListingOption;
import com.company.market.trade.dto.CartBulkRowResult.Status;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.repository.CartInfoRepository;
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md). 줄 → 상품마스터 → 그 마스터의 매물 후보를 대조해 "살 수 있는 매물"을 정한다.
 * 서버는 줄 상태를 저장하지 않는다: 브라우저가 들고 있다가 검사·담기 때마다 전부 다시 보낸다. 담기는 기존 CartService 를 줄마다 부른다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CartBulkService {

	/** 장바구니 최대 줄 수와 같다 (CartService.MAX_ITEMS) — 한 번에 받는 줄 수 상한도 이 값이다 */
	static final int MAX_ROWS = CartBulkParser.MAX_ROWS;

	static final int MAX_QUANTITY = 100_000;

	static final int MAX_REMARKS = 100;

	private static final String REQUIRED = "필수 입력입니다.";

	/** 한 줄에 합쳐 보이는 상품(마스터)의 최대 수 */
	private static final int MASTER_LIMIT = 10;

	private final ProductService products;

	private final ListingService listings;

	private final UserDirectory userDirectory;

	private final TradeInputRules rules;

	private final CartInfoRepository cartInfos;

	private final CartService cart;

	private final CartBulkParser parser;

	private final CartBulkConditions conditionRules;

	/** 업로드한 엑셀을 읽고 줄마다 검사한다 (저장 없음). 데이터 줄이 하나도 없으면 빈 결과 — 화면이 "입력한 줄이 없어요"를 보이게 */
	public CartBulkParseResponse parse(String buyerId, MultipartFile file) {
		String fileName = file.getOriginalFilename();
		if (file.isEmpty() || fileName == null || !fileName.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
			throw new ValidationException(Map.of("file", "엑셀(.xlsx) 파일을 올려 주세요."));
		}
		// multipart 바깥 상한이 다량 등록 ZIP 때문에 50MB 라 엑셀 10MB(security.md)는 여기서 막는다
		if (file.getSize() > 10L * 1024 * 1024) {
			throw new ValidationException(Map.of("file", "엑셀 파일은 10MB 이하로 올려 주세요."));
		}
		List<CartBulkRowDto> rows;
		try (InputStream in = file.getInputStream()) {
			rows = parser.parse(in);
		}
		catch (IOException e) {
			throw new ValidationException(Map.of("file", "엑셀(.xlsx) 파일을 읽을 수 없습니다."));
		}
		if (rows.isEmpty()) {
			return new CartBulkParseResponse(rows, List.of(), cartInfos.countByUserIdAndCartType(buyerId, CartType.CART), CartService.MAX_ITEMS);
		}
		CartBulkCheckResult checked = check(buyerId, rows);
		return new CartBulkParseResponse(rows, checked.results(), checked.cartCount(), checked.cartMax());
	}

	/** 줄별 검사 결과 + 지금 장바구니 줄 수. 저장은 안 한다. 미리 고르는 건 조건에 맞는 매물이 하나일 때뿐이고, options 는 고정 순서(CartBulkConditions.comparator)다 */
	public CartBulkCheckResult check(String buyerId, List<CartBulkRowDto> rows) {
		List<CartBulkRowResult> results = checkAll(buyerId, rows).stream().map(Checked::result).toList();
		return new CartBulkCheckResult(results, cartInfos.countByUserIdAndCartType(buyerId, CartType.CART), CartService.MAX_ITEMS);
	}

	/**
	 * 담기. 줄을 전부 다시 검사하고(브라우저가 "된다"고 한 것은 믿지 않는다), 담을 수 있는 줄을 **줄마다 한 번씩** CartService.add 로 담는다.
	 * 이 메서드는 트랜잭션을 걸지 않는다 — add 호출마다 자기 트랜잭션이라 한 줄의 실패가 앞서 담은 줄을 되돌리지 않는다(부분 성공).
	 * 같은 매물을 고른 두 줄은 앞 줄이 묶은 재고를 뒤 줄의 add 가 보고 판정하고, 장바구니가 중간에 가득 차면 그 줄부터 CART_FULL 로 실패한다.
	 * 장바구니는 빼기가 쉬운 일이라 전부-아니면-전무가 아닌 줄별 결과를 택했다 (계획 2026-11-09)
	 */
	public CartBulkCommitResult commit(String buyerId, List<CartBulkRowDto> rows) {
		List<Checked> checked = checkAll(buyerId, rows);
		List<Outcome> outcomes = new ArrayList<>();
		boolean cartFull = false;
		for (int i = 0; i < checked.size(); i++) {
			CartBulkRowResult r = checked.get(i).result();
			if (r.status() == Status.FAILED) {
				outcomes.add(new Outcome(r.rowNo(), false, "VALIDATION", r.fields().values().iterator().next()));
				continue;
			}
			if (r.status() == Status.UNAVAILABLE) {
				outcomes.add(new Outcome(r.rowNo(), false, "NO_LISTING", "살 수 있는 매물이 없어요."));
				continue;
			}
			// 고르지 않은 줄은 담지 않는다 — 어느 매물인지 정하는 건 구매자다
			if (r.status() == Status.CHOOSE) {
				outcomes.add(new Outcome(r.rowNo(), false, "NO_CHOICE", "매물을 골라 주세요."));
				continue;
			}
			// 장바구니가 가득 찼으면 남은 줄은 담기를 시도하지 않는다 — 줄마다 매물을 잠그고 세고 되돌리는 일이 헛돈다
			if (cartFull) {
				outcomes.add(new Outcome(r.rowNo(), false, ErrorCode.CART_FULL.name(), ErrorCode.CART_FULL.message()));
				continue;
			}
			CartBulkRowDto row = rows.get(i);
			CartAddRequest.Item item = new CartAddRequest.Item(r.chosen().sellerId(), r.chosen().regDate(),
					checked.get(i).quantity(), norm(row.reqDeliDate()), remarksOf(row.remarks(), r));
			try {
				cart.add(buyerId, new CartAddRequest(List.of(item)));
				outcomes.add(new Outcome(r.rowNo(), true, null, null));
			}
			catch (ValidationException e) {
				outcomes.add(new Outcome(r.rowNo(), false, e.getCode().name(), e.getFields().values().iterator().next()));
			}
			catch (ApiException e) {
				cartFull |= e.getCode() == ErrorCode.CART_FULL;
				outcomes.add(new Outcome(r.rowNo(), false, e.getCode().name(), e.getMessage()));
			}
			catch (RuntimeException e) {
				// 예상 밖 실패(교착·잠금 시간 초과 등) 한 줄이 이미 담은 앞 줄의 결과까지 잃게 하지 않는다 — 500 으로 끝나면 화면이 담긴 줄을
				// 몰라 다시 담아 같은 줄이 두 번 생긴다. 사용자 정보는 로그에 없이 줄 번호만 남긴다
				log.warn("대량구매 담기 줄 {} 이 예상 밖으로 실패했습니다", r.rowNo(), e);
				outcomes.add(new Outcome(r.rowNo(), false, ErrorCode.INTERNAL.name(), "담지 못했어요. 장바구니를 확인한 뒤 다시 시도해 주세요."));
			}
		}
		return new CartBulkCommitResult(outcomes, cartInfos.countByUserIdAndCartType(buyerId, CartType.CART));
	}

	/**
	 * 요청사항. 대체품이면 "원래 요청: A" 를 덧붙여 판매자도 알게 한다 — 100자 안에서, 넘치면 사용자가 쓴 앞부분을 자르고 이 문구는 항상 남긴다.
	 * 원래 요청 이름은 줄이 가리킨 마스터(요청한 상품)의 이름이다
	 */
	static String remarksOf(String userRemarks, CartBulkRowResult result) {
		String user = userRemarks == null || userRemarks.isBlank() ? null : userRemarks.trim();
		if (!result.substituted()) {
			return user;
		}
		String note = "원래 요청: " + result.matchedName();
		if (note.length() > MAX_REMARKS) {
			note = note.substring(0, MAX_REMARKS);
		}
		if (user == null) {
			return note;
		}
		int room = MAX_REMARKS - note.length() - " / ".length();
		return room <= 0 ? note : (user.length() > room ? user.substring(0, room) : user) + " / " + note;
	}

	/** 검사 결과 + 담기(commit)가 쓸 해석값 — 수량은 검사를 통과한 줄만 있다 */
	record Checked(CartBulkRowResult result, Integer quantity) {
	}

	List<Checked> checkAll(String buyerId, List<CartBulkRowDto> rows) {
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

	private Checked checkOne(String buyerId, CartBulkRowDto row, Set<String> seen) {
		Map<String, String> fields = new LinkedHashMap<>();
		String name = norm(row.prodName());
		String brand = norm(row.prodBrand());
		String classNo = norm(row.prodClassNo());
		String prodId = norm(row.prodId());

		Integer quantity = quantity(row.orderQuantity(), fields);
		dateFailure(norm(row.reqDeliDate()), fields);
		CartBulkConditions.Conditions conditions = conditionRules.of(row, fields);
		String remarks = row.remarks() == null ? null : row.remarks().trim();
		if (remarks != null && remarks.length() > MAX_REMARKS) {
			fields.put("remarks", "요청사항은 " + MAX_REMARKS + "자 이하로 입력해 주세요.");
		}

		// 상품 찾기: 사용자는 상품ID·분류번호·"마스터"를 모른다. 이름(+적었으면 제조사·분류번호)이 같은 마스터를 **모두** 찾아 그 매물을 한 줄에 합쳐 보이고,
		// 마스터를 고르게 하지 않는다. 이름이 같은 마스터가 없으면 이름이 포함된 마스터로 대신 보이며 안내를 붙인다 (계획 2026-11-12-bulk-purchase-name-search.md)
		List<Product> masters = List.of();
		List<String> notices = new ArrayList<>();
		// 이름이 포함된 상품으로 대신 보이는 줄 — 사용자가 적은 이름·제조사·분류번호와 다를 수 있어 미리 고르지 않는다
		boolean fallback = false;
		if (prodId != null) {
			Product picked = products.find(prodId).orElse(null);
			if (picked == null) {
				fields.put("prodId", "없는 상품입니다.");
			}
			else {
				masters = List.of(picked);
			}
		}
		else if (name == null) {
			fields.put("prodName", REQUIRED);
		}
		else {
			masters = capped(products.findAllLoose(name, brand, classNo, MASTER_LIMIT + 1), notices);
			if (masters.isEmpty()) {
				masters = capped(products.findAllNameContains(name, MASTER_LIMIT + 1), notices);
				if (!masters.isEmpty()) {
					fallback = true;
					notices.add("이름이 정확히 같은 상품이 없어 비슷한 상품의 매물을 보여 드려요. 제조사·분류번호를 확인하고 골라 주세요.");
				}
			}
			if (masters.isEmpty()) {
				// 마스터에 없는 상품은 살 매물이 없다 — 판매 쪽의 "새 상품" 같은 건 없다
				fields.put("prodName", "상품마스터에 없는 상품이에요. [상품 찾기]로 찾아 보세요.");
			}
		}
		// 글자 그대로 같은 상품(제조일만 달라 남은 옛 중복 행)은 하나로 센다
		int masterCount = identityCount(masters);
		boolean single = masterCount == 1;

		List<ListingOption> options = List.of();
		List<Alternative> alternatives = List.of();
		ListingOption chosen = null;
		boolean substituted = false;
		if (!masters.isEmpty()) {
			// 파일 안 중복: 같은 상품(들)이 앞 줄에도 있으면 둘째 줄부터 실패 — 마스터가 여럿인 줄은 그 마스터 묶음이 같을 때 같은 줄로 본다
			String masterKey = masters.stream().map(Product::getProdId).sorted().collect(Collectors.joining(","));
			if (!seen.add(masterKey)) {
				fields.putIfAbsent(name != null ? "prodName" : "prodId", "파일 안에서 같은 상품이 이미 있어요.");
			}
			String reqDeliDate = norm(row.reqDeliDate());
			List<ListingOption> merged = new ArrayList<>();
			for (Product m : masters) {
				merged.addAll(optionsOf(m, quantity, buyerId, conditions, reqDeliDate));
			}
			// 카드 순서(고정). 마스터가 여럿이어도 한 줄로 합쳐 정렬한다 — 화면은 이 순서 그대로 보이고 조건에 맞는 매물이 여럿이면 첫 카드에 "추천"만 붙인다
			merged.sort(conditionRules.comparator());
			options = merged;
			String sellerId = norm(row.sellerId());
			String regDate = norm(row.regDate());
			// 대체품은 상품이 하나로 정해졌고 조건에 맞는 매물이 하나도 없을 때 제안한다(조건과 다른 매물뿐이어도). 사용자가 매물을 골라 보냈으면(대체 매물일 수 있다) 검증하려고 계산한다
			boolean wantsAlternatives = single && (sellerId != null || options.stream().noneMatch(CartBulkService::clean));
			// 고른 매물 검증엔 못 사는 대체 매물까지 필요하다(사유를 알려 주려고). 응답에는 살 수 있는(하드 막힘 없는) 매물이 있는 대체품을 제안한다 —
			// 조건과 다른 점만 있는 매물도 포함한다(고른 대체 매물이 응답에서 사라지지 않게, 조건과 다른 매물을 보여 주고 고르게 한다는 규칙과 같다)
			List<Alternative> allAlternatives = wantsAlternatives ? alternativesOf(masters.get(0), quantity, buyerId, conditions, reqDeliDate) : List.of();
			alternatives = allAlternatives.stream().filter(a -> a.options().stream().anyMatch(o -> o.reason() == null)).toList();
			if (sellerId != null && regDate != null) {
				// 사용자가 고른 매물 — 합친 매물과 대조한다. 못 찾거나 못 사면(하드 막힘) 서버가 다른 매물로 바꾸지 않고 줄 오류로 돌려준다(조용한 교체 금지).
				// 조건과 다른 점만 있으면 알고 고른 것이므로 허용하고 chosen.mismatches 로 그대로 알린다
				Optional<ListingOption> inMain = find(options, sellerId, regDate);
				Optional<ListingOption> inAlt = inMain.isPresent() ? Optional.empty()
						: allAlternatives.stream().flatMap(a -> a.options().stream()).filter(o -> same(o, sellerId, regDate)).findFirst();
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
				chosen = fallback ? null : onlyClean(options);
			}
		}

		// 고를 매물이 있는데 아직 안 골랐으면 CHOOSE(사용자가 고른다), 고를 수 있는 매물이 하나도 없으면 UNAVAILABLE
		boolean selectable = options.stream().anyMatch(o -> o.reason() == null);
		Status status = !fields.isEmpty() ? Status.FAILED : chosen != null ? Status.AVAILABLE : selectable ? Status.CHOOSE : Status.UNAVAILABLE;
		CartBulkRowResult result = new CartBulkRowResult(row.rowNo(), status, single ? masters.get(0).getProdId() : null,
				single ? masters.get(0).getProdName() : null, chosen, options, alternatives, notices, fields, substituted, masterCount);
		return new Checked(result, fields.containsKey("orderQuantity") ? null : quantity);
	}

	/** 그 마스터의 모든 매물을 후보로 — 못 사는 매물은 사유(reason), 조건과 다른 매물은 다른 점(mismatches)과 함께 남기고 각 매물에 자기 상품을 붙인다. 정렬은 부르는 쪽이 한다 */
	private List<ListingOption> optionsOf(Product master, Integer quantity, String buyerId, CartBulkConditions.Conditions conditions, String reqDeliDate) {
		String prodId = master.getProdId();
		List<ListingTradeSnapshot> snapshots = listings.snapshotsOfProduct(prodId);
		if (snapshots.isEmpty()) {
			return new ArrayList<>();
		}
		Map<String, String> nicknames = userDirectory.nicknamesOf(snapshots.stream().map(ListingTradeSnapshot::sellerId).distinct().toList());
		Map<ListingId, String> hints = listings.replaceHintsOfProduct(prodId);
		Map<ListingId, ListingTraits> traits = listings.traitsOfProduct(prodId);
		List<ListingOption> options = new ArrayList<>();
		for (ListingTradeSnapshot s : snapshots) {
			int price = s.salesUnitPrice() == null ? 0 : s.salesUnitPrice();
			// 조회 사이에 지워진 매물이면 특성이 없다 — 알 수 없는 값으로 두면 조건을 확인할 수 없어 못 사는 쪽으로 판정된다
			ListingTraits t = traits.getOrDefault(s.id(), new ListingTraits(null, null, false, false, null, false, false));
			options.add(new ListingOption(s.sellerId().toString(), s.regDate(), nicknames.get(s.sellerId()), price,
					s.stockQuantity() == null ? 0 : s.stockQuantity(), s.minOrderQuantity() == null ? 1 : s.minOrderQuantity(),
					s.orderUnit() == null ? 1 : s.orderUnit(), s.provDate(), hints.get(s.id()), reasonOf(s, quantity, buyerId), conditions.mismatches(s, t, reqDeliDate), t,
					master.getProdId(), master.getProdName(), master.getProdBrand(), master.getProdClassNo()));
		}
		return options;
	}

	/**
	 * 못 사는 이유(하드 막힘). 담기(CartService.add)가 거절하는 것과 같은 조건을 미리 보인다 — 거래완료·내 매물·최소주문량·주문단위·재고.
	 * 수량이 틀렸으면(null) 수량 때문에 못 사는지는 알 수 없어 그 부분은 건너뛴다. 줄 조건과의 차이는 mismatches 로 따로 알린다
	 */
	private String reasonOf(ListingTradeSnapshot s, Integer quantity, String buyerId) {
		if (s.completed()) {
			return "거래가 끝난 매물이에요.";
		}
		if (buyerId.equals(s.sellerId())) {
			return "내 매물이에요.";
		}
		if (quantity != null) {
			String failure = rules.quantityFailure(s, quantity, s.salesUnitPrice() == null ? 0 : s.salesUnitPrice());
			if (failure == null && (s.stockQuantity() == null || quantity > s.stockQuantity())) {
				failure = "재고(%d)가 수량보다 적어요.".formatted(s.stockQuantity() == null ? 0 : s.stockQuantity());
			}
			if (failure != null) {
				return failure;
			}
		}
		return null;
	}

	/** 마스터의 대체상품명과 이름이 같은 마스터와 그 매물(못 사는 매물 포함) — 제안일 뿐 고르지 않는다 */
	private List<Alternative> alternativesOf(Product master, Integer quantity, String buyerId, CartBulkConditions.Conditions conditions, String reqDeliDate) {
		List<Alternative> out = new ArrayList<>();
		for (Product alt : products.alternatesOf(master)) {
			List<ListingOption> options = optionsOf(alt, quantity, buyerId, conditions, reqDeliDate);
			options.sort(conditionRules.comparator());
			out.add(new Alternative(alt.getProdId(), alt.getProdName(), alt.getProdBrand(), options));
		}
		return out;
	}

	/**
	 * 조건에 맞는(살 수 있고 다른 점도 없는) 매물이 **딱 하나일 때만** 미리 고른다 — 틀릴 수 없는 줄만 자동이다(상품 찾기의 "하나일 때만 자동"과 같은 원리).
	 * 여럿이면 어느 것인지 알 수 없어 구매자가 고르고(정렬 1순위는 화면이 "추천"으로만 표시), 조건과 다른 매물뿐이어도 구매자가 고른다
	 */
	private static ListingOption onlyClean(List<ListingOption> options) {
		List<ListingOption> clean = options.stream().filter(CartBulkService::clean).toList();
		return clean.size() == 1 ? clean.get(0) : null;
	}

	/** limit+1 개를 읽어 limit 를 넘으면 잘라 내고 안내를 붙인다 — 같은 이름의 상품이 너무 많아 일부만 보인다는 걸 알리지 않으면 나머지 매물을 모르고 지나친다 */
	private static List<Product> capped(List<Product> found, List<String> notices) {
		if (found.size() <= MASTER_LIMIT) {
			return found;
		}
		notices.add("같은 이름의 상품이 많아 일부(" + MASTER_LIMIT + "개)만 보여 드려요. [상품 찾기]로 좁혀 보세요.");
		return found.subList(0, MASTER_LIMIT);
	}

	/** 찾은 마스터 중 글자 그대로 다른 상품(이름·제조사·분류번호)의 수 — 제조일만 달라 따로 남은 옛 중복 행은 하나로 센다 */
	private static int identityCount(List<Product> masters) {
		return (int) masters.stream().map(p -> p.getProdName() + "|" + p.getProdBrand() + "|" + (p.getProdClassNo() == null ? "" : p.getProdClassNo())).distinct().count();
	}

	/** 살 수 있고(하드 막힘 없음) 조건과 다른 점도 없는 매물 */
	private static boolean clean(ListingOption o) {
		return o.reason() == null && o.mismatches().isEmpty();
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

	private void dateFailure(String rawDate, Map<String, String> fields) {
		// 엑셀 칸은 2026-10-10·2026.10.10 처럼 올 수 있어 저장 형식으로 먼저 바꾼다 (올바르지 않으면 그대로 두어 형식 오류로 거절)
		String date = com.company.market.common.time.KoreanDates.normalizeDateOrKeep(rawDate);
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
