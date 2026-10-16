package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.LinkedHashMap;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.storage.UploadKind;
import com.company.market.common.storage.UploadRef;
import com.company.market.common.storage.UploadService;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingMineItemResponse;
import com.company.market.listing.dto.ListingMinePageResponse;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.dto.ListingSearchCondition;
import com.company.market.listing.dto.ListingSearchItemResponse;
import com.company.market.listing.dto.ListingTradeSnapshot;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.repository.CategoryRepository;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ListingSearchRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListingService {

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	/** STRICT 는 uuuu(연도) 와 함께 써야 2026-02-30 같은 날짜를 거부한다 (yyyy 는 연대 필드가 필요) */
	private static final DateTimeFormatter MUFC_DATE_FORMAT = DateTimeFormatter.ofPattern("uuuuMMdd")
		.withResolverStyle(ResolverStyle.STRICT);

	private static final DateTimeFormatter DELIVERY_DATE_FORMAT = DateTimeFormatter.ISO_LOCAL_DATE.withResolverStyle(ResolverStyle.STRICT);

	private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

	private static final int PAGE_SIZE = 20;

	/** 판매정보 추가등록 보증기간 드롭다운(없음·1·3·6·12·24·36개월 × 30일). 자유 숫자를 받으면 365·360 처럼 같은 뜻의 값이 흩어진다 (decisions.md 2026-10-06) */
	static final Set<Integer> WARRANTY_DAYS = Set.of(0, 30, 90, 180, 360, 720, 1080);

	private final ListingRepository listings;

	private final ListingSearchRepository searchRepository;

	private final ProductService products;

	private final CategoryRepository categories;

	private final UploadService uploads;

	private final Clock clock;

	@Transactional
	public ListingResponse create(UUID userId, ListingCreateRequest req) {
		List<String> photos = req.photos() == null ? List.of() : req.photos();
		String firstPhoto = photos.isEmpty() ? null : photos.get(0);

		int minOrderQuantity = req.minOrderQuantity() == null ? 1 : req.minOrderQuantity();
		int orderUnit = req.orderUnit() == null ? 1 : req.orderUnit();
		if (minOrderQuantity > req.salesQuantity()) {
			throw new ValidationException(Map.of("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다."));
		}

		// 마스터를 골랐으면 그 상품이 기준 — 요청의 상품 칸은 보지 않는다(클라이언트 값 불신)
		Product master = hasText(req.prodId()) ? products.find(req.prodId().trim())
			.orElseThrow(() -> new ValidationException(Map.of("prodId", "없는 상품입니다."))) : null;
		if (master == null) {
			requireProductFields(req);
		}
		// 대표 사진 필수. 마스터를 골랐고 그 마스터에 사진이 있으면 올리지 않아도 마스터 사진이 대표가 된다
		if (photos.isEmpty() && (master == null || !hasText(master.getProdPhoto1()))) {
			throw new ValidationException(Map.of("photos", "대표 사진을 올려 주세요."));
		}
		validateDates(master == null ? req.prodMufcDate() : null, req.deliveryDate());
		String categoryCode = master == null ? req.categoryCode().trim() : null;
		if (master == null) {
			requireCategory(categoryCode);
		}

		// 입력 검사(Redis 조회)를 상품마스터 채번·INSERT 보다 먼저 — 잘못된 키 요청이 DB 작업을 하지 않게
		List<UploadRef> files = new ArrayList<>();
		photos.forEach(p -> files.add(new UploadRef("photos", p, UploadKind.LISTING_PHOTO)));
		addRef(files, "listingDataSheet", req.listingDataSheet(), UploadKind.LISTING_DATASHEET);
		if (master == null) {
			addRef(files, "productDataSheet", req.productDataSheet(), UploadKind.LISTING_DATASHEET);
		}
		uploads.claim(userId, files);

		Product product = master != null ? master : products.findOrCreate(new ProductDraft(categoryCode, req.prodName().trim(),
				req.prodNo(), req.prodBrand().trim(), req.prodMufcDate(), req.prodSpecInfo(),
				// 새 마스터의 데이터시트는 이 판매자가 올린 것 (productDataSheet 칸은 폼이 안 보낸다)
				hasText(req.productDataSheet()) ? req.productDataSheet() : req.listingDataSheet(), firstPhoto));

		// 올리지 않은 데이터시트·사진만 마스터 것을 복사한다(키 문자열). 이미 저장된 파일이라 업로드 기록(claim) 대상이 아니다
		String dataSheet = hasText(req.listingDataSheet()) ? req.listingDataSheet() : product.getProdDataSheet();
		if (photos.isEmpty()) {
			photos = List.of(product.getProdPhoto1());
		}

		Listing listing = Listing.builder()
			.userId(userId)
			.regDate(LocalDateTime.now(clock).format(REG_DATE_FORMAT))
			.prodId(product.getProdId())
			.tradeType(req.tradeType())
			.prodState(req.prodState())
			.salesUnitPrice(req.salesUnitPrice())
			.salesQuantity(req.salesQuantity())
			.minOrderQuantity(minOrderQuantity)
			.orderUnit(orderUnit)
			.deliveryDate(req.deliveryDate() == null || req.deliveryDate().isEmpty() ? null : req.deliveryDate())
			.stockQuantity(req.stockQuantity() == null ? req.salesQuantity() : req.stockQuantity())
			.prodDescription(req.description())
			.prodDataSheet(dataSheet)
			.prodPhoto1(photoAt(photos, 0))
			.prodPhoto2(photoAt(photos, 1))
			.prodPhoto3(photoAt(photos, 2))
			.prodImage4(photoAt(photos, 3))
			.build();

		try {
			listings.saveAndFlush(listing);
		}
		catch (DataIntegrityViolationException e) {
			throw new ApiException(ErrorCode.LISTING_DUPLICATE_REG_TIME);
		}

		return toResponse(listing, product);
	}

	@Transactional
	public ListingResponse update(UUID pathUserId, String regDate, UUID requesterId, ListingUpdateRequest req) {
		Listing listing = lockOwned(pathUserId, regDate, requesterId);
		// 거래완료(재고 소진)된 매물은 못 고친다 (사용자 결정 2026-10-15). 취소로 재고가 돌아오면 dt_expire 가 지워져 다시 된다
		if (listing.getDtExpire() != null) {
			throw new ApiException(ErrorCode.LISTING_COMPLETED);
		}
		// 이미 저장된 납기일을 그대로 다시 보내면(수정 화면이 모든 칸을 보낼 때) 지난 날짜여도 통과
		Product currentProduct = products.get(listing.getProdId());
		// 제조일도 저장된 값 그대로면 건너뛴다 (납기일과 같은 이유). 새로 보낸 값만 오늘까지인지 본다
		String newMufcDate = req.prodMufcDate() == null || req.prodMufcDate().isEmpty()
				|| req.prodMufcDate().equals(currentProduct.getProdMufcDate()) ? null : req.prodMufcDate();
		validateDates(newMufcDate, Objects.equals(req.deliveryDate(), listing.getDeliveryDate()) ? null : req.deliveryDate());
		// 대표 사진 필수(등록 규칙)를 수정에서도 지킨다 — 사진이 있는 매물은 전부 뺄 수 없다.
		// 사진 없는 옛 매물은 [] 를 보내도 바뀌는 게 없어 막지 않는다
		if (req.photos() != null && req.photos().isEmpty() && firstPhoto(listing) != null) {
			throw new ValidationException(Map.of("photos", "대표 사진을 올려 주세요."));
		}
		// 저장된 값과 같으면 통과 — 옛 값(365)이 있는 매물의 다른 칸 수정이 막히지 않게 (납기일과 같은 이유)
		if (req.warrantyPeriod() != null && !WARRANTY_DAYS.contains(req.warrantyPeriod())
				&& !req.warrantyPeriod().equals(listing.getWarrantyPeriod())) {
			throw new ValidationException(Map.of("warrantyPeriod", "보증기간은 목록에서 고른 값이어야 합니다."));
		}
		int effectiveMinOrderQuantity = req.minOrderQuantity() == null ? listing.getMinOrderQuantity() : req.minOrderQuantity();
		int effectiveSalesQuantity = req.salesQuantity() == null ? listing.getSalesQuantity() : req.salesQuantity();
		if (effectiveMinOrderQuantity > effectiveSalesQuantity) {
			throw new ValidationException(Map.of("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다."));
		}

		if (req.categoryCode() != null) {
			requireCategory(req.categoryCode().trim());
		}

		// 상품 칸은 매물 칸보다 먼저 — 422 면 아무것도 바뀌지 않고, 업로드 키도 건드리지 않는다
		Product product = applyProductFields(listing, currentProduct, req);

		List<UploadRef> files = new ArrayList<>();
		if (req.photos() != null) {
			req.photos().forEach(p -> files.add(new UploadRef("photos", p, UploadKind.LISTING_PHOTO)));
		}
		addRef(files, "listingDataSheet", req.listingDataSheet(), UploadKind.LISTING_DATASHEET);
		addRef(files, "testReport", req.testReport(), UploadKind.LISTING_TEST_REPORT);
		addRef(files, "certificateOfAuthen", req.certificateOfAuthen(), UploadKind.LISTING_CERTIFICATE);
		// 이 매물에 이미 저장된 키는 업로드 기록(등록 때 지움) 없이 통과 — 사진 1장만 바꿔도 나머지를 다시 올리지 않게.
		// 용도가 맞는지는 키 형식으로 여전히 본다 (기존 사진 키를 테스트리포트 칸에 옮기는 것 차단)
		Set<String> stored = storedFileKeys(listing);
		files.removeIf(f -> stored.contains(f.key()) && UploadKind.ofKey(f.key()).filter(f.kind()::equals).isPresent());
		uploads.claim(requesterId, files);

		listing.applyUpdate(req, LocalDateTime.now(clock).format(REG_DATE_FORMAT));
		return toResponse(listing, product);
	}

	/** 마스터를 안 고른 등록은 상품 칸 세 개가 필수 — 조건부라 Bean Validation 대신 여기서 같은 400 필드 오류로 */
	private static void requireProductFields(ListingCreateRequest req) {
		Map<String, String> missing = new LinkedHashMap<>();
		if (!hasText(req.categoryCode())) {
			missing.put("categoryCode", "필수 입력입니다.");
		}
		if (!hasText(req.prodName())) {
			missing.put("prodName", "필수 입력입니다.");
		}
		if (!hasText(req.prodBrand())) {
			missing.put("prodBrand", "필수 입력입니다.");
		}
		if (!missing.isEmpty()) {
			throw new ValidationException(missing);
		}
	}

	private static boolean hasText(String s) {
		return s != null && !s.isBlank();
	}

	/** 카테고리는 trd_ctgr_code 에 있는 코드만. FK 위반(500)이 되기 전에 필드 오류로 알린다 */
	private void requireCategory(String code) {
		if (!categories.existsById(code)) {
			throw new ValidationException(Map.of("categoryCode", "없는 카테고리 코드입니다."));
		}
	}

	/**
	 * 상품 칸 규칙 (스펙 2026-10-06-my-listings). 상품마스터는 (이름, 제조사)가 유일하고 다른 판매자 매물과 공유한다.
	 * 이름·제조사가 바뀌면 등록과 같은 findOrCreate 로 그 이름의 상품을 찾아 이 매물만 옮긴다 (있으면 그 상품 값, 없으면 새로 만든다).
	 * 그대로이고 번호·제조일·사양·카테고리만 바뀌면 이 매물만 쓰는 상품일 때만 고친다 — 공유 중이면 남의 매물까지 바뀌므로 422.
	 */
	private Product applyProductFields(Listing listing, Product current, ListingUpdateRequest req) {
		if (!req.hasProductFields()) {
			return current;
		}
		String name = req.prodName() == null ? current.getProdName() : req.prodName().trim();
		String brand = req.prodBrand() == null ? current.getProdBrand() : req.prodBrand().trim();
		if (!name.equals(current.getProdName()) || !brand.equals(current.getProdBrand())) {
			String category = req.categoryCode() == null ? current.getCategoryCode() : req.categoryCode().trim();
			// 안 보낸 칸은 옛 상품 값을 이어받는다 (이름만 바꿔도 번호·제조일이 사라지지 않게)
			Product target = products.findOrCreate(new ProductDraft(category, name,
					textOrCurrent(req.prodNo(), current.getProdNo()), brand,
					textOrCurrent(req.prodMufcDate(), current.getProdMufcDate()),
					textOrCurrent(req.prodSpecInfo(), current.getProdSpecInfo()),
					// 옛 상품의 데이터시트·사진은 처음 등록한 다른 판매자의 파일일 수 있어 물려주지 않는다. 사진은 이 매물의 첫 사진
					null, firstPhoto(listing)));
			listing.changeProduct(target.getProdId());
			return target;
		}

		Map<String, String> changed = new LinkedHashMap<>();
		putIfChanged(changed, "categoryCode", req.categoryCode() == null ? null : req.categoryCode().trim(), current.getCategoryCode());
		putIfChanged(changed, "prodNo", req.prodNo(), current.getProdNo());
		putIfChanged(changed, "prodMufcDate", req.prodMufcDate(), current.getProdMufcDate());
		putIfChanged(changed, "prodSpecInfo", req.prodSpecInfo(), current.getProdSpecInfo());
		if (changed.isEmpty()) {
			return current;
		}
		if (listings.countByProdId(current.getProdId()) > 1) {
			Map<String, String> fields = new LinkedHashMap<>();
			changed.keySet().forEach(f -> fields.put(f, ErrorCode.PRODUCT_SHARED.message()));
			throw new ApiException(ErrorCode.PRODUCT_SHARED, ErrorCode.PRODUCT_SHARED.message(), fields);
		}
		current.applyEdit(req.categoryCode(), req.prodNo(), req.prodMufcDate(), req.prodSpecInfo());
		return current;
	}

	/** 보낸 값이 있으면(빈 문자열은 비우기 = null) 그 값, 안 보냈으면 옛 값 */
	private static String textOrCurrent(String sent, String current) {
		return sent == null ? current : sent.isEmpty() ? null : sent;
	}

	/** 보냈고 저장된 값과 다를 때만 (빈 문자열 = null 로 비교) */
	private static void putIfChanged(Map<String, String> changed, String field, String sent, String stored) {
		if (sent == null) {
			return;
		}
		String normalized = sent.isEmpty() ? null : sent;
		if (!Objects.equals(normalized, stored)) {
			changed.put(field, sent);
		}
	}

	@Transactional
	public void delete(UUID pathUserId, String regDate, UUID requesterId) {
		Listing listing = lockOwned(pathUserId, regDate, requesterId);
		// 거래가 1건이라도 있으면 trd_trade_info 의 매물 FK 가 막는다. 거래 테이블을 여기서 직접 보지 않으려고(도메인 간은
		// service 로만, 거래 → 매물 방향이라 역참조 불가) 위반을 잡아 409 로 바꾼다. flush 해야 이 메서드 안에서 위반이 난다
		try {
			listings.delete(listing);
			listings.flush();
		}
		catch (DataIntegrityViolationException e) {
			throw new ApiException(ErrorCode.LISTING_HAS_TRADES);
		}
	}

	/**
	 * 수정·삭제 대상: 소유자 확인을 먼저 하고 그다음 행을 잠그고 읽는다. 잠금 먼저면 남이 수정·삭제 요청을 반복해
	 * 매물 행을 잠가 구매요청을 막을 수 있다. 확인용 조회는 엔티티를 올리지 않는다(existsById) — 먼저 올려 두면
	 * 잠금 조회가 그 옛 상태를 그대로 돌려준다. 없는 매물은 남이 보내도 404 (기존 응답 그대로)
	 */
	private Listing lockOwned(UUID pathUserId, String regDate, UUID requesterId) {
		if (!requesterId.equals(pathUserId)) {
			throw new ApiException(listings.existsById(new ListingId(pathUserId, regDate)) ? ErrorCode.FORBIDDEN
					: ErrorCode.LISTING_NOT_FOUND);
		}
		return listings.findForUpdate(pathUserId, regDate).orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
	}

	/**
	 * 구매요청용 — 행을 잠그고 읽는다. 잠금 없이 읽으면 판매자 수정이 그 뒤 커밋돼도 옛 단가·최소주문량으로 거래가
	 * 저장된다. 같은 매물의 구매·수정은 이 잠금으로 차례가 정해진다 (거래ID 의 시간대 락보다 먼저 잡아, 한 매물에서
	 * 기다리는 요청이 다른 매물 구매를 막지 않게)
	 */
	@Transactional
	public ListingTradeSnapshot lockForTrade(UUID sellerId, String regDate) {
		Listing listing = listings.findForUpdate(sellerId, regDate)
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		return toSnapshot(listing, products.get(listing.getProdId()));
	}

	/** 구매요청이 복사해 갈 매물 값 (거래 도메인용) */
	public ListingTradeSnapshot snapshotForTrade(UUID sellerId, String regDate) {
		Listing listing = listings.findById(new ListingId(sellerId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		return toSnapshot(listing, products.get(listing.getProdId()));
	}

	private static ListingTradeSnapshot toSnapshot(Listing listing, Product product) {
		String photo = firstPhoto(listing);
		return new ListingTradeSnapshot(listing.getUserId(), listing.getRegDate(), listing.getProdId(),
				product.getProdName(), listing.getProdState(), listing.getSalesUnitPrice(), listing.getStockQuantity(),
				listing.getMinOrderQuantity(), listing.getOrderUnit(), listing.getDeliveryDate(),
				listing.getDtExpire() != null, photo != null && photo.startsWith("public/") ? photo : null);
	}

	/** 거래 목록용 — 여러 매물의 스냅샷을 매물·상품 각 한 쿼리로. 없는 키는 빠진다 */
	public Map<ListingId, ListingTradeSnapshot> snapshotsForTrades(Collection<ListingId> ids) {
		List<Listing> found = listings.findAllById(ids);
		Map<String, Product> productsById = products.getAll(found.stream().map(Listing::getProdId).collect(Collectors.toSet()));
		return found.stream().collect(Collectors.toMap(Listing::getId, l -> toSnapshot(l, productsById.get(l.getProdId()))));
	}

	/** 구매요청의 재고 차감. 재고 부족·거래완료면 TRADE_OUT_OF_STOCK (호출자 트랜잭션에 합류해 같이 롤백) */
	@Transactional
	public void reserveStock(UUID sellerId, String regDate, int quantity) {
		if (listings.reserveStock(sellerId, regDate, quantity, LocalDateTime.now(clock).format(REG_DATE_FORMAT)) == 0) {
			throw new ApiException(ErrorCode.TRADE_OUT_OF_STOCK);
		}
	}

	/** 거래 취소로 재고 복원 + 거래완료일시 지움 */
	@Transactional
	public void releaseStock(UUID sellerId, String regDate, int quantity) {
		listings.releaseStock(sellerId, regDate, quantity);
	}

	public ListingResponse get(UUID userId, String regDate) {
		Listing listing = listings.findById(new ListingId(userId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		return toResponse(listing, products.get(listing.getProdId()));
	}

	/** ownerId = null 이면 전체, 있으면 그 사용자 글만 (컨트롤러가 mine=true 일 때 인증 정보에서 넣는다) */
	public ListingPageResponse search(ListingSearchCondition condition, UUID ownerId) {
		if (condition.minPrice() != null && condition.maxPrice() != null && condition.minPrice() > condition.maxPrice()) {
			throw new ValidationException(Map.of("maxPrice", "최대 가격은 최소 가격보다 크거나 같아야 합니다."));
		}
		Optional<Cursor> cursor = decodeCursor(condition.cursor());
		List<Object[]> rows = searchRepository.findPage(condition, ownerId, cursor.map(Cursor::regDate).orElse(null),
				cursor.map(Cursor::userId).orElse(null), PAGE_SIZE + 1);
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<Object[]> page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;

		List<ListingSearchItemResponse> items = page.stream().map(r -> toSearchItem((Listing) r[0], (Product) r[1])).toList();
		String nextCursor = hasMore ? encodeCursor((Listing) page.get(page.size() - 1)[0]) : null;
		return new ListingPageResponse(items, nextCursor, searchRepository.count(condition, ownerId));
	}

	/** 내 매물만 최신순 20개씩. 커서는 regDate 하나 — 같은 사용자의 regDate 는 유일하다. 깨진 커서는 첫 페이지 */
	public ListingMinePageResponse mine(UUID userId, String cursor) {
		String after = cursor != null && cursor.matches("\\d{14}") ? cursor : null;
		List<Object[]> rows = searchRepository.findMinePage(userId, after, PAGE_SIZE + 1);
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<Object[]> page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
		List<ListingMineItemResponse> items = page.stream().map(r -> {
			Listing l = (Listing) r[0];
			Product p = (Product) r[1];
			return new ListingMineItemResponse(l.getUserId(), l.getRegDate(), p.getProdNo(), p.getProdName(), p.getProdBrand(),
					l.extraFilledCount());
		}).toList();
		return new ListingMinePageResponse(items, hasMore ? ((Listing) page.get(page.size() - 1)[0]).getRegDate() : null);
	}

	/** 커서는 "regDate_userId". reg_date 만으로는 같은 초의 다른 사용자를 페이지 경계에서 건너뛸 수 있어 튜플로 묶는다 */
	private static String encodeCursor(Listing listing) {
		return listing.getRegDate() + "_" + listing.getUserId();
	}

	/** 형식이 깨진 커서는 예외 없이 "첫 페이지"로 취급한다 — 500 대신 안전한 기본 동작 */
	private static Optional<Cursor> decodeCursor(String cursor) {
		if (cursor == null) {
			return Optional.empty();
		}
		int sep = cursor.lastIndexOf('_');
		if (sep < 0) {
			return Optional.empty();
		}
		try {
			return Optional.of(new Cursor(cursor.substring(0, sep), UUID.fromString(cursor.substring(sep + 1))));
		}
		catch (IllegalArgumentException e) {
			return Optional.empty();
		}
	}

	private record Cursor(String regDate, UUID userId) {
	}

	private static ListingSearchItemResponse toSearchItem(Listing listing, Product product) {
		// 상세 화면과 같게 매물 값만 본다. 상품마스터 파일은 처음 등록한 다른 판매자의 것 (decisions.md 2026-10-02 매물 상세)
		boolean hasPhoto = Stream
			.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4())
			.anyMatch(Objects::nonNull);
		boolean hasDataSheet = listing.getProdDataSheet() != null;
		return new ListingSearchItemResponse(listing.getUserId(), listing.getRegDate(), product.getProdNo(),
				product.getProdName(), product.getProdBrand(), product.getCategoryCode(),
				product.mufcDateIso(), listing.getProdDescription(), hasDataSheet, hasPhoto,
				listing.warrantyUntil(), listing.getWarrantyCoverage(),
				listing.getReplaceProd() != null, listing.getTestReport() != null, listing.getCertificateOfAuthen() != null,
				listing.getProdState(), listing.getStockQuantity(), listing.getSalesUnitPrice(), listing.getDeliveryDate(),
				listing.tradeStatus());
	}

	/**
	 * 형식(@Pattern)은 DTO가 보고, 여기서는 실제 날짜인지와 범위를 본다: 제조일은 오늘까지, 납기일은 오늘부터.
	 * "오늘"은 한국 날짜 — 서버 Clock 은 UTC 라 그대로 쓰면 한국 오전 9시 전엔 하루 전 날짜가 된다.
	 */
	private void validateDates(String prodMufcDate, String deliveryDate) {
		LocalDate today = LocalDate.now(clock.withZone(SEOUL));
		Map<String, String> failures = new LinkedHashMap<>();
		if (prodMufcDate != null) {
			LocalDate date = parseStrict(prodMufcDate, MUFC_DATE_FORMAT);
			if (date == null) {
				failures.put("prodMufcDate", "제조일이 올바른 날짜가 아닙니다.");
			}
			else if (date.isAfter(today)) {
				failures.put("prodMufcDate", "제조일은 오늘 이전 날짜로 입력하세요.");
			}
		}
		if (deliveryDate != null && !deliveryDate.isEmpty()) {
			LocalDate date = parseStrict(deliveryDate, DELIVERY_DATE_FORMAT);
			if (date == null) {
				failures.put("deliveryDate", "납기일이 올바른 날짜가 아닙니다.");
			}
			else if (date.isBefore(today)) {
				failures.put("deliveryDate", "납기일은 오늘 이후 날짜로 입력하세요.");
			}
		}
		if (!failures.isEmpty()) {
			throw new ValidationException(failures);
		}
	}

	private static LocalDate parseStrict(String value, DateTimeFormatter format) {
		try {
			return LocalDate.parse(value, format);
		}
		catch (DateTimeParseException e) {
			return null;
		}
	}

	/** null(안 바꿈)·""(비우기)는 업로드 키가 아니므로 확인 대상에서 뺀다 */
	private static void addRef(List<UploadRef> refs, String field, String key, UploadKind kind) {
		if (key != null && !key.isEmpty()) {
			refs.add(new UploadRef(field, key, kind));
		}
	}

	/** 대표 사진 = 비어 있지 않은 첫 사진 칸 (상세 photos 의 첫 장과 같다). 옛 데이터는 첫 칸이 비어 있을 수 있다 */
	private static String firstPhoto(Listing listing) {
		return Stream.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4())
			.filter(Objects::nonNull)
			.findFirst()
			.orElse(null);
	}

	private static Set<String> storedFileKeys(Listing listing) {
		return Stream
			.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4(),
					listing.getProdDataSheet(), listing.getTestReport(), listing.getCertificateOfAuthen())
			.filter(Objects::nonNull)
			.collect(Collectors.toSet());
	}

	private static String photoAt(List<String> photos, int index) {
		return index < photos.size() ? photos.get(index) : null;
	}

	private static ListingResponse toResponse(Listing listing, Product product) {
		List<String> photos = Stream
			.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4())
			.filter(Objects::nonNull)
			.toList();
		return new ListingResponse(listing.getUserId(), listing.getRegDate(), listing.getProdId(), product.getProdName(),
				product.getProdBrand(), product.getProdNo(), product.getProdSpecInfo(), listing.getTradeType(), listing.getProdState(),
				listing.getSalesUnitPrice(), listing.getSalesQuantity(), listing.getMinOrderQuantity(), listing.getOrderUnit(),
				listing.getDeliveryDate(), listing.getStockQuantity(), listing.getProdDescription(), listing.getProdDataSheet(), photos,
				listing.getWarrantyPeriod(), listing.getWarrantyCoverage(), listing.getReplaceProd(), listing.getTestReport(),
				listing.getCertificateOfAuthen(), listing.getDtUpdate(), listing.getDtExpire(), product.getCategoryCode(),
				product.mufcDateIso(),
				listing.tradeStatus(),
				listing.warrantyUntil());
	}

}
