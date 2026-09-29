package com.company.market.listing.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.dto.ListingSummaryResponse;
import com.company.market.listing.repository.ListingRepository;
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

	private static final int PAGE_SIZE = 20;

	private final ListingRepository listings;

	private final ProductService products;

	@Transactional
	public ListingResponse create(UUID userId, ListingCreateRequest req) {
		List<String> photos = req.photos() == null ? List.of() : req.photos();
		String firstPhoto = photos.isEmpty() ? null : photos.get(0);

		Product product = products.findOrCreate(new ProductDraft(req.categoryCode(), req.prodName(), req.prodNo(),
				req.prodBrand(), req.prodMufcDate(), req.prodSpecInfo(), req.productDataSheet(), firstPhoto));

		int minOrderQuantity = req.minOrderQuantity() == null ? 1 : req.minOrderQuantity();
		int orderUnit = req.orderUnit() == null ? 1 : req.orderUnit();

		Listing listing = Listing.builder()
			.userId(userId)
			.regDate(LocalDateTime.now().format(REG_DATE_FORMAT))
			.prodId(product.getProdId())
			.tradeType(req.tradeType())
			.prodState(req.prodState())
			.salesUnitPrice(req.salesUnitPrice())
			.salesQuantity(req.salesQuantity())
			.minOrderQuantity(minOrderQuantity)
			.orderUnit(orderUnit)
			.deliveryDate(req.deliveryDate())
			.stockQuantity(req.stockQuantity())
			.prodDescription(req.description())
			.prodDataSheet(req.listingDataSheet())
			.prodPhoto1(photoAt(photos, 0))
			.prodPhoto2(photoAt(photos, 1))
			.prodPhoto3(photoAt(photos, 2))
			.prodImage4(photoAt(photos, 3))
			.warrantyPeriod(req.warrantyPeriod())
			.warrantyCoverage(req.warrantyCoverage())
			.replaceProd(req.replaceProd())
			.testReport(req.testReport())
			.certificateOfAuthen(req.certificateOfAuthen())
			.build();

		try {
			listings.save(listing);
		}
		catch (DataIntegrityViolationException e) {
			throw new ApiException(ErrorCode.LISTING_DUPLICATE_REG_TIME);
		}

		return toResponse(listing, product);
	}

	public ListingResponse get(UUID userId, String regDate) {
		Listing listing = listings.findById(new ListingId(userId, regDate))
			.orElseThrow(() -> new ApiException(ErrorCode.LISTING_NOT_FOUND));
		return toResponse(listing, products.get(listing.getProdId()));
	}

	public ListingPageResponse list(String cursor) {
		List<Listing> page = cursor == null ? listings.findTop21ByOrderByRegDateDesc()
				: listings.findTop21ByRegDateLessThanOrderByRegDateDesc(cursor);
		boolean hasMore = page.size() > PAGE_SIZE;
		List<Listing> items = hasMore ? page.subList(0, PAGE_SIZE) : page;

		Map<String, Product> productsById = products.getAll(items.stream().map(Listing::getProdId).distinct().toList())
			.stream()
			.collect(Collectors.toMap(Product::getProdId, p -> p));

		List<ListingSummaryResponse> summaries = items.stream().map(listing -> toSummary(listing, productsById.get(listing.getProdId()))).toList();
		String nextCursor = hasMore ? items.get(items.size() - 1).getRegDate() : null;
		return new ListingPageResponse(summaries, nextCursor);
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
				product.getProdBrand(), listing.getTradeType(), listing.getProdState(), listing.getSalesUnitPrice(),
				listing.getSalesQuantity(), listing.getMinOrderQuantity(), listing.getOrderUnit(), listing.getDeliveryDate(),
				listing.getStockQuantity(), listing.getProdDescription(), photos, listing.getWarrantyPeriod(),
				listing.getWarrantyCoverage(), listing.getReplaceProd(), listing.getTestReport(),
				listing.getCertificateOfAuthen(), listing.getDtUpdate(), listing.getDtExpire());
	}

}
