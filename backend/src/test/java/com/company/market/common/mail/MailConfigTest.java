package com.company.market.common.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

class MailConfigTest {

	@Configuration
	@EnableConfigurationProperties(MailProperties.class)
	@Import(MailConfig.class)
	static class Wiring {

	}

	private final ApplicationContextRunner runner = new ApplicationContextRunner().withUserConfiguration(Wiring.class);

	@Test
	@DisplayName("SMTP 호스트가 비어 있으면 로그만 남기는 발송기")
	void loggingWhenHostBlank() {
		runner.withPropertyValues("app.mail.host=").run(ctx -> assertThat(ctx.getBean(Mailer.class)).isInstanceOf(LoggingMailer.class));
		runner.run(ctx -> assertThat(ctx.getBean(Mailer.class)).isInstanceOf(LoggingMailer.class));
	}

	@Test
	@DisplayName("SMTP 호스트가 있으면 SMTP 발송기 (하이웍스)")
	void smtpWhenHostSet() {
		runner.withPropertyValues("app.mail.host=smtp.example.com", "app.mail.port=465", "app.mail.username=u@example.com",
				"app.mail.password=p", "app.mail.from=u@example.com")
			.run(ctx -> assertThat(ctx.getBean(Mailer.class)).isInstanceOf(SmtpMailer.class));
	}

}
