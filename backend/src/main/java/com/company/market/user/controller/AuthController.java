package com.company.market.user.controller;

import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthCookies;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.user.dto.BusinessLoginRequest;
import com.company.market.user.dto.LoginRequest;
import com.company.market.user.dto.LoginResult;
import com.company.market.user.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

	private final AuthService auth;

	private final AuthCookies cookies;

	@PostMapping("/login")
	public ApiResponse<Map<String, Object>> login(@Valid @RequestBody LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
		return issue(auth.login(body.loginId(), body.password(), body.remember(), req.getRemoteAddr()), res);
	}

	@PostMapping("/login/business")
	public ApiResponse<Map<String, Object>> loginBusiness(@Valid @RequestBody BusinessLoginRequest body, HttpServletRequest req,
			HttpServletResponse res) {
		return issue(auth.loginBusiness(body.bizNo(), body.password(), body.remember(), req.getRemoteAddr()), res);
	}

	/** refresh 쿠키로 access 재발급 + refresh 회전. 영구/세션 쿠키 여부는 로그인 때 저장한 값을 따른다 */
	@PostMapping("/refresh")
	public ApiResponse<Map<String, Object>> refresh(HttpServletRequest req, HttpServletResponse res) {
		String token = cookies.read(req, AuthCookies.REFRESH).orElse("");
		return issue(auth.refresh(token), res);
	}

	/** 이 기기만. 쿠키가 없어도 204 — 이미 로그아웃된 상태와 같다 */
	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest req, HttpServletResponse res) {
		cookies.read(req, AuthCookies.REFRESH).ifPresent(auth::logout);
		cookies.clear(res);
		return ResponseEntity.noContent().build();
	}

	/** 모든 기기에서 로그아웃. access 토큰이 살아 있어야 함 */
	@PostMapping("/logout-all")
	public ResponseEntity<Void> logoutAll(@AuthenticationPrincipal AuthenticatedUser me, HttpServletResponse res) {
		auth.logoutAll(me.id());
		cookies.clear(res);
		return ResponseEntity.noContent().build();
	}

	private ApiResponse<Map<String, Object>> issue(LoginResult result, HttpServletResponse res) {
		cookies.setLogin(res, result.accessToken(), result.refreshToken(), result.remember());
		return ApiResponse.of(Map.of("userId", result.userId()));
	}

}
