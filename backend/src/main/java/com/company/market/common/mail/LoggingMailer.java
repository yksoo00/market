package com.company.market.common.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** SMTP 설정이 없을 때(로컬·테스트). 받는 주소는 개인정보라 로그에 쓰지 않는다 */
public class LoggingMailer implements Mailer {

	private static final Logger log = LoggerFactory.getLogger(LoggingMailer.class);

	@Override
	public void send(String to, String subject, String body) {
		log.info("메일 발송 생략(SMTP 설정 없음): {}", subject);
	}

}
