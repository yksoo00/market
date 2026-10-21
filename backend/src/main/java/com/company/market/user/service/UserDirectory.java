package com.company.market.user.service;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import com.company.market.user.domain.User;
import com.company.market.user.domain.UserKind;
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

	/**
	 * 남에게 보여 줄 이름: 별명을 쓰는 개인은 별명, 기업은 회사명. 그 밖엔 값이 없다(null) —
	 * User.getNickname() 은 이때 로그인 아이디를 돌려주는데, 로그인 아이디는 자격증명 절반이라 남에게 보이지 않는다
	 * (스펙 2026-10-15 "상대방은 닉네임만"). 한 쿼리로 묶어 조회(목록 N+1 방지), 없는 id 는 빠진다.
	 */
	public Map<UUID, String> nicknamesOf(Collection<UUID> ids) {
		Map<UUID, String> names = new HashMap<>();
		for (User user : users.findAllById(ids)) {
			names.put(user.getId(), publicName(user));
		}
		return names;
	}

	/**
	 * 알림 메일 받을 주소 — 서버 안(메일 발송)에서만 쓴다. API 응답·로그에 넣지 않는다(개인정보).
	 * 비어 있는 사용자는 빠진다
	 */
	public Map<UUID, String> emailsOf(Collection<UUID> ids) {
		Map<UUID, String> emails = new HashMap<>();
		for (User user : users.findAllById(ids)) {
			if (user.getEmail() != null && !user.getEmail().isBlank()) {
				emails.put(user.getId(), user.getEmail());
			}
		}
		return emails;
	}

	private static String publicName(User user) {
		if (user.getKind() == UserKind.BUSINESS) {
			return user.getCompanyName() == null || user.getCompanyName().isBlank() ? null : user.getCompanyName();
		}
		return "Y".equals(user.getNicknameUsage()) ? user.getUserNickname() : null;
	}

}
