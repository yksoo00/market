package com.company.market.inquiry.controller;

import java.util.UUID;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.inquiry.dto.InquiryCreateRequest;
import com.company.market.inquiry.dto.InquiryDetailResponse;
import com.company.market.inquiry.dto.InquiryPageResponse;
import com.company.market.inquiry.dto.InquiryReplyRequest;
import com.company.market.inquiry.dto.InquiryReplyResponse;
import com.company.market.inquiry.service.InquiryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 사내 테스트용 문의 게시판. 읽기(GET)는 로그인 없이, 쓰기·수정·삭제는 로그인. 현재 사용자는 인증 정보에서만 받는다.
 * TODO(사내 테스트용 게시판): rate limit 없음(길이 제한만) — 운영 공개 전 제거. 제거 방법은 decisions.md 2026-11-18
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

	/** 로그인 안 한 사람도 읽는다 — me 가 null 이면 수정·삭제 권한은 전부 false */
	@GetMapping("/{id}")
	public ApiResponse<InquiryDetailResponse> get(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id) {
		return ApiResponse.of(service.get(me == null ? null : me.id(), id));
	}

	@PostMapping
	public ResponseEntity<ApiResponse<InquiryDetailResponse>> create(@AuthenticationPrincipal AuthenticatedUser me,
			@Valid @RequestBody InquiryCreateRequest req) {
		return ResponseEntity.status(201).body(ApiResponse.of(service.create(me.id(), req)));
	}

	@PatchMapping("/{id}")
	public ApiResponse<InquiryDetailResponse> edit(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id,
			@Valid @RequestBody InquiryCreateRequest req) {
		return ApiResponse.of(service.edit(me.id(), id, req));
	}

	@DeleteMapping("/{id}")
	public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id) {
		service.delete(me.id(), id);
		return ResponseEntity.noContent().build();
	}

	@PostMapping("/{id}/replies")
	public ResponseEntity<ApiResponse<InquiryReplyResponse>> reply(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id,
			@Valid @RequestBody InquiryReplyRequest req) {
		return ResponseEntity.status(201).body(ApiResponse.of(service.reply(me.id(), id, req)));
	}

	@PatchMapping("/{id}/replies/{replyId}")
	public ApiResponse<InquiryReplyResponse> editReply(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id,
			@PathVariable UUID replyId, @Valid @RequestBody InquiryReplyRequest req) {
		return ApiResponse.of(service.editReply(me.id(), id, replyId, req));
	}

	@DeleteMapping("/{id}/replies/{replyId}")
	public ResponseEntity<Void> deleteReply(@AuthenticationPrincipal AuthenticatedUser me, @PathVariable UUID id, @PathVariable UUID replyId) {
		service.deleteReply(me.id(), id, replyId);
		return ResponseEntity.noContent().build();
	}

}
