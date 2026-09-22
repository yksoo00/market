package com.company.market.common.auth;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** access 쿠키 → SecurityContext (+ MDC userId). 토큰이 없거나 틀리면 그냥 통과시키고, 인증 필요 여부는 SecurityConfig 가 판단 */
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

	private final JwtProvider jwt;

	private final AuthCookies cookies;

	@Override
	protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
			throws ServletException, IOException {
		cookies.read(req, AuthCookies.ACCESS).flatMap(jwt::parse).ifPresent(user -> {
			var auth = new UsernamePasswordAuthenticationToken(user, null,
					List.of(new SimpleGrantedAuthority("ROLE_" + user.role().name())));
			SecurityContextHolder.getContext().setAuthentication(auth);
			MDC.put("userId", user.id().toString()); // RequestIdFilter 가 요청 끝에 MDC 를 비운다
		});
		chain.doFilter(req, res);
	}

}
