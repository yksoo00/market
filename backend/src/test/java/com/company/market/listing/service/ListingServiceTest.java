package com.company.market.listing.service;

import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.listing.domain.Product;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.repository.ListingRepository;
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

	@Test
	@DisplayName("저장 시 복합키 충돌(DataIntegrityViolationException)이면 LISTING_DUPLICATE_REG_TIME 으로 바뀐다")
	void translatesDuplicateKeyViolation() {
		ListingService service = new ListingService(listings, products);
		when(products.findOrCreate(any())).thenReturn(Product.builder().prodId("ELEC00010001").regDate("20260929120000")
			.categoryCode("ELEC0001").prodName("노트북").prodBrand("삼성").build());
		when(listings.save(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

		ListingCreateRequest req = new ListingCreateRequest("ELEC0001", "노트북", null, "삼성", null, null, null,
			"등록", "new", 1000, 1, null, null, null, null, null, null, null, null, null, null, null, null);

		assertThatThrownBy(() -> service.create(UUID.randomUUID(), req))
			.isInstanceOf(ApiException.class)
			.extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.LISTING_DUPLICATE_REG_TIME);
	}

}
