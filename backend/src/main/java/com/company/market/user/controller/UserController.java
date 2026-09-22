package com.company.market.user.controller;

import com.company.market.common.api.ApiResponse;
import com.company.market.common.auth.AuthenticatedUser;
import com.company.market.user.dto.MeResponse;
import com.company.market.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

	private final UserService users;

	@GetMapping("/me")
	public ApiResponse<MeResponse> me(@AuthenticationPrincipal AuthenticatedUser me) {
		return ApiResponse.of(users.me(me.id()));
	}

}
