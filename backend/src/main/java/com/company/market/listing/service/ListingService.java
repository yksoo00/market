package com.company.market.listing.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.dto.ListingSummaryResponse;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.service.ProductService.ProductDraft;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ListingService {

	private static final DateTimeFormatter REG_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	private static final int PAGE_SIZE = 20;

	private final ListingRepository listings;

	private final ProductService products;

	private final Clock clock;

	@Transactional
	public ListingResponse create(UUID userId, ListingCreateRequest req) {
		List<String> photos = req.photos() == null ? List.of() : req.photos();
		String firstPhoto = photos.isEmpty() ? null : photos.get(0);

		Product product = products.findOrCreate(new ProductDraft(req.categoryCode(), req.prodName().trim(), req.prodNo(),
				req.prodBrand().trim(), req.prodMufcDate(), req.prodSpecInfo(), req.productDataSheet(), firstPhoto));

		int minOrderQuantity = req.minOrderQuantity() == null ? 1 : req.minOrderQuantity();
		int orderUnit = req.orderUnit() == null ? 1 : req.orderUnit();
		if (minOrderQuantity > req.salesQuantity()) {
			throw new ValidationException(Map.of("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다."));
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
			.deliveryDate(req.deliveryDate())
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
		int effectiveMinOrderQuantity = req.minOrderQuantity() == null ? listing.getMinOrderQuantity() : req.minOrderQuantity();
		int effectiveSalesQuantity = req.salesQuantity() == null ? listing.getSalesQuantity() : req.salesQuantity();
		if (effectiveMinOrderQuantity > effectiveSalesQuantity) {
			throw new ValidationException(Map.of("minOrderQuantity", "최소주문량은 판매수량을 넘을 수 없습니다."));
		}
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

	public ListingPageResponse list(String cursor) {
		List<Listing> page = decodeCursor(cursor)
			.map(c -> listings.findPageBefore(c.regDate(), c.userId(), PageRequest.of(0, PAGE_SIZE + 1)))
			.orElseGet(listings::findTop21ByOrderByRegDateDescUserIdDesc);
		boolean hasMore = page.size() > PAGE_SIZE;
		List<Listing> items = hasMore ? page.subList(0, PAGE_SIZE) : page;

		Map<String, Product> productsById = products.getAll(items.stream().map(Listing::getProdId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Product::getProdId, p -> p));

		List<ListingSummaryResponse> summaries = items.stream().map(listing -> toSummary(listing, productsById.get(listing.getProdId()))).toList();
		String nextCursor = hasMore ? encodeCursor(items.get(items.size() - 1)) : null;
		return new ListingPageResponse(summaries, nextCursor);
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

	private static ListingSummaryResponse toSummary(Listing listing, Product product) {
		String thumbnail = Stream
			.of(listing.getProdPhoto1(), listing.getProdPhoto2(), listing.getProdPhoto3(), listing.getProdImage4())
			.filter(Objects::nonNull)
			.findFirst()
			.orElse(null);
		return new ListingSummaryResponse(listing.getUserId(), listing.getRegDate(), listing.getProdId(), product.getProdName(),
				product.getProdBrand(), listing.getSalesUnitPrice(), listing.getSalesQuantity(), listing.getProdState(), thumbnail);
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
				toIsoDate(product.getProdMufcDate()), product.getProdDataSheet(), product.getProdPhoto1(),
				// 거래 흐름이 정해지기 전까지 거래완료일시 유무로만 판단 (decisions.md 2026-10-01 검색 결과)
				listing.getDtExpire() == null ? "available" : "completed",
				warrantyUntil(listing.getRegDate(), listing.getWarrantyPeriod()));
	}

	/** 등록 API 가 제조일 형식을 검사하지 않아, 날짜로 읽히지 않는 값은 버리지 않고 원문 그대로 둔다 */
	private static String toIsoDate(String raw) {
		if (raw == null || !raw.matches("\\d{8}|\\d{14}")) {
			return raw;
		}
		try {
			return LocalDate.parse(raw.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE).toString();
		}
		catch (DateTimeParseException e) {
			return raw;
		}
	}

	/** DB 는 보증 일수만 갖고 있어 등록일 + 일수로 만료일을 계산한다 */
	private static String warrantyUntil(String regDate, Integer days) {
		if (days == null) {
			return null;
		}
		return LocalDate.parse(regDate.substring(0, 8), DateTimeFormatter.BASIC_ISO_DATE).plusDays(days).toString();
	}

}
