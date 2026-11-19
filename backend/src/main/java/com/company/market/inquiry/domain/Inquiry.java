package com.company.market.inquiry.domain;

import java.util.UUID;

import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 문의 글 (사내 테스트용 게시판, 스펙 2026-11-18-inquiry-board-design.md). 작성자 uid 는 수정·삭제 권한 검사에만 쓰고 응답에 내지 않는다.
 * authorUid 가 없는 글은 작성자 기록 전(익명 시절)에 쓴 글이다 — 아무도 수정할 수 없고 관리자만 지운다.
 * TODO(사내 테스트용 게시판): 운영 공개 전 제거 (decisions.md 2026-11-18)
 */
@Entity
@Table(name = "trd_inquiry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Inquiry extends BaseEntity {

	private String title;

	private String content;

	private UUID authorUid;

	public static Inquiry create(UUID authorUid, String title, String content) {
		Inquiry inquiry = new Inquiry();
		inquiry.authorUid = authorUid;
		inquiry.title = title;
		inquiry.content = content;
		return inquiry;
	}

	public void edit(String title, String content) {
		this.title = title;
		this.content = content;
	}

	public boolean isAuthor(UUID uid) {
		return authorUid != null && authorUid.equals(uid);
	}

}
