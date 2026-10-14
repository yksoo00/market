package com.company.market.user.service;

import java.util.UUID;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.user.domain.User;
import com.company.market.user.dto.MeResponse;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserService {

	private final UserRepository users;

	public MeResponse me(UUID id) {
		User user = users.findById(id)
			.orElseThrow(() -> new ApiException(ErrorCode.SESSION_EXPIRED));
		return MeResponse.from(user);
	}

}
