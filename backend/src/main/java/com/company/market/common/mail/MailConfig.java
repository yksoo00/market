package com.company.market.common.mail;

import java.util.Properties;
import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
@EnableAsync
public class MailConfig {

	private static final int TIMEOUT_MS = 10_000;

	/**
	 * 알림 메일 전용 스레드. 작게(동시 2~4통)·대기열 100 — SMTP 가 막혀도 요청 스레드·DB 커넥션을 잡지 않고, 넘치면
	 * 호출 스레드가 직접 보내지 않고 버린다(DiscardPolicy: 알림은 사라져도 업무는 이미 끝났다)
	 */
	@Bean("mailExecutor")
	Executor mailExecutor(MailProperties props) {
		if (!props.isAsync()) {
			return new SyncTaskExecutor();
		}
		ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
		executor.setThreadNamePrefix("mail-");
		executor.setCorePoolSize(2);
		executor.setMaxPoolSize(4);
		executor.setQueueCapacity(100);
		executor.setRejectedExecutionHandler(new ThreadPoolExecutor.DiscardPolicy());
		return executor;
	}

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
