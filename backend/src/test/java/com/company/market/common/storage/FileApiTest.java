package com.company.market.common.storage;

import java.io.ByteArrayInputStream;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.user.domain.UserRole;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FileApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	FileStorage storage;

	@Autowired
	JwtProvider jwtProvider;

	@Test
	@DisplayName("공개 사진은 로그인 없이 200, image/jpeg, nosniff, 1년 캐시")
	void publicPhotoForAnyone() throws Exception {
		String key = saved("public/listings/photos", "jpg", UploadApiTest.JPG);

		mvc.perform(get("/api/v1/files/" + key))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", "image/jpeg"))
			.andExpect(header().string("X-Content-Type-Options", "nosniff"))
			.andExpect(header().string("Cache-Control", allOf(containsString("max-age=31536000"), containsString("public"),
					containsString("immutable"))))
			.andExpect(content().bytes(UploadApiTest.JPG));
	}

	@Test
	@DisplayName("비공개 데이터시트는 로그인 없이 401")
	void privateRequiresLogin() throws Exception {
		String key = saved("private/listings/datasheets", "pdf", UploadApiTest.PDF);

		mvc.perform(get("/api/v1/files/" + key)).andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("비공개 데이터시트는 로그인하면 200, application/pdf, inline, 캐시 private")
	void privateForLoggedIn() throws Exception {
		String key = saved("private/listings/datasheets", "pdf", UploadApiTest.PDF);
		Cookie cookie = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(UUID.randomUUID(), UserRole.USER));

		mvc.perform(get("/api/v1/files/" + key).cookie(cookie))
			.andExpect(status().isOk())
			.andExpect(header().string("Content-Type", "application/pdf"))
			.andExpect(header().string("Content-Disposition", startsWith("inline")))
			.andExpect(header().string("Cache-Control", allOf(containsString("private"), containsString("no-cache"))))
			.andExpect(content().bytes(UploadApiTest.PDF));
	}

	@Test
	@DisplayName("없는 키·형식이 어긋난 키는 404")
	void missingOrMalformed() throws Exception {
		mvc.perform(get("/api/v1/files/public/listings/photos/2026/10/" + UUID.randomUUID() + ".jpg"))
			.andExpect(status().isNotFound());
		mvc.perform(get("/api/v1/files/public/listings/photos/2026/10/x.jpg")).andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("인코딩한 경로 탈출(%2e%2e)은 방화벽이 400으로 끊는다")
	void encodedTraversalRejected() throws Exception {
		mvc.perform(get("/api/v1/files/public/listings/photos/%2e%2e/%2e%2e/%2e%2e/etc/passwd"))
			.andExpect(status().isBadRequest());
	}

	String saved(String folder, String ext, byte[] content) throws Exception {
		String key = folder + "/2026/10/" + UUID.randomUUID() + "." + ext;
		storage.save(key, new ByteArrayInputStream(content));
		return key;
	}

}
