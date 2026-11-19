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
import com.company.market.user.service.UserDirectory;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 사내 테스트용 문의 게시판. 읽기는 로그인 없이, 쓰기는 로그인. 수정은 본인만, 삭제는 본인 + 관리자.
 * 작성자 uid 는 권한 검사에만 쓰고 응답에 내지 않는다. 글 내용은 로그에 남기지 않는다.
 * TODO(사내 테스트용 게시판): 운영 공개 전 제거 (decisions.md 2026-11-18). ADMIN_LOGIN_ID 도 같이
 */
@Service
@RequiredArgsConstructor
public class InquiryService {

	static final int PAGE_SIZE = 20;

	/** 임시 관리자 — 이 로그인 아이디의 사용자만 남의 글·답글을 지울 수 있다 (사용자 지시 2026-11-19, 역할 체계가 생기면 대체) */
	static final String ADMIN_LOGIN_ID = "yksoo00";

	private final InquiryRepository inquiries;

	private final InquiryReplyRepository replies;

	private final UserDirectory userDirectory;

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

	/** viewer: 보는 사람(로그인 안 했으면 null). 수정·삭제 버튼을 보일지(canEdit·canDelete)를 보는 사람 기준으로 채운다 */
	@Transactional(readOnly = true)
	public InquiryDetailResponse get(UUID viewer, UUID id) {
		Inquiry inquiry = find(id);
		boolean admin = isAdmin(viewer);
		List<InquiryReplyResponse> replyViews = replies.findByInquiryIdOrderByCreatedAtAscIdAsc(id).stream()
			.map(r -> replyView(r, viewer, admin)).toList();
		boolean mine = inquiry.isAuthor(viewer);
		return InquiryDetailResponse.of(inquiry, mine, mine || admin, replyViews);
	}

	@Transactional
	public InquiryDetailResponse create(UUID me, InquiryCreateRequest req) {
		Inquiry saved = inquiries.save(Inquiry.create(me, req.title().strip(), req.content().strip()));
		return InquiryDetailResponse.of(saved, true, true, List.of());
	}

	/** 본인 글만 고친다. 관리자도 못 고친다(삭제만) */
	@Transactional
	public InquiryDetailResponse edit(UUID me, UUID id, InquiryCreateRequest req) {
		Inquiry inquiry = find(id);
		requireAuthor(inquiry.isAuthor(me));
		inquiry.edit(req.title().strip(), req.content().strip());
		boolean admin = isAdmin(me);
		List<InquiryReplyResponse> replyViews = replies.findByInquiryIdOrderByCreatedAtAscIdAsc(id).stream()
			.map(r -> replyView(r, me, admin)).toList();
		return InquiryDetailResponse.of(inquiry, true, true, replyViews);
	}

	/** 본인 글 또는 관리자. 외래키가 없어 답글도 같이 지운다 */
	@Transactional
	public void delete(UUID me, UUID id) {
		Inquiry inquiry = find(id);
		requireAuthor(inquiry.isAuthor(me) || isAdmin(me));
		replies.deleteByInquiryId(id);
		inquiries.delete(inquiry);
	}

	@Transactional
	public InquiryReplyResponse reply(UUID me, UUID inquiryId, InquiryReplyRequest req) {
		// 존재만 확인하면 되니 내용(2000자)까지 읽는 findById 대신 existsById
		if (!inquiries.existsById(inquiryId)) {
			throw notFound();
		}
		return InquiryReplyResponse.of(replies.save(InquiryReply.create(me, inquiryId, req.content().strip())), true, true);
	}

	@Transactional
	public InquiryReplyResponse editReply(UUID me, UUID inquiryId, UUID replyId, InquiryReplyRequest req) {
		InquiryReply reply = findReply(inquiryId, replyId);
		requireAuthor(reply.isAuthor(me));
		reply.edit(req.content().strip());
		return InquiryReplyResponse.of(reply, true, true);
	}

	@Transactional
	public void deleteReply(UUID me, UUID inquiryId, UUID replyId) {
		InquiryReply reply = findReply(inquiryId, replyId);
		requireAuthor(reply.isAuthor(me) || isAdmin(me));
		replies.delete(reply);
	}

	private InquiryReplyResponse replyView(InquiryReply reply, UUID viewer, boolean admin) {
		boolean mine = reply.isAuthor(viewer);
		return InquiryReplyResponse.of(reply, mine, mine || admin);
	}

	private boolean isAdmin(UUID viewer) {
		return viewer != null && userDirectory.hasLoginId(viewer, ADMIN_LOGIN_ID);
	}

	private static void requireAuthor(boolean allowed) {
		if (!allowed) {
			throw new ApiException(ErrorCode.FORBIDDEN);
		}
	}

	private Inquiry find(UUID id) {
		return inquiries.findById(id).orElseThrow(InquiryService::notFound);
	}

	private InquiryReply findReply(UUID inquiryId, UUID replyId) {
		return replies.findByIdAndInquiryId(replyId, inquiryId).orElseThrow(InquiryService::notFound);
	}

	private static ApiException notFound() {
		return new ApiException(ErrorCode.NOT_FOUND, "문의를 찾을 수 없습니다.");
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
