package com.company.market.listing.service;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.exception.ValidationException;
import com.company.market.common.storage.UploadService;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.repository.ListingRepository;
import com.company.market.listing.repository.ListingSearchRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ListingServiceTest {

	@Mock
	ListingRepository listings;

	@Mock
	ProductService products;

	@Mock
	ListingSearchRepository searchRepository;

	@Mock
	UploadService uploads;

	@Test
	@DisplayName("저장 시 복합키 충돌(DataIntegrityViolationException)이면 LISTING_DUPLICATE_REG_TIME 으로 바뀐다")
	void translatesDuplicateKeyViolation() {
		Clock clock = Clock.fixed(Instant.parse("2026-09-29T12:00:00Z"), ZoneOffset.UTC);
		ListingService service = new ListingService(listings, searchRepository, products, uploads, clock);
		when(products.findOrCreate(any())).thenReturn(Product.builder().prodId("ELEC00010001").regDate("20260929120000")
			.categoryCode("ELEC0001").prodName("노트북").prodBrand("삼성").build());
		when(listings.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

		ListingCreateRequest req = new ListingCreateRequest("ELEC0001", "노트북", null, "삼성", null, null, null,
			"판매", "신품", 1000, 1, null, null, null, null, null, null, null);

		assertThatThrownBy(() -> service.create(UUID.randomUUID(), req))
			.isInstanceOf(ApiException.class)
			.extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LISTING_DUPLICATE_REG_TIME);
	}

	@Test
	@DisplayName("한국 날짜 기준: UTC 23:30(한국 다음 날 08:30)에 한국 오늘을 납기일·제조일로 넣으면 통과")
	void datesUseSeoulToday() {
		Clock clock = Clock.fixed(Instant.parse("2026-10-01T23:30:00Z"), ZoneOffset.UTC);
		ListingService service = new ListingService(listings, searchRepository, products, uploads, clock);
		when(products.findOrCreate(any())).thenReturn(Product.builder().prodId("ELEC00010001").regDate("20261001233000")
			.categoryCode("ELEC0001").prodName("노트북").prodBrand("삼성").build());

		service.create(UUID.randomUUID(), new ListingCreateRequest("ELEC0001", "노트북", null, "삼성", "20261002", null, null,
				"판매", "신품", 1000, 1, null, null, "2026-10-02", null, null, null, null));

		assertThatThrownBy(() -> service.create(UUID.randomUUID(), new ListingCreateRequest("ELEC0001", "노트북", null, "삼성",
				null, null, null, "판매", "신품", 1000, 1, null, null, "2026-10-01", null, null, null, null)))
			.isInstanceOfSatisfying(ValidationException.class, e -> assertThat(e.getFields()).containsKey("deliveryDate"));
	}

}
