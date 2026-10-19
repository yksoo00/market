package com.company.market.listing.controller;

import java.util.UUID;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.idempotency.IdempotencyGuard;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingMinePageResponse;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/listings")
@RequiredArgsConstructor
public class ListingController {

	private final ListingService listings;

	private final IdempotencyGuard idempotency;

	@PostMapping
	public ResponseEntity<ApiResponse<ListingResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody ListingCreateRequest req,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
		// TODO(rate limit 보류, decisions.md 2026-10-19): 등록·수정·삭제·비로그인 검색 한도를 지웠다. 운영 전에 다시 넣는다
		ListingResponse created = idempotency.run("listing-create", me.id(), idempotencyKey,
				() -> listings.create(me.id(), req),
				ListingResponse::regDate, regDate -> listings.get(me.id(), regDate));
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	@GetMapping
	public ApiResponse<ListingPageResponse> list(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @ModelAttribute ListingSearchCondition condition) {
		// mine=true 는 본인 글만이라 로그인이 필요하다. id 는 인증 정보에서만 (쿼리 파라미터로 받지 않음)
		if (condition.mineOnly() && me == null) {
			throw new ApiException(ErrorCode.UNAUTHENTICATED);
		}
		return ApiResponse.of(listings.search(condition, condition.mineOnly() ? me.id() : null));
	}

	/** 내 매물만 (본인 id 는 인증 정보에서) */
	@GetMapping("/mine")
	public ApiResponse<ListingMinePageResponse> mine(@AuthenticationPrincipal AuthenticatedUser me,
			@RequestParam(required = false) String cursor) {
		return ApiResponse.of(listings.mine(me.id(), cursor));
	}

	@GetMapping("/{userId}/{regDate}")
	public ApiResponse<ListingResponse> get(@PathVariable UUID userId, @PathVariable String regDate) {
		return ApiResponse.of(listings.get(userId, regDate));
	}

	@PatchMapping("/{userId}/{regDate}")
	public ApiResponse<ListingResponse> update(@AuthenticationPrincipal AuthenticatedUser me,
			@PathVariable UUID userId, @PathVariable String regDate, @Valid @RequestBody ListingUpdateRequest req) {
		return ApiResponse.of(listings.update(userId, regDate, me.id(), req));
	}

	@DeleteMapping("/{userId}/{regDate}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me,
			@PathVariable UUID userId, @PathVariable String regDate) {
		listings.delete(userId, regDate, me.id());
		return ResponseEntity.noContent().build();
	}

}
