package com.company.market.listing.controller;

import java.time.Duration;
import java.util.UUID;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.idempotency.IdempotencyGuard;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.listing.dto.ListingCreateRequest;
import com.company.market.listing.dto.ListingMinePageResponse;
import com.company.market.listing.dto.ListingPageResponse;
import com.company.market.listing.dto.ListingResponse;
import com.company.market.listing.dto.ListingSearchCondition;
import com.company.market.listing.dto.ListingUpdateRequest;
import com.company.market.listing.service.ListingService;
import jakarta.servlet.http.HttpServletRequest;
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

	private final RateLimiter limiter;

	private final IdempotencyGuard idempotency;

	@PostMapping
	public ResponseEntity<ApiResponse<ListingResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody ListingCreateRequest req,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
		// 멱등 검사가 한도보다 바깥 — 응답이 유실된 등록의 재요청(결과 재전송·처리 중 409)은 새로 만들지 않으므로 세지 않는다.
		// 안쪽이면 한도의 마지막 등록을 다시 받으려다 429 를 받아 등록이 실패한 줄 안다
		ListingResponse created = idempotency.run("listing-create", me.id(), idempotencyKey,
				() -> limiter.hitUnlessInvalid("listing:create:" + me.id(), 10, Duration.ofHours(1),
						() -> listings.create(me.id(), req)),
				ListingResponse::regDate, regDate -> listings.get(me.id(), regDate));
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	@GetMapping
	public ApiResponse<ListingPageResponse> list(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @ModelAttribute ListingSearchCondition condition, HttpServletRequest req) {
		// mine=true 는 본인 글만이라 로그인이 필요하다. id 는 인증 정보에서만 (쿼리 파라미터로 받지 않음)
		if (condition.mineOnly() && me == null) {
			throw new ApiException(ErrorCode.UNAUTHENTICATED);
		}
		// 비로그인 검색만 IP 기준 제한 (security.md "검색 API (비로그인)")
		if (me == null) {
			limiter.hit("listing:search:ip:" + req.getRemoteAddr(), 60, Duration.ofMinutes(1));
		}
		return ApiResponse.of(listings.search(condition, condition.mineOnly() ? me.id() : null));
	}

	/** 내 매물만 (본인 id 는 인증 정보에서). 읽기라 rate limit 은 두지 않는다 */
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
		return ApiResponse.of(limiter.hitUnlessInvalid("listing:update:" + me.id(), 20, Duration.ofHours(1),
				() -> listings.update(userId, regDate, me.id(), req)));
	}

	@DeleteMapping("/{userId}/{regDate}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me,
			@PathVariable UUID userId, @PathVariable String regDate) {
		limiter.hit("listing:delete:" + me.id(), 10, Duration.ofHours(1));
		listings.delete(userId, regDate, me.id());
		return ResponseEntity.noContent().build();
	}

}
