package com.company.market.common.mail;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class SmtpMailerTest {

	@Test
	@DisplayName("제목의 줄바꿈은 지운다 — 상품명으로 Bcc 같은 헤더를 끼워 넣지 못하게")
	void subjectLineBreaksAreStripped() {
		JavaMailSender sender = mock(JavaMailSender.class);
		new SmtpMailer(sender, "noreply@example.com").send("buyer@example.com",
				"[커널마켓] 견적 요청이 왔어요 — x\r\nBcc: victim@example.com\nContent-Type: text/html", "본문");

		ArgumentCaptor<SimpleMailMessage> sent = ArgumentCaptor.forClass(SimpleMailMessage.class);
		verify(sender).send(sent.capture());
		assertThat(sent.getValue().getSubject()).doesNotContain("\r").doesNotContain("\n");
		assertThat(sent.getValue().getSubject()).contains("견적 요청이 왔어요");
		assertThat(sent.getValue().getText()).isEqualTo("본문");
	}

}
