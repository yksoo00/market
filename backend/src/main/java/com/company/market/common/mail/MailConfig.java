package com.company.market.common.mail;

import java.util.Properties;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSenderImpl;

@Configuration
public class MailConfig {

	private static final int TIMEOUT_MS = 10_000;

	@Bean
	Mailer mailer(MailProperties props) {
		if (!props.enabled()) {
			return new LoggingMailer();
		}
		JavaMailSenderImpl sender = new JavaMailSenderImpl();
		int port = props.port() == null ? 465 : props.port();
		sender.setHost(props.host());
		sender.setPort(port);
		sender.setUsername(props.username());
		sender.setPassword(props.password());
		sender.setDefaultEncoding("UTF-8");
		Properties p = sender.getJavaMailProperties();
		p.put("mail.smtp.auth", "true");
		// 465 는 처음부터 SSL(하이웍스 기본), 587 은 STARTTLS
		if (port == 465) {
			p.put("mail.smtp.ssl.enable", "true");
		}
		else {
			p.put("mail.smtp.starttls.enable", "true");
			p.put("mail.smtp.starttls.required", "true");
		}
		// 메일 서버가 느려도 요청 스레드가 오래 묶이지 않게
		p.put("mail.smtp.connectiontimeout", TIMEOUT_MS);
		p.put("mail.smtp.timeout", TIMEOUT_MS);
		p.put("mail.smtp.writetimeout", TIMEOUT_MS);
		return new SmtpMailer(sender, props.from() == null || props.from().isBlank() ? props.username() : props.from());
	}

}
