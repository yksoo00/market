package com.company.market.trade.controller;

import java.util.List;
import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.trade.dto.CartAddRequest;
import com.company.market.trade.dto.CartCountResponse;
import com.company.market.trade.dto.CartItemResponse;
import com.company.market.trade.dto.CartRemoveRequest;
import com.company.market.trade.service.CartService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 장바구니. 구매자 id 는 인증 정보에서만. 이미 담긴 매물을 다시 담아도 행이 늘지 않아 멱등 키는 쓰지 않는다.
 * TODO(rate limit 보류, decisions.md 2026-10-19): 요청 한도 없음 — 운영 전 재도입 때 담기도 포함
 */
@RestController
@RequestMapping("/api/v1/cart")
@RequiredArgsConstructor
public class CartController {

	private final CartService cart;

	@PostMapping
	public ApiResponse<CartCountResponse> add(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody CartAddRequest req) {
		return ApiResponse.of(cart.add(me.id(), req));
	}

	@GetMapping
	public ApiResponse<Map<String, List<CartItemResponse>>> list(@AuthenticationPrincipal AuthenticatedUser me) {
		return ApiResponse.of(Map.of("items", cart.list(me.id())));
	}

	@GetMapping("/count")
	public ApiResponse<CartCountResponse> count(@AuthenticationPrincipal AuthenticatedUser me) {
		return ApiResponse.of(cart.count(me.id()));
	}

	/** DELETE + 본문 대신 POST — 프록시가 DELETE 본문을 버릴 수 있다 */
	@PostMapping("/remove")
	public ResponseEntity<Void> remove(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody CartRemoveRequest req) {
		cart.remove(me.id(), req.tradeIds());
		return ResponseEntity.noContent().build();
	}

}
