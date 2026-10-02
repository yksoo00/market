package com.company.market.listing.controller;

import java.time.Duration;
import java.util.UUID;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.dto.ListingSearchCondition;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.service.ListingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/listings")
@RequiredArgsConstructor
public class ListingController {

	private final ListingService listings;

	private final RateLimiter limiter;

	@PostMapping
	public ResponseEntity<ApiResponse<ListingResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody ListingCreateRequest req) {
		limiter.hit("listing:create:" + me.id(), 10, Duration.ofHours(1));
		ListingResponse created = listings.create(me.id(), req);
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	@GetMapping
	public ApiResponse<ListingPageResponse> list(@ModelAttribute ListingSearchCondition condition) {
		return ApiResponse.of(listings.search(condition));
	}

	@GetMapping("/{userId}/{regDate}")
	public ApiResponse<ListingResponse> get(@PathVariable UUID userId, @PathVariable String regDate) {
		return ApiResponse.of(listings.get(userId, regDate));
	}

	@PatchMapping("/{userId}/{regDate}")
	public ApiResponse<ListingResponse> update(@AuthenticationPrincipal AuthenticatedUser me,
			@PathVariable UUID userId, @PathVariable String regDate, @Valid @RequestBody ListingUpdateRequest req) {
		limiter.hit("listing:update:" + me.id(), 20, Duration.ofHours(1));
		return ApiResponse.of(listings.update(userId, regDate, me.id(), req));
	}

	@DeleteMapping("/{userId}/{regDate}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me,
			@PathVariable UUID userId, @PathVariable String regDate) {
		limiter.hit("listing:delete:" + me.id(), 10, Duration.ofHours(1));
		listings.delete(userId, regDate, me.id());
		return ResponseEntity.noContent().build();
	}

}
