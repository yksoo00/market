package com.company.market.inquiry.controller;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.JwtProvider;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
import com.company.market.user.repository.UserRepository;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 문의 게시판 API (스펙 2026-11-18-inquiry-board-design.md + 2026-11-19 작성자 수정·삭제).
 * 읽기는 로그인 없이, 쓰기는 로그인. 수정은 본인만, 삭제는 본인 + 관리자(로그인 아이디 yksoo00).
 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InquiryApiTest {

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

	Cookie alice;

	Cookie bob;

	Cookie admin;

	@BeforeEach
	void setUp() {
		jdbc.update("delete from trd_inquiry_reply");
		jdbc.update("delete from trd_inquiry");
		jdbc.update("delete from trd_user_info");
		alice = cookieOf(newUser("inqalice", "01044440001"));
		bob = cookieOf(newUser("inqbob", "01044440002"));
		admin = cookieOf(newUser("yksoo00", "01044440003"));
	}

	private UUID newUser(String loginId, String phone) {
		return users.saveAndFlush(User.builder().kind(UserKind.PERSONAL).loginId(loginId).passwordHash("$2a$12$hash")
			.nickname(loginId).nicknameUsage("Y").email(loginId + "@example.com").name("홍길동").phone(phone)
			.phoneHash(hasher.hash(phone)).build()).getId();
	}

	private Cookie cookieOf(UUID id) {
		return new Cookie(AuthCookies.ACCESS, jwtProvider.createAccessToken(id));
	}

	private static String json(String title, String content) {
		return "{\"title\":" + quote(title) + ",\"content\":" + quote(content) + "}";
	}

	private static String quote(String s) {
		return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
	}

	private ResultActions postInquiry(Cookie who, String body) throws Exception {
		return mvc.perform(post("/api/v1/inquiries").cookie(who).contentType(MediaType.APPLICATION_JSON).content(body));
	}

	private String createInquiry(Cookie who, String title, String content) throws Exception {
		MvcResult r = postInquiry(who, json(title, content)).andExpect(status().isCreated()).andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.data.id");
	}

	private String reply(Cookie who, String inquiryId, String content) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/inquiries/" + inquiryId + "/replies").cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"content\":" + quote(content) + "}")).andExpect(status().isCreated()).andReturn();
		return JsonPath.read(r.getResponse().getContentAsString(), "$.data.id");
	}

	private ResultActions edit(Cookie who, String id, String title, String content) throws Exception {
		return mvc.perform(patch("/api/v1/inquiries/" + id).cookie(who).contentType(MediaType.APPLICATION_JSON).content(json(title, content)));
	}

	private ResultActions editReply(Cookie who, String id, String replyId, String content) throws Exception {
		return mvc.perform(patch("/api/v1/inquiries/" + id + "/replies/" + replyId).cookie(who).contentType(MediaType.APPLICATION_JSON)
			.content("{\"content\":" + quote(content) + "}"));
	}

	private ResultActions remove(Cookie who, String path) throws Exception {
		return mvc.perform(delete(path).cookie(who));
	}

	private int count(String table) {
		return jdbc.queryForObject("select count(*) from " + table, Integer.class);
	}

	// ---------- 읽기·쓰기 기본 ----------

	@Test
	@DisplayName("로그인하면 글을 쓰고, 로그인 없이도 상세로 읽는다")
	void loggedInCreateAnonymousRead() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(status().isOk())
			.andExpect(jsonPath("$.ok").value(true))
			.andExpect(jsonPath("$.data.title").value("제목"))
			.andExpect(jsonPath("$.data.content").value("내용"))
			.andExpect(jsonPath("$.data.replies", hasSize(0)));
		mvc.perform(get("/api/v1/inquiries")).andExpect(status().isOk()).andExpect(jsonPath("$.data.items", hasSize(1)));
	}

	@Test
	@DisplayName("로그인 없이 글·답글을 쓰거나 고치거나 지우면 401")
	void writesNeedLogin() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		String replyId = reply(alice, id, "답글");
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json("제목", "내용"))).andExpect(status().isUnauthorized());
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"답글\"}"))
			.andExpect(status().isUnauthorized());
		mvc.perform(patch("/api/v1/inquiries/" + id).contentType(MediaType.APPLICATION_JSON).content(json("a", "b"))).andExpect(status().isUnauthorized());
		mvc.perform(delete("/api/v1/inquiries/" + id)).andExpect(status().isUnauthorized());
		mvc.perform(delete("/api/v1/inquiries/" + id + "/replies/" + replyId)).andExpect(status().isUnauthorized());
		assertThat(count("trd_inquiry")).isEqualTo(1);
	}

	@Test
	@DisplayName("앞뒤 공백은 잘려 저장되고 작성자는 응답에 나오지 않는다")
	void trimmedAndAuthorHidden() throws Exception {
		postInquiry(alice, json("  제목  ", " 내용\n ")).andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.title").value("제목"))
			.andExpect(jsonPath("$.data.content").value("내용"))
			.andExpect(jsonPath("$.data.authorUid").doesNotExist())
			.andExpect(jsonPath("$.data.author").doesNotExist());
	}

	@Test
	@DisplayName("제목·내용이 공백만이면 400 이고 그 필드 문구가 온다")
	void blankRejected() throws Exception {
		postInquiry(alice, json("  \u3000", "내용")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION")).andExpect(jsonPath("$.fields.title").exists());
		postInquiry(alice, json("제목", " \u3000 ")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("길이 경계: 제목 100/101, 내용 2000/2001")
	void lengthBoundaries() throws Exception {
		postInquiry(alice, json("가".repeat(100), "내용")).andExpect(status().isCreated());
		postInquiry(alice, json("가".repeat(101), "내용")).andExpect(status().isBadRequest());
		postInquiry(alice, json("제목", "a".repeat(2000))).andExpect(status().isCreated());
		postInquiry(alice, json("제목", "a".repeat(2001))).andExpect(status().isBadRequest());
	}

	@Test
	@DisplayName("답글 길이 경계 1000/1001")
	void replyLengthBoundaries() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		String url = "/api/v1/inquiries/" + id + "/replies";
		mvc.perform(post(url).cookie(alice).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + "a".repeat(1000) + "\"}"))
			.andExpect(status().isCreated());
		mvc.perform(post(url).cookie(alice).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + "a".repeat(1001) + "\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("깨진 JSON 이나 필드 누락은 400")
	void malformedBody() throws Exception {
		postInquiry(alice, "{").andExpect(status().isBadRequest());
		postInquiry(alice, "{}").andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.title").exists()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("HTML 이 그대로 저장되고 그대로 나온다")
	void htmlKeptAsText() throws Exception {
		String script = "<script>alert(1)</script>";
		String id = createInquiry(alice, "제목", script);
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(jsonPath("$.data.content").value(script));
	}

	@Test
	@DisplayName("답글은 상세에 오래된 순으로 보이고 목록 replyCount 가 오른다")
	void repliesOrderedAndCounted() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		reply(bob, id, "첫 답글");
		reply(alice, id, "둘째 답글");
		mvc.perform(get("/api/v1/inquiries/" + id))
			.andExpect(jsonPath("$.data.replies", hasSize(2)))
			.andExpect(jsonPath("$.data.replies[0].content").value("첫 답글"))
			.andExpect(jsonPath("$.data.replies[1].content").value("둘째 답글"));
		mvc.perform(get("/api/v1/inquiries"))
			.andExpect(jsonPath("$.data.items[0].id").value(id))
			.andExpect(jsonPath("$.data.items[0].replyCount").value(2));
	}

	@Test
	@DisplayName("없는 글의 상세·답글·수정·삭제는 404")
	void notFound() throws Exception {
		String id = UUID.randomUUID().toString();
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").cookie(alice).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"답글\"}"))
			.andExpect(status().isNotFound());
		edit(alice, id, "a", "b").andExpect(status().isNotFound());
		remove(admin, "/api/v1/inquiries/" + id).andExpect(status().isNotFound());
		String real = createInquiry(alice, "제목", "내용");
		editReply(alice, real, UUID.randomUUID().toString(), "x").andExpect(status().isNotFound());
		remove(admin, "/api/v1/inquiries/" + real + "/replies/" + UUID.randomUUID()).andExpect(status().isNotFound());
	}

	@Test
	@DisplayName("목록은 최신순이고 같은 시각 글도 빠지거나 겹치지 않는다")
	void keysetPagingKeepsSameInstant() throws Exception {
		Timestamp same = Timestamp.from(Instant.parse("2026-11-18T05:00:00Z"));
		Set<UUID> inserted = new HashSet<>();
		for (int i = 0; i < 25; i++) {
			UUID id = UUID.randomUUID();
			inserted.add(id);
			jdbc.update("insert into trd_inquiry (id, title, content, created_at, updated_at) values (?, ?, ?, ?, ?)", id, "t" + i, "c", same, same);
		}
		MvcResult first = mvc.perform(get("/api/v1/inquiries")).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(20))).andExpect(jsonPath("$.data.nextCursor").isNotEmpty()).andReturn();
		String cursor = JsonPath.read(first.getResponse().getContentAsString(), "$.data.nextCursor");
		MvcResult second = mvc.perform(get("/api/v1/inquiries").param("cursor", cursor)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(5))).andExpect(jsonPath("$.data.nextCursor").value((Object) null)).andReturn();

		Set<UUID> seen = new HashSet<>();
		for (MvcResult r : new MvcResult[] { first, second }) {
			List<String> ids = JsonPath.read(r.getResponse().getContentAsString(), "$.data.items[*].id");
			for (String id : ids) {
				assertThat(seen.add(UUID.fromString(id))).as("겹침 없음").isTrue();
			}
		}
		assertThat(seen).isEqualTo(inserted);
	}

	@Test
	@DisplayName("잘못된 커서는 400")
	void badCursor() throws Exception {
		mvc.perform(get("/api/v1/inquiries").param("cursor", "abc")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("BAD_REQUEST"));
	}

	@Test
	@DisplayName("NUL 문자가 든 제목·내용·답글은 500 이 아니라 400 (Postgres 가 저장 못 하는 문자)")
	void nulCharacterRejected() throws Exception {
		postInquiry(alice, "{\"title\":\"a\\u0000b\",\"content\":\"x\"}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.title").exists());
		postInquiry(alice, "{\"title\":\"t\",\"content\":\"x\\u0000\"}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
		String id = createInquiry(alice, "제목", "내용");
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").cookie(alice).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"\\u0000\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("NBSP·BOM 만 있는 값도 빈 값으로 400 (프론트 trim 과 같은 규칙)")
	void invisibleOnlyRejected() throws Exception {
		postInquiry(alice, json("\u00A0", "내용")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.title").exists());
		postInquiry(alice, json("제목", "\uFEFF \u00A0")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	// ---------- 수정·삭제 권한 ----------

	@Test
	@DisplayName("본인 글은 수정할 수 있고 남(관리자 포함)은 403")
	void editOwnOnly() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		edit(alice, id, "새 제목", "새 내용").andExpect(status().isOk())
			.andExpect(jsonPath("$.data.title").value("새 제목")).andExpect(jsonPath("$.data.content").value("새 내용"));
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(jsonPath("$.data.title").value("새 제목"));
		edit(bob, id, "해킹", "해킹").andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
		edit(admin, id, "관리자", "관리자").andExpect(status().isForbidden());
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(jsonPath("$.data.title").value("새 제목"));
	}

	@Test
	@DisplayName("수정도 같은 검증을 탄다 (공백만 400)")
	void editValidated() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		edit(alice, id, "  ", "내용").andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.title").exists());
	}

	@Test
	@DisplayName("작성자 없는 옛 글은 아무도 수정할 수 없고 관리자만 지운다")
	void legacyInquiryAdminDeleteOnly() throws Exception {
		UUID id = UUID.randomUUID();
		Timestamp now = Timestamp.from(Instant.now());
		jdbc.update("insert into trd_inquiry (id, title, content, created_at, updated_at) values (?, '옛 글', '내용', ?, ?)", id, now, now);
		edit(alice, id.toString(), "a", "b").andExpect(status().isForbidden());
		edit(admin, id.toString(), "a", "b").andExpect(status().isForbidden());
		remove(alice, "/api/v1/inquiries/" + id).andExpect(status().isForbidden());
		remove(admin, "/api/v1/inquiries/" + id).andExpect(status().isNoContent());
		assertThat(count("trd_inquiry")).isZero();
	}

	@Test
	@DisplayName("글 삭제: 본인과 관리자만, 답글도 같이 지워진다")
	void deleteInquiry() throws Exception {
		String mine = createInquiry(alice, "내 글", "내용");
		reply(bob, mine, "답글");
		remove(bob, "/api/v1/inquiries/" + mine).andExpect(status().isForbidden());
		assertThat(count("trd_inquiry")).isEqualTo(1);
		remove(alice, "/api/v1/inquiries/" + mine).andExpect(status().isNoContent());
		assertThat(count("trd_inquiry")).isZero();
		assertThat(count("trd_inquiry_reply")).isZero();

		String other = createInquiry(bob, "남의 글", "내용");
		remove(admin, "/api/v1/inquiries/" + other).andExpect(status().isNoContent());
		assertThat(count("trd_inquiry")).isZero();
	}

	@Test
	@DisplayName("답글 수정은 본인만, 삭제는 본인과 관리자 (글 작성자도 남의 답글은 못 지움)")
	void replyPermissions() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		String bobReply = reply(bob, id, "밥의 답글");
		String path = "/api/v1/inquiries/" + id + "/replies/" + bobReply;

		editReply(bob, id, bobReply, "고침").andExpect(status().isOk()).andExpect(jsonPath("$.data.content").value("고침"));
		editReply(alice, id, bobReply, "남이 고침").andExpect(status().isForbidden());
		editReply(admin, id, bobReply, "관리자가 고침").andExpect(status().isForbidden());
		remove(alice, path).andExpect(status().isForbidden());
		assertThat(count("trd_inquiry_reply")).isEqualTo(1);

		remove(bob, path).andExpect(status().isNoContent());
		assertThat(count("trd_inquiry_reply")).isZero();

		String second = reply(bob, id, "또 답글");
		remove(admin, "/api/v1/inquiries/" + id + "/replies/" + second).andExpect(status().isNoContent());
		assertThat(count("trd_inquiry_reply")).isZero();
	}

	@Test
	@DisplayName("다른 글의 주소로 답글을 고치거나 지울 수 없다 (404)")
	void replyMustBelongToInquiry() throws Exception {
		String a = createInquiry(alice, "글 A", "내용");
		String b = createInquiry(alice, "글 B", "내용");
		String replyOfA = reply(alice, a, "A 의 답글");
		editReply(alice, b, replyOfA, "x").andExpect(status().isNotFound());
		remove(admin, "/api/v1/inquiries/" + b + "/replies/" + replyOfA).andExpect(status().isNotFound());
		assertThat(count("trd_inquiry_reply")).isEqualTo(1);
	}

	@Test
	@DisplayName("상세 응답의 canEdit·canDelete 는 보는 사람에 따라 다르다")
	void permissionFlags() throws Exception {
		String id = createInquiry(alice, "제목", "내용");
		reply(bob, id, "밥의 답글");

		// 로그인 없음: 아무것도 못 한다
		mvc.perform(get("/api/v1/inquiries/" + id))
			.andExpect(jsonPath("$.data.canEdit").value(false)).andExpect(jsonPath("$.data.canDelete").value(false))
			.andExpect(jsonPath("$.data.replies[0].canEdit").value(false)).andExpect(jsonPath("$.data.replies[0].canDelete").value(false));
		// 글쓴이: 글은 수정·삭제, 남의 답글은 못 함
		mvc.perform(get("/api/v1/inquiries/" + id).cookie(alice))
			.andExpect(jsonPath("$.data.canEdit").value(true)).andExpect(jsonPath("$.data.canDelete").value(true))
			.andExpect(jsonPath("$.data.replies[0].canEdit").value(false)).andExpect(jsonPath("$.data.replies[0].canDelete").value(false));
		// 답글쓴이: 글은 못 하고 자기 답글은 수정·삭제
		mvc.perform(get("/api/v1/inquiries/" + id).cookie(bob))
			.andExpect(jsonPath("$.data.canEdit").value(false)).andExpect(jsonPath("$.data.canDelete").value(false))
			.andExpect(jsonPath("$.data.replies[0].canEdit").value(true)).andExpect(jsonPath("$.data.replies[0].canDelete").value(true));
		// 관리자: 삭제만 전부
		mvc.perform(get("/api/v1/inquiries/" + id).cookie(admin))
			.andExpect(jsonPath("$.data.canEdit").value(false)).andExpect(jsonPath("$.data.canDelete").value(true))
			.andExpect(jsonPath("$.data.replies[0].canEdit").value(false)).andExpect(jsonPath("$.data.replies[0].canDelete").value(true));
	}

}
