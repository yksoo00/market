package com.company.market.trade.controller;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.common.idempotency.IdempotencyGuard;
import com.company.market.trade.dto.QuoteCreateRequest;
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

	private final IdempotencyGuard idempotency;

	/** 구매요청. 응답 유실 후 재전송은 멱등 키로 처음 거래를 돌려준다. TODO(rate limit 보류, decisions.md 2026-10-19): 요청 한도를 지웠다 */
	@PostMapping
	public ResponseEntity<ApiResponse<TradeResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody TradeCreateRequest req,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
		TradeResponse created = idempotency.run("trade-create", me.id(), idempotencyKey,
				() -> trades.request(me.id(), req),
				TradeResponse::tradeId, tradeId -> trades.get(me.id(), tradeId));
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	/** 견적 요청 N건. 재전송은 멱등 키로 처음 결과(거래ID 목록)를 돌려준다 */
	@PostMapping("/quotes")
	public ResponseEntity<ApiResponse<List<TradeResponse>>> quotes(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody QuoteCreateRequest req,
			@RequestHeader(name = "Idempotency-Key", required = false) String idempotencyKey) {
		List<TradeResponse> created = idempotency.run("quote-create", me.id(), idempotencyKey,
				() -> trades.requestQuotes(me.id(), req),
				list -> list.stream().map(TradeResponse::tradeId).collect(Collectors.joining(",")),
				ids -> Arrays.stream(ids.split(",")).map(id -> trades.get(me.id(), id)).toList());
		return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.of(created));
	}

	/** 구매자 거래완료 → 구매확정 */
	@PostMapping("/{tradeId}/complete")
	public ApiResponse<TradeResponse> complete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		return ApiResponse.of(trades.complete(me.id(), tradeId));
	}

	/** 판매자 견적 수락 → 매물 단가를 희망단가로, 견적회신 */
	@PostMapping("/{tradeId}/accept")
	public ApiResponse<TradeResponse> accept(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		return ApiResponse.of(trades.accept(me.id(), tradeId));
	}

	/** 판매자 견적 거절 → 견적회신 */
	@PostMapping("/{tradeId}/reject")
	public ApiResponse<TradeResponse> reject(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		return ApiResponse.of(trades.reject(me.id(), tradeId));
	}

	/** 확정 전 취소 (구매자·판매자). 행이 지워지므로 돌려줄 거래가 없다 → 204 */
	@PostMapping("/{tradeId}/cancel")
	public ResponseEntity<Void> cancel(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable String tradeId) {
		trades.cancel(me.id(), tradeId);
		return ResponseEntity.noContent().build();
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
