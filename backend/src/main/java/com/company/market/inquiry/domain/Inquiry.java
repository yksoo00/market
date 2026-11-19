package com.company.market.inquiry.domain;

import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 문의 글 (사내 테스트용 익명 게시판, 스펙 2026-11-18-inquiry-board-design.md). 작성자를 저장하지 않는다.
 * TODO(사내 테스트용 익명 쓰기): 운영 공개 전 제거 (decisions.md 2026-11-18)
 */
@Entity
@Table(name = "trd_inquiry")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Inquiry extends BaseEntity {

	private String title;

	private String content;

	public static Inquiry create(String title, String content) {
		Inquiry inquiry = new Inquiry();
		inquiry.title = title;
		inquiry.content = content;
		return inquiry;
	}

}
