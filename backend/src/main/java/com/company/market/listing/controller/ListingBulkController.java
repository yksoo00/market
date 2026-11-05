package com.company.market.listing.controller;

import java.nio.charset.StandardCharsets;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.listing.dto.BulkCheckResponse;
import com.company.market.listing.dto.BulkCommitResponse;
import com.company.market.listing.dto.BulkParseResponse;
import com.company.market.listing.dto.BulkRowsRequest;
import com.company.market.listing.service.ListingBulkService;
import com.company.market.listing.service.ListingBulkTemplate;
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

/** 엑셀 판매상품 다량 등록 (계획 2026-11-05-bulk-listing-excel.md). 등록 주체는 인증 정보뿐 — 본문의 userId 는 받지 않는다 */
@RestController
@RequestMapping("/api/v1/listings/bulk")
@RequiredArgsConstructor
public class ListingBulkController {

	private static final String XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

	private final ListingBulkService bulk;

	/**
	 * 빈 양식. SecurityConfig 가 GET /api/v1/listings/{a}/{b} 를 공개로 두는 규칙에 걸려 로그인 없이도 받을 수 있다 —
	 * 헤더뿐인 파일이라 노출되는 정보가 없어 그대로 둔다
	 */
	@GetMapping("/template")
	public ResponseEntity<byte[]> template() {
		return ResponseEntity.ok()
			.contentType(MediaType.parseMediaType(XLSX))
			.header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("판매상품_다량등록_양식.xlsx", StandardCharsets.UTF_8).build().toString())
			.body(ListingBulkTemplate.build());
	}

	@PostMapping("/parse")
	public ApiResponse<BulkParseResponse> parse(@AuthenticationPrincipal AuthenticatedUser me, @RequestParam("file") MultipartFile file) {
		return ApiResponse.of(bulk.parse(me.id(), file));
	}

	@PostMapping("/check")
	public ApiResponse<BulkCheckResponse> check(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody BulkRowsRequest req) {
		return ApiResponse.of(new BulkCheckResponse(bulk.check(me.id(), req.rows())));
	}

	@PostMapping("/commit")
	public ApiResponse<BulkCommitResponse> commit(@AuthenticationPrincipal AuthenticatedUser me, @Valid @RequestBody BulkRowsRequest req) {
		return ApiResponse.of(new BulkCommitResponse(bulk.commit(me.id(), req.rows())));
	}

}
