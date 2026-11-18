package com.company.market.inquiry.domain;

import java.util.UUID;

import com.company.market.common.domain.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 문의 답글. 외래키가 없어(2026-10-27 방침) 글이 있는지는 서비스가 확인한다. 작성자를 저장하지 않는다 */
@Entity
@Table(name = "trd_inquiry_reply")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class InquiryReply extends BaseEntity {

	private UUID inquiryId;

	private String content;

	public static InquiryReply create(UUID inquiryId, String content) {
		InquiryReply reply = new InquiryReply();
		reply.inquiryId = inquiryId;
		reply.content = content;
		return reply;
	}

}
