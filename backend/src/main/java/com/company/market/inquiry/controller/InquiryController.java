package com.company.market.inquiry.controller;

import java.util.UUID;

import com.company.market.common.api.ApiResponse;
import com.company.market.inquiry.dto.InquiryCreateRequest;
import com.company.market.inquiry.dto.InquiryDetailResponse;
import com.company.market.inquiry.dto.InquiryPageResponse;
import com.company.market.inquiry.dto.InquiryReplyRequest;
import com.company.market.inquiry.dto.InquiryReplyResponse;
import com.company.market.inquiry.service.InquiryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사내 테스트용 익명 문의 게시판. 로그인 없이 읽고 쓴다 — 작성자 식별자를 받지 않는다.
 * TODO(사내 테스트용 익명 쓰기): 인증·rate limit 없음(길이 제한만) — 운영 공개 전 제거. 제거 방법은 decisions.md 2026-11-18
 */
@RestController
@RequestMapping("/api/v1/inquiries")
@RequiredArgsConstructor
public class InquiryController {

	private final InquiryService service;

	@GetMapping
	public ApiResponse<InquiryPageResponse> list(@RequestParam(required = false) String cursor) {
		return ApiResponse.of(service.list(cursor));
	}

	@GetMapping("/{id}")
	public ApiResponse<InquiryDetailResponse> get(@PathVariable UUID id) {
		return ApiResponse.of(service.get(id));
	}

	@PostMapping
	public ResponseEntity<ApiResponse<InquiryDetailResponse>> create(@Valid @RequestBody InquiryCreateRequest req) {
		return ResponseEntity.status(201).body(ApiResponse.of(service.create(req)));
	}

	@PostMapping("/{id}/replies")
	public ResponseEntity<ApiResponse<InquiryReplyResponse>> reply(@PathVariable UUID id, @Valid @RequestBody InquiryReplyRequest req) {
		return ResponseEntity.status(201).body(ApiResponse.of(service.reply(id, req)));
	}

}
