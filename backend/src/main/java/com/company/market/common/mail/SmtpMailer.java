package com.company.market.common.mail;

import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/** SMTP(하이웍스)로 보낸다. 본문은 text/plain UTF-8 */
public class SmtpMailer implements Mailer {

	private final JavaMailSender sender;

	private final String from;

	public SmtpMailer(JavaMailSender sender, String from) {
		this.sender = sender;
		this.from = from;
	}

	@Override
	public void send(String to, String subject, String body) {
		SimpleMailMessage message = new SimpleMailMessage();
		message.setFrom(from);
		message.setTo(to);
		message.setSubject(subject);
		message.setText(body);
		sender.send(message);
	}

}
