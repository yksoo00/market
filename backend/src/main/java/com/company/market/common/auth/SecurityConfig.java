package com.company.market.common.auth;

import java.util.List;

import com.company.market.common.api.ApiError;
import com.company.market.common.auth.oauth.GetOnlyAuthorizationRequestResolver;
import com.company.market.common.auth.oauth.NoopAuthorizedClientRepository;
import com.company.market.common.auth.oauth.OAuthLoginHandlers;
import com.company.market.common.auth.oauth.RedisAuthorizationRequestRepository;
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
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
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
			ObjectMapper json, ClientRegistrationRepository registrations, RedisAuthorizationRequestRepository authRequests,
			OAuthLoginHandlers oauthHandlers, NoopAuthorizedClientRepository noAuthorizedClients) throws Exception {
		http.csrf(csrf -> csrf.disable())
			.cors(Customizer.withDefaults())
			.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.formLogin(f -> f.disable())
			.httpBasic(b -> b.disable())
			.logout(l -> l.disable())
			// 소셜 로그인. 시작 GET /api/v1/auth/oauth/{provider}, 콜백 GET /api/v1/auth/oauth/{provider}/callback.
			// loginPage 를 지정하는 이유: 안 하면 스프링이 /login HTML 페이지 필터를 붙인다 (진입점은 위 exceptionHandling 이 이김)
			.oauth2Login(o -> o
				.loginPage("/api/v1/auth/oauth/login")
				.authorizedClientRepository(noAuthorizedClients)
				.authorizationEndpoint(a -> a
					.authorizationRequestResolver(new GetOnlyAuthorizationRequestResolver(registrations))
					.authorizationRequestRepository(authRequests))
				.redirectionEndpoint(r -> r.baseUri(GetOnlyAuthorizationRequestResolver.BASE_URI + "/*/callback"))
				.successHandler(oauthHandlers)
				.failureHandler(oauthHandlers))
			.authorizeHttpRequests(a -> a
				// 먼저 걸리는 규칙이 이김: 로그아웃(모든 기기)은 /auth/** 아래지만 로그인 필요
				.requestMatchers("/api/v1/auth/logout-all").authenticated()
				.requestMatchers("/api/v1/auth/**", "/actuator/health", "/actuator/health/**").permitAll()
				// 매물 목록·상세는 공개 조회 (등록·수정·삭제는 아래 anyRequest 로 인증 필요)
				.requestMatchers(HttpMethod.GET, "/api/v1/listings", "/api/v1/listings/*/*").permitAll()
				.anyRequest().authenticated())
			.exceptionHandling(e -> e
				.authenticationEntryPoint((req, res, ex) -> write(res, json, ErrorCode.UNAUTHENTICATED))
				.accessDeniedHandler((req, res, ex) -> write(res, json, ErrorCode.FORBIDDEN)))
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

	private static void write(HttpServletResponse res, ObjectMapper json, ErrorCode code) throws java.io.IOException {
		res.setStatus(code.status().value());
		res.setContentType(MediaType.APPLICATION_JSON_VALUE);
		json.writeValue(res.getWriter(), ApiError.of(code));
	}

}
