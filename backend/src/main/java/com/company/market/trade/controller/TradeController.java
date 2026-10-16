package com.company.market.trade.controller;

import java.time.Duration;
import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.idempotency.IdempotencyGuard;
import com.company.market.common.ratelimit.RateLimiter;
import com.company.market.trade.dto.TradeCreateRequest;
import com.company.market.trade.dto.TradePageResponse;
import com.company.market.trade.dto.TradeResponse;
import com.company.market.trade.service.TradeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/trades")
@RequiredArgsConstructor
public class TradeController {

	private final TradeService trades;

	private final RateLimiter limiter;

	private final IdempotencyGuard idempotency;

	/** 구매요청. 매물 등록과 같은 순서 — 멱등 검사가 한도 바깥이라 응답 유실 후 재전송은 한도를 깎지 않는다 */
	@PostMapping
	public ResponseEntity<ApiResponse<TradeResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody TradeCreateRequest req,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
		TradeResponse created = idempotency.run("trade-create", me.id(), idempotencyKey,
				() -> limiter.hitUnlessInvalid("trade:create:" + me.id(), 20, Duration.ofHours(1),
						() -> trades.request(me.id(), req)),
				TradeResponse::tradeId, tradeId -> trades.get(me.id(), tradeId));
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	/** 구매자 거래완료 → 구매확정. 상태가 바뀌는 쓰기지만 거래당 한 번만 성공하므로 별도 한도는 두지 않는다 */
	@PostMapping("/{tradeId}/complete")
	public ApiResponse<TradeResponse> complete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		return ApiResponse.of(trades.complete(me.id(), tradeId));
	}

	/** 확정 전 취소 (구매자·판매자) */
	@PostMapping("/{tradeId}/cancel")
	public ApiResponse<TradeResponse> cancel(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		return ApiResponse.of(trades.cancel(me.id(), tradeId));
	}

	/** 내 구매(role=buyer)·받은 구매요청(role=seller, reg 로 한 매물). 본인 id 는 인증 정보에서만. 읽기라 한도 없음 */
	@GetMapping
	public ApiResponse<TradePageResponse> list(@AuthenticationPrincipal AuthenticatedUser me,
			@RequestParam(required = false) String role, @RequestParam(required = false) String reg,
			@RequestParam(required = false) String cursor) {
		return ApiResponse.of(trades.list(me.id(), role, reg, cursor));
	}

	/** 내 매물별 구매요청 건수 { regDate: n } — 내 판매글 표. 매물 검색 응답에 넣지 않는 이유: 매물 → 거래 역참조(순환 의존) */
	@GetMapping("/pending-counts")
	public ApiResponse<Map<String, Long>> pendingCounts(@AuthenticationPrincipal AuthenticatedUser me) {
		return ApiResponse.of(trades.pendingCounts(me.id()));
	}

}
