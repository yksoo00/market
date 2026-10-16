package com.company.market.user.service;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.user.domain.User;
import com.company.market.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 다른 도메인이 화면에 보여 줄 사용자 표시 이름만 (개인정보 없이). 도메인 간은 service 로만 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class UserDirectory {

	private final UserRepository users;

	/** 한 쿼리로 묶어 조회 (목록 N+1 방지). 없는 id 는 빠진다 */
	public Map<UUID, String> nicknamesOf(Collection<UUID> ids) {
		return users.findAllById(ids).stream().collect(Collectors.toMap(User::getId, User::getNickname));
	}

}
