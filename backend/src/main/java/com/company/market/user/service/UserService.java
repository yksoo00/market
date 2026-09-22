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

	/** access 토큰은 15분 살아 있으므로 그 사이 정지·탈퇴된 계정은 여기서 걸러 401 */
	public MeResponse me(UUID id) {
		User user = users.findById(id).filter(User::isActive)
			.orElseThrow(() -> new ApiException(ErrorCode.SESSION_EXPIRED));
		return MeResponse.from(user);
	}

}
