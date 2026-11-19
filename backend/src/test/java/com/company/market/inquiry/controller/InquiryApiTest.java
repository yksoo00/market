package com.company.market.inquiry.controller;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import com.company.market.TestInfraConfiguration;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 익명 문의 게시판 API (스펙 2026-11-18-inquiry-board-design.md). 로그인(쿠키·토큰) 없이 부른다 */
@Import(TestInfraConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InquiryApiTest {

	@Autowired
	MockMvc mvc;

	@Autowired
	JdbcTemplate jdbc;

	@BeforeEach
	void cleanUp() {
		jdbc.update("delete from trd_inquiry_reply");
		jdbc.update("delete from trd_inquiry");
	}

	private static String json(String title, String content) {
		return "{\"title\":" + quote(title) + ",\"content\":" + quote(content) + "}";
	}

	private static String quote(String s) {
		return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
	}

	private MvcResult postInquiry(String body) throws Exception {
		return mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(body)).andReturn();
	}

	private String createInquiry(String title, String content) throws Exception {
		MvcResult r = mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json(title, content)))
			.andExpect(status().isCreated()).andReturn();
		return com.jayway.jsonpath.JsonPath.read(r.getResponse().getContentAsString(), "$.data.id");
	}

	private void reply(String id, String content) throws Exception {
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").contentType(MediaType.APPLICATION_JSON)
			.content("{\"content\":" + quote(content) + "}")).andExpect(status().isCreated());
	}

	@Test
	@DisplayName("로그인 없이 글을 쓰면 201 이고 상세로 읽힌다")
	void anonymousCreateAndRead() throws Exception {
		String id = createInquiry("제목", "내용");
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(status().isOk())
			.andExpect(jsonPath("$.ok").value(true))
			.andExpect(jsonPath("$.data.title").value("제목"))
			.andExpect(jsonPath("$.data.content").value("내용"))
			.andExpect(jsonPath("$.data.replies", hasSize(0)));
	}

	@Test
	@DisplayName("앞뒤 공백은 잘려 저장된다")
	void trimmed() throws Exception {
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json("  제목  ", " 내용\n ")))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.data.title").value("제목"))
			.andExpect(jsonPath("$.data.content").value("내용"));
	}

	@Test
	@DisplayName("제목·내용이 공백만이면 400 이고 그 필드 문구가 온다")
	void blankRejected() throws Exception {
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json("  　", "내용")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("VALIDATION"))
			.andExpect(jsonPath("$.fields.title").exists());
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json("제목", " 　 ")))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("길이 경계: 제목 100/101, 내용 2000/2001")
	void lengthBoundaries() throws Exception {
		assertThat(postInquiry(json("가".repeat(100), "내용")).getResponse().getStatus()).isEqualTo(201);
		assertThat(postInquiry(json("가".repeat(101), "내용")).getResponse().getStatus()).isEqualTo(400);
		assertThat(postInquiry(json("제목", "a".repeat(2000))).getResponse().getStatus()).isEqualTo(201);
		assertThat(postInquiry(json("제목", "a".repeat(2001))).getResponse().getStatus()).isEqualTo(400);
	}

	@Test
	@DisplayName("답글 길이 경계 1000/1001")
	void replyLengthBoundaries() throws Exception {
		String id = createInquiry("제목", "내용");
		String url = "/api/v1/inquiries/" + id + "/replies";
		assertThat(mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + "a".repeat(1000) + "\"}"))
			.andReturn().getResponse().getStatus()).isEqualTo(201);
		mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"" + "a".repeat(1001) + "\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("깨진 JSON 이나 필드 누락은 400")
	void malformedBody() throws Exception {
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content("{")).andExpect(status().isBadRequest());
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content("{}"))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.fields.title").exists())
			.andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("HTML 이 그대로 저장되고 그대로 나온다")
	void htmlKeptAsText() throws Exception {
		String script = "<script>alert(1)</script>";
		String id = createInquiry("제목", script);
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(jsonPath("$.data.content").value(script));
	}

	@Test
	@DisplayName("답글은 상세에 오래된 순으로 보이고 목록 replyCount 가 오른다")
	void repliesOrderedAndCounted() throws Exception {
		String id = createInquiry("제목", "내용");
		reply(id, "첫 답글");
		reply(id, "둘째 답글");
		mvc.perform(get("/api/v1/inquiries/" + id))
			.andExpect(jsonPath("$.data.replies", hasSize(2)))
			.andExpect(jsonPath("$.data.replies[0].content").value("첫 답글"))
			.andExpect(jsonPath("$.data.replies[1].content").value("둘째 답글"));
		mvc.perform(get("/api/v1/inquiries"))
			.andExpect(jsonPath("$.data.items[0].id").value(id))
			.andExpect(jsonPath("$.data.items[0].replyCount").value(2));
	}

	@Test
	@DisplayName("없는 글의 상세·답글은 404")
	void notFound() throws Exception {
		String id = UUID.randomUUID().toString();
		mvc.perform(get("/api/v1/inquiries/" + id)).andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"답글\"}"))
			.andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
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
		String cursor = com.jayway.jsonpath.JsonPath.read(first.getResponse().getContentAsString(), "$.data.nextCursor");
		MvcResult second = mvc.perform(get("/api/v1/inquiries").param("cursor", cursor)).andExpect(status().isOk())
			.andExpect(jsonPath("$.data.items", hasSize(5))).andExpect(jsonPath("$.data.nextCursor").value((Object) null)).andReturn();

		Set<UUID> seen = new HashSet<>();
		for (MvcResult r : new MvcResult[] { first, second }) {
			java.util.List<String> ids = com.jayway.jsonpath.JsonPath.read(r.getResponse().getContentAsString(), "$.data.items[*].id");
			for (String id : ids) {
				assertThat(seen.add(UUID.fromString(id))).as("겹침 없음").isTrue();
			}
		}
		assertThat(seen).isEqualTo(inserted);
	}

	@Test
	@DisplayName("NUL 문자가 든 제목·내용·답글은 500 이 아니라 400 (Postgres 가 저장 못 하는 문자)")
	void nulCharacterRejected() throws Exception {
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"a\u0000b\",\"content\":\"x\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.title").exists());
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"t\",\"content\":\"x\u0000\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
		String id = createInquiry("제목", "내용");
		mvc.perform(post("/api/v1/inquiries/" + id + "/replies").contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"\u0000\"}"))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("NBSP·BOM 만 있는 값도 빈 값으로 400 (프론트 trim 과 같은 규칙)")
	void invisibleOnlyRejected() throws Exception {
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json(" ", "내용")))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.title").exists());
		mvc.perform(post("/api/v1/inquiries").contentType(MediaType.APPLICATION_JSON).content(json("제목", "﻿  ")))
			.andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.content").exists());
	}

	@Test
	@DisplayName("잘못된 커서는 400")
	void badCursor() throws Exception {
		mvc.perform(get("/api/v1/inquiries").param("cursor", "abc")).andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("BAD_REQUEST"));
	}

}
