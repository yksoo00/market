package com.company.market.listing.controller;

import java.time.Duration;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.service.ListingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

}
