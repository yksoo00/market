package com.company.market.common.storage;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.domain.UserRole;
import com.company.market.user.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class UploadApiTest {

	static final byte[] JPG = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0x10, 'J', 'F', 'I', 'F', 0, 1 };

	static final byte[] PNG = { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0x0D };

	static final byte[] PDF = "%PDF-1.7\n%test".getBytes(StandardCharsets.US_ASCII);

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@Autowired
	UserRepository users;

	@Autowired
	PiiHasher hasher;

	@Autowired
	JwtProvider jwtProvider;

	@Autowired
	StringRedisTemplate redis;

	@Autowired
	StorageProperties storageProperties;

	Cookie authCookie;

	UUID userId;

	@BeforeEach
	void setUp() {
		jdbc.update("delete from listings");
		jdbc.update("delete from products");
		jdbc.update("delete from users where role <> 'admin'");
		User user = users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId("uploadapitester")
			.passwordHash("$2a$12$hash").nickname("uploadapitester").email("uploadapitester@example.com")
			.name("홍길동").phone("01012345679").phoneHash(hasher.hash("01012345679")).build());
		userId = user.getId();
		authCookie = new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(userId, UserRole.USER));
	}

	@Test
	@DisplayName("사진을 올리면 201과 키를 돌려주고 디스크와 Redis에 기록된다")
	void uploadsPhoto() throws Exception {
		String body = upload("listing-photo", "a.jpg", JPG).andExpect(status().isCreated())
			.andExpect(jsonPath("$.ok").value(true))
			.andReturn().getResponse().getContentAsString();
		String key = body.replaceAll(".*\"key\":\"([^\"]+)\".*", "$1");

		assertThat(key).startsWith("public/listings/photos/").endsWith(".jpg");
		assertThat(Files.readAllBytes(Path.of(storageProperties.root()).resolve(key))).isEqualTo(JPG);
		assertThat(redis.opsForValue().get("upload:" + key)).isEqualTo(userId + "|listing-photo");
		assertThat(redis.getExpire("upload:" + key)).isBetween(1L, 86_400L);
	}

	@Test
	@DisplayName("로그인 없이 올리면 401")
	void requiresAuth() throws Exception {
		mvc.perform(multipart("/api/v1/uploads").file(new MockMultipartFile("file", "a.jpg", "image/jpeg", JPG))
				.param("kind", "listing-photo"))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("모르는 용도면 400 VALIDATION, fields.kind")
	void unknownKind() throws Exception {
		upload("photo", "a.jpg", JPG).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.fields.kind").isString());
	}

	@Test
	@DisplayName("확장자는 jpg인데 내용이 PDF면 400 UPLOAD_INVALID_TYPE")
	void disguisedExtension() throws Exception {
		upload("listing-photo", "a.jpg", PDF).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("UPLOAD_INVALID_TYPE"));
	}

	@Test
	@DisplayName("데이터시트 칸에 이미지를 올리면 400 UPLOAD_INVALID_TYPE")
	void imageAsDatasheet() throws Exception {
		upload("listing-datasheet", "a.png", PNG).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("UPLOAD_INVALID_TYPE"));
	}

	@Test
	@DisplayName("빈 파일은 400 UPLOAD_INVALID_TYPE")
	void emptyFile() throws Exception {
		upload("listing-datasheet", "a.pdf", new byte[0]).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("UPLOAD_INVALID_TYPE"));
	}

	@Test
	@DisplayName("사진이 5MB를 넘으면 413 UPLOAD_TOO_LARGE")
	void photoTooLarge() throws Exception {
		byte[] big = Arrays.copyOf(JPG, 5 * 1024 * 1024 + 1);
		upload("listing-photo", "big.jpg", big).andExpect(status().is(413))
			.andExpect(jsonPath("$.code").value("UPLOAD_TOO_LARGE"));
	}

	@Test
	@DisplayName("10분에 21번째 업로드는 429")
	void rateLimited() throws Exception {
		for (int i = 0; i < 20; i++) {
			upload("listing-datasheet", "a.pdf", PDF).andExpect(status().isCreated());
		}
		upload("listing-datasheet", "a.pdf", PDF).andExpect(status().isTooManyRequests());
	}

	ResultActions upload(String kind, String filename, byte[] content) throws Exception {
		return mvc.perform(multipart("/api/v1/uploads").file(new MockMultipartFile("file", filename, "application/octet-stream", content))
			.param("kind", kind)
			.cookie(authCookie));
	}

}
