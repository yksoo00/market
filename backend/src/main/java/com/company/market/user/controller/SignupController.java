package com.company.market.user.controller;

import java.util.Map;

import com.company.market.common.api.ApiResponse;
import com.company.market.user.dto.CheckLoginIdRequest;
import com.company.market.user.dto.CheckNicknameRequest;
import com.company.market.user.dto.SignupPersonalRequest;
import com.company.market.user.service.SignupService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/signup")
@RequiredArgsConstructor
public class SignupController {

	private final SignupService signup;

	@PostMapping("/check-login-id")
	public ApiResponse<Map<String, Boolean>> checkLoginId(@Valid @RequestBody CheckLoginIdRequest body, HttpServletRequest req) {
		return ApiResponse.of(Map.of("available", signup.isLoginIdAvailable(body.loginId(), req.getRemoteAddr())));
	}

	@PostMapping("/check-nickname")
	public ApiResponse<Map<String, Boolean>> checkNickname(@Valid @RequestBody CheckNicknameRequest body, HttpServletRequest req) {
		return ApiResponse.of(Map.of("available", signup.isNicknameAvailable(body.nickname(), req.getRemoteAddr())));
	}

	/** 가입만 하고 로그인은 시키지 않는다 — 완료 화면에서 "로그인하러 가기" (decisions.md 2026-09-22) */
	@PostMapping("/personal")
	@ResponseStatus(HttpStatus.CREATED)
	public ApiResponse<Map<String, Object>> signupPersonal(@Valid @RequestBody SignupPersonalRequest body, HttpServletRequest req) {
		return ApiResponse.of(Map.of("userId", signup.signupPersonal(body, req.getRemoteAddr())));
	}

}
