package com.company.market.inquiry.service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.inquiry.domain.Inquiry;
import com.company.market.inquiry.domain.InquiryReply;
import com.company.market.inquiry.dto.InquiryCreateRequest;
import com.company.market.inquiry.dto.InquiryDetailResponse;
import com.company.market.inquiry.dto.InquiryListItem;
import com.company.market.inquiry.dto.InquiryPageResponse;
import com.company.market.inquiry.dto.InquiryReplyRequest;
import com.company.market.inquiry.dto.InquiryReplyResponse;
import com.company.market.inquiry.repository.InquiryReplyRepository;
import com.company.market.inquiry.repository.InquiryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사내 테스트용 익명 문의 게시판 (스펙 2026-11-18-inquiry-board-design.md). 작성자를 받지도 저장하지도 않는다.
 * 글 내용은 로그에 남기지 않는다.
 * TODO(사내 테스트용 익명 쓰기): 인증·rate limit 없음 — 운영 공개 전 제거 (decisions.md 2026-11-18)
 */
@Service
@RequiredArgsConstructor
public class InquiryService {

	static final int PAGE_SIZE = 20;

	private final InquiryRepository inquiries;

	private final InquiryReplyRepository replies;

	/** 최신순 한 페이지. 커서 = `createdAt_id` (같은 시각 글이 페이지 경계에서 빠지지 않게 id 를 같이 쓴다) */
	@Transactional(readOnly = true)
	public InquiryPageResponse list(String cursor) {
		PageRequest page = PageRequest.of(0, PAGE_SIZE + 1);
		List<Inquiry> rows;
		if (cursor == null || cursor.isBlank()) {
			rows = inquiries.findFirstPage(page);
		}
		else {
			Cursor c = parseCursor(cursor);
			rows = inquiries.findPageAfter(c.at(), c.id(), page);
		}
		boolean hasMore = rows.size() > PAGE_SIZE;
		List<Inquiry> pageRows = hasMore ? rows.subList(0, PAGE_SIZE) : rows;
		Map<UUID, Long> counts = new HashMap<>();
		if (!pageRows.isEmpty()) {
			for (Object[] row : replies.countByInquiryIds(pageRows.stream().map(Inquiry::getId).toList())) {
				counts.put((UUID) row[0], (Long) row[1]);
			}
		}
		List<InquiryListItem> items = pageRows.stream()
			.map(i -> new InquiryListItem(i.getId(), i.getTitle(), i.getCreatedAt(), counts.getOrDefault(i.getId(), 0L)))
			.toList();
		String next = hasMore ? pageRows.get(pageRows.size() - 1).getCreatedAt() + "_" + pageRows.get(pageRows.size() - 1).getId() : null;
		return new InquiryPageResponse(items, next);
	}

	@Transactional(readOnly = true)
	public InquiryDetailResponse get(UUID id) {
		Inquiry inquiry = find(id);
		return InquiryDetailResponse.of(inquiry, replies.findByInquiryIdOrderByCreatedAtAscIdAsc(id).stream().map(InquiryReplyResponse::of).toList());
	}

	@Transactional
	public InquiryDetailResponse create(InquiryCreateRequest req) {
		Inquiry saved = inquiries.save(Inquiry.create(req.title().strip(), req.content().strip()));
		return InquiryDetailResponse.of(saved, List.of());
	}

	@Transactional
	public InquiryReplyResponse reply(UUID inquiryId, InquiryReplyRequest req) {
		// 존재만 확인하면 되니 내용(2000자)까지 읽는 findById 대신 existsById
		if (!inquiries.existsById(inquiryId)) {
			throw new ApiException(ErrorCode.NOT_FOUND, "문의를 찾을 수 없습니다.");
		}
		return InquiryReplyResponse.of(replies.save(InquiryReply.create(inquiryId, req.content().strip())));
	}

	private Inquiry find(UUID id) {
		return inquiries.findById(id).orElseThrow(() -> new ApiException(ErrorCode.NOT_FOUND, "문의를 찾을 수 없습니다."));
	}

	private record Cursor(Instant at, UUID id) {
	}

	private static Cursor parseCursor(String cursor) {
		int sep = cursor.indexOf('_');
		try {
			if (sep <= 0) {
				throw new IllegalArgumentException(cursor);
			}
			return new Cursor(Instant.parse(cursor.substring(0, sep)), UUID.fromString(cursor.substring(sep + 1)));
		}
		catch (RuntimeException e) {
			throw new ApiException(ErrorCode.BAD_REQUEST, "커서 형식이 올바르지 않습니다.");
		}
	}

}
