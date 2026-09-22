package com.company.market.common.auth;

import java.util.List;

import com.company.market.common.api.ApiError;
import com.company.market.common.config.AppProperties;
import tools.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
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
				.anyRequest().authenticated())
			.exceptionHandling(e -> e
				.authenticationEntryPoint((req, res, ex) -> write(res, json, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "로그인이 필요합니다."))
				.accessDeniedHandler((req, res, ex) -> write(res, json, HttpServletResponse.SC_FORBIDDEN, "FORBIDDEN", "권한이 없습니다.")))
			// CORS 필터보다 앞에: 낯선 Origin 도 빈 403 이 아니라 우리 JSON 형식으로 거절
			.addFilterBefore(originFilter, CorsFilter.class)
			.addFilterBefore(jwtFilter, AuthorizationFilter.class);
		return http.build();
	}

	/** 프론트 도메인 하나만. 와일드카드 금지, 쿠키 인증이라 credentials 허용 (security.md "네트워크") */
	@Bean
	CorsConfigurationSource corsConfigurationSource(AppProperties props) {
		CorsConfiguration cors = new CorsConfiguration();
		cors.setAllowedOrigins(List.of(props.appUrl()));
		cors.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		cors.setAllowedHeaders(List.of("Content-Type", "Accept"));
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

	private static void write(HttpServletResponse res, ObjectMapper json, int status, String code, String message)
			throws java.io.IOException {
		res.setStatus(status);
		res.setContentType(MediaType.APPLICATION_JSON_VALUE);
		json.writeValue(res.getWriter(), ApiError.of(code, message));
	}

}
