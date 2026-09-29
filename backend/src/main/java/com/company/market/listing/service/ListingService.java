package com.company.market.listing.service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Stream;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingResponse;
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
