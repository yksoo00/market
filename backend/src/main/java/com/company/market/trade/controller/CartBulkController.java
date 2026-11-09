package com.company.market.trade.controller;

import java.nio.charset.StandardCharsets;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.trade.dto.CartBulkCheckResult;
import com.company.market.trade.dto.CartBulkCommitResult;
import com.company.market.trade.dto.CartBulkParseResponse;
import com.company.market.trade.dto.CartBulkRowsRequest;
import com.company.market.trade.dto.CartBulkSort;
import com.company.market.trade.service.CartBulkService;
import com.company.market.trade.service.CartBulkTemplate;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 엑셀 대량구매 (계획 2026-11-09-bulk-purchase-excel.md). 담는 사람은 인증 정보뿐 — 본문의 사용자 id 는 받지 않는다.
 * TODO(rate limit 보류, decisions.md 2026-10-19): 요청 한도 없음 — 운영 전 재도입 때 담기와 함께 넣는다
 */
@RestController
@RequestMapping("/api/v1/cart/bulk")
@RequiredArgsConstructor
public class CartBulkController {

	private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

	private final CartBulkService bulk;

	@GetMapping("/template")
	public ResponseEntity<byte[]> template() {
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(XLSX))
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("대량구매_양식.xlsx", StandardCharsets.UTF_8).build().toString())
			.body(CartBulkTemplate.build());
	}

	@PostMapping("/parse")
	public ApiResponse<CartBulkParseResponse> parse(@AuthenticationPrincipal AuthenticatedUser me, @RequestParam("file") MultipartFile file,
			@RequestParam(value = "sort", required = false) String sort) {
		return ApiResponse.of(bulk.parse(me.id(), file, CartBulkSort.parse(sort)));
	}

	@PostMapping("/check")
	public ApiResponse<CartBulkCheckResult> check(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody CartBulkRowsRequest req) {
		return ApiResponse.of(bulk.check(me.id(), req.rows(), CartBulkSort.parse(req.sort())));
	}

	@PostMapping("/commit")
	public ApiResponse<CartBulkCommitResult> commit(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody CartBulkRowsRequest req) {
		return ApiResponse.of(bulk.commit(me.id(), req.rows(), CartBulkSort.parse(req.sort())));
	}

}
