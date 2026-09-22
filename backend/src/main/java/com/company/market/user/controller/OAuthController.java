package com.company.market.user.controller;

import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.crypto.PiiHasher;
import com.company.market.user.dto.LoginResult;
import com.company.market.user.dto.SocialSignupRequest;
import com.company.market.user.service.OAuthLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 소셜 로그인의 시작(GET /oauth/{provider})과 콜백(GET /oauth/{provider}/callback)은 Spring Security 필터가 처리한다
 * (SecurityConfig.oauth2Login). 여기는 프론트가 JSON 으로 부르는 마무리만.
 */
@RestController
@RequestMapping("/api/v1/auth/oauth")
@RequiredArgsConstructor
public class OAuthController {

	private final OAuthLoginService oauth;

	private final AuthCookies cookies;

	private final PiiHasher hasher;

	@PostMapping("/complete")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<Map<String, Object>> complete(@Valid @RequestBody SocialSignupRequest body, HttpServletRequest req,
			HttpServletResponse res) {
		String flowHash = cookies.read(req, AuthCookies.OAUTH_FLOW).map(hasher::hash).orElse(null);
		LoginResult result = oauth.complete(body.token(), flowHash, body.nickname(), body.marketingOptIn(), req.getRemoteAddr());
		cookies.clearOAuthFlow(res);
		cookies.setLogin(res, result.accessToken(), result.refreshToken(), result.remember());
		return ApiResponse.of(Map.of("userId", result.userId()));
	}

}
