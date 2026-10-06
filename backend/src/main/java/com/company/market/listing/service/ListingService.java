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
import com.company.market.listing.dto.ListingUpdateRequest;
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

	private final ListingRepository listings;

	private final ListingSearchRepository searchRepository;

	private final ProductService products;

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
		validateDates(req.prodMufcDate(), req.deliveryDate());

		// 입력 검사(Redis 조회)를 상품마스터 채번·INSERT 보다 먼저 — 잘못된 키 요청이 DB 작업을 하지 않게
		List<UploadRef> files = new ArrayList<>();
		photos.forEach(p -> files.add(new UploadRef("photos", p, UploadKind.LISTING_PHOTO)));
		addRef(files, "listingDataSheet", req.listingDataSheet(), UploadKind.LISTING_DATASHEET);
		addRef(files, "productDataSheet", req.productDataSheet(), UploadKind.LISTING_DATASHEET);
		uploads.claim(userId, files);

		Product product = products.findOrCreate(new ProductDraft(req.categoryCode(), req.prodName().trim(), req.prodNo(),
				req.prodBrand().trim(), req.prodMufcDate(), req.prodSpecInfo(), req.productDataSheet(), firstPhoto));

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
			.prodDataSheet(req.listingDataSheet())
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
		Listing listing = listings.findById(new ListingId(pathUserId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		if (!requesterId.equals(pathUserId)) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		// 이미 저장된 납기일을 그대로 다시 보내면(수정 화면이 모든 칸을 보낼 때) 지난 날짜여도 통과
		validateDates(null, Objects.equals(req.deliveryDate(), listing.getDeliveryDate()) ? null : req.deliveryDate());
		int effectiveMinOrderQuantity = req.minOrderQuantity() == null ? listing.getMinOrderQuantity() : req.minOrderQuantity();
		int effectiveSalesQuantity = req.salesQuantity() == null ? listing.getSalesQuantity() : req.salesQuantity();
		if (effectiveMinOrderQuantity > effectiveSalesQuantity) {
			throw new ValidationException(Map.of("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다."));
		}

		List<UploadRef> files = new ArrayList<>();
		if (req.photos() != null) {
			req.photos().forEach(p -> files.add(new UploadRef("photos", p, UploadKind.LISTING_PHOTO)));
		}
		addRef(files, "listingDataSheet", req.listingDataSheet(), UploadKind.LISTING_DATASHEET);
		addRef(files, "testReport", req.testReport(), UploadKind.LISTING_TEST_REPORT);
		addRef(files, "certificateOfAuthen", req.certificateOfAuthen(), UploadKind.LISTING_CERTIFICATE);
		addRef(files, "replaceProd", req.replaceProd(), UploadKind.LISTING_REPLACE_PROD);
		// 이 매물에 이미 저장된 키는 업로드 기록(등록 때 지움) 없이 통과 — 사진 1장만 바꿔도 나머지를 다시 올리지 않게.
		// 용도가 맞는지는 키 형식으로 여전히 본다 (기존 사진 키를 테스트리포트 칸에 옮기는 것 차단)
		Set<String> stored = storedFileKeys(listing);
		files.removeIf(f -> stored.contains(f.key()) && UploadKind.ofKey(f.key()).filter(f.kind()::equals).isPresent());
		uploads.claim(requesterId, files);

		listing.applyUpdate(req, LocalDateTime.now(clock).format(REG_DATE_FORMAT));
		return toResponse(listing, products.get(listing.getProdId()));
	}

	@Transactional
	public void delete(UUID pathUserId, String regDate, UUID requesterId) {
		Listing listing = listings.findById(new ListingId(pathUserId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		if (!requesterId.equals(pathUserId)) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
		listings.delete(listing);
	}

	public ListingResponse get(UUID userId, String regDate) {
		Listing listing = listings.findById(new ListingId(userId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		return toResponse(listing, products.get(listing.getProdId()));
	}

	public ListingPageResponse search(ListingSearchCondition condition) {
		if (condition.minPrice() != null && condition.maxPrice() != null && condition.minPrice() > condition.maxPrice()) {
			throw new ValidationException(Map.of("maxPrice", "최대 가격은 최소 가격보다 크거나 같아야 합니다."));
		}
		Optional<Cursor> cursor = decodeCursor(condition.cursor());
		List<Object[]> rows = searchRepository.findPage(condition, cursor.map(Cursor::regDate).orElse(null),
				cursor.map(Cursor::userId).orElse(null), PAGE_SIZE + 1);
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<Object[]> page = hasMore ? rows.subList(0, PAGE_SIZE) : rows;

		List<ListingSearchItemResponse> items = page.stream().map(r -> toSearchItem((Listing) r[0], (Product) r[1])).toList();
		String nextCursor = hasMore ? encodeCursor((Listing) page.get(page.size() - 1)[0]) : null;
		return new ListingPageResponse(items, nextCursor, searchRepository.count(condition));
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

	private static Set<String> storedFileKeys(Listing listing) {
		return Stream
			.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4(),
					listing.getProdDataSheet(), listing.getTestReport(), listing.getCertificateOfAuthen(), listing.getReplaceProd())
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
