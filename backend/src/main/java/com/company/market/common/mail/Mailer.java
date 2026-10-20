package com.company.market.common.mail;

/** 메일 한 통. 실패는 예외로 던진다 — 호출자가 잡아 로그를 남기고 업무는 그대로 둔다 */
public interface Mailer {

	void send(String to, String subject, String body);

}
