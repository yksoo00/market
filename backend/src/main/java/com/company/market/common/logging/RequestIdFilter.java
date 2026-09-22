package com.company.market.common.logging;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * 요청마다 requestId 를 MDC 에 넣어 한 요청의 로그를 묶어 볼 수 있게 (rules/backend.md "로그").
 * Caddy 가 X-Request-Id 를 넘기면 그걸 쓰고(프록시 로그와 대조), 없으면 생성. 응답 헤더로도 돌려줘 사용자 문의 때 대조.
 * 가장 먼저 도는 필터여야 Security 필터의 로그에도 붙는다.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

	public static final String HEADER = "X-Request-Id";

	public static final String MDC_KEY = "requestId";

	@Override
	protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
			throws ServletException, IOException {
		String incoming = req.getHeader(HEADER);
		// 외부 입력이라 길이·문자 제한. 로그 위조·과대 길이 방지
		String requestId = incoming != null && incoming.matches("[A-Za-z0-9._-]{8,64}") ? incoming : UUID.randomUUID().toString();
		MDC.put(MDC_KEY, requestId);
		res.setHeader(HEADER, requestId);
		try {
			chain.doFilter(req, res);
		}
		finally {
			MDC.clear();
		}
	}

}
