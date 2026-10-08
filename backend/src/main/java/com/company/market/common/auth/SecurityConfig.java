package com.company.market.common.auth;

import java.nio.charset.StandardCharsets;
import java.util.List;

import com.company.market.common.api.ApiError;
import com.company.market.common.config.AppProperties;
import com.company.market.common.exception.ErrorCode;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * stateless. 세션·CSRF 토큰 없음 — 인증은 JWT 쿠키, CSRF 는 SameSite=Lax + OriginCheckFilter.
 * 401/403 도 `{ ok:false, code }` 형식으로 (Spring 기본은 빈 본문).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Bean
	SecurityFilterChain filterChain(HttpSecurity http, JwtAuthenticationFilter jwtFilter, OriginCheckFilter originFilter,
			ObjectMapper json) throws Exception {
		http.csrf(csrf -> csrf.disable())
			.cors(Customizer.withDefaults())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.formLogin(f -> f.disable())
			.httpBasic(b -> b.disable())
			.logout(l -> l.disable())
			.authorizeHttpRequests(a -> a
				// 먼저 걸리는 규칙이 이김: 로그아웃(모든 기기)은 /auth/** 아래지만 로그인 필요
				.requestMatchers("/api/v1/auth/logout-all").authenticated()
				.requestMatchers("/api/v1/auth/**", "/actuator/health", "/actuator/health/**").permitAll()
				// 매물 목록·상세는 공개 조회 (등록·수정·삭제는 아래 anyRequest 로 인증 필요)
				.requestMatchers(HttpMethod.GET, "/api/v1/listings", "/api/v1/listings/*/*").permitAll()
				// 업로드 파일 열람: 공개/비공개(로그인) 판단은 FileController 가 폴더로 한다
				.requestMatchers(HttpMethod.GET, "/api/v1/files/**").permitAll()
				.requestMatchers(HttpMethod.HEAD, "/api/v1/files/**").permitAll()
				.anyRequest().authenticated())
			.exceptionHandling(e -> e
				.authenticationEntryPoint((req, res, ex) -> write(res, json, ErrorCode.UNAUTHENTICATED))
				.accessDeniedHandler((req, res, ex) -> write(res, json, ErrorCode.FORBIDDEN)))
			// CORS 필터보다 앞에: 낯선 Origin 도 빈 403 이 아니라 우리 JSON 형식으로 거절
			.addFilterBefore(originFilter, CorsFilter.class)
			.addFilterBefore(jwtFilter, AuthorizationFilter.class);
		return http.build();
	}

	/** 허용 목록(APP_URL + ALLOWED_ORIGINS)의 프론트 출처만. 와일드카드 금지, 쿠키 인증이라 credentials 허용 (security.md "네트워크") */
	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration cors = new CorsConfiguration();
		cors.setAllowedOrigins(props.allowedOriginList());
		cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		cors.setAllowedHeaders(List.of("Content-Type", "Accept", "Idempotency-Key"));
		cors.setAllowCredentials(true);
		cors.setMaxAge(3600L);
		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/api/**", cors);
		return source;
	}

	/** bcrypt cost 12 (security.md "인증") */
	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(12);
	}

	private static void write(HttpServletResponse res, ObjectMapper json, ErrorCode code) throws java.io.IOException {
		res.setStatus(code.status().value());
		res.setContentType(MediaType.APPLICATION_JSON_VALUE);
		res.setCharacterEncoding(StandardCharsets.UTF_8.name()); // 없으면 Tomcat writer 가 ISO-8859-1 로 써서 한글이 '?'
		json.writeValue(res.getWriter(), ApiError.of(code));
	}

}
