package com.company.market.common.auth;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Set;

import com.company.market.common.api.ApiError;
import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ErrorCode;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * CSRF 대응: 쿠키 인증이라 상태를 바꾸는 요청은 Origin 이 우리 프론트여야 한다 (security.md "인증").
 * Origin 이 없는 요청(Bruno·서버 간 호출)은 브라우저가 아니라 CSRF 대상이 아니므로 통과.
 */
@Component
public class OriginCheckFilter extends OncePerRequestFilter {

	private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

	private final Set<String> allowedOrigins;

	private final ObjectMapper json;

	public OriginCheckFilter(AppProperties props, ObjectMapper json) {
		// allowedOriginList() 가 이미 소문자·중복 제거
		this.allowedOrigins = Set.copyOf(props.allowedOriginList());
		this.json = json;
	}

	@Override
	protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
			throws ServletException, IOException {
		String origin = req.getHeader(HttpHeaders.ORIGIN);
		if (!SAFE_METHODS.contains(req.getMethod()) && origin != null && !allowedOrigins.contains(origin.toLowerCase())) {
			res.setStatus(HttpServletResponse.SC_FORBIDDEN);
			res.setContentType(MediaType.APPLICATION_JSON_VALUE);
			res.setCharacterEncoding(StandardCharsets.UTF_8.name()); // 없으면 Tomcat writer 가 ISO-8859-1 로 써서 한글이 '?'
			json.writeValue(res.getWriter(), ApiError.of(ErrorCode.FORBIDDEN, "허용되지 않은 출처입니다."));
			return;
		}
		chain.doFilter(req, res);
	}

}
