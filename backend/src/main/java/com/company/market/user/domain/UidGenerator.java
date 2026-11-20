package com.company.market.user.domain;

import java.lang.reflect.Member;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.EnumSet;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.time.KoreanDates;
import org.hibernate.FlushMode;
import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.generator.BeforeExecutionGenerator;
import org.hibernate.generator.EventType;
import org.hibernate.generator.GeneratorCreationContext;

/**
 * uid = "UP" + 한국 날짜 yyMMdd + 그날의 일련번호 3자리 (예: UP261008001). 하루 999명을 넘으면 가입을 막는다
 * (사용자 지시 2026-11-20 "하루 천 명 이상 안 할 것").
 * 같은 날 동시에 가입해도 겹치지 않게 날짜별 advisory lock 을 트랜잭션이 끝날 때까지 잡고(pg_advisory_xact_lock),
 * 그날 가장 큰 번호 + 1 을 쓴다. 같은 트랜잭션에서 앞서 만든 사용자도 세도록 조회 전에 flush 한다.
 */
public class UidGenerator implements BeforeExecutionGenerator {

	static final String PREFIX = "UP";

	static final int MAX_PER_DAY = 999;

	private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyMMdd");

	public UidGenerator(UidGeneratedValue annotation, Member member, GeneratorCreationContext context) {
	}

	@Override
	public Object generate(SharedSessionContractImplementor session, Object owner, Object currentValue, EventType eventType) {
		String day = todayPrefix();
		session.createNativeQuery("select pg_advisory_xact_lock(hashtext(:key))", Object.class).setParameter("key", "uid:" + day)
			.setHibernateFlushMode(FlushMode.ALWAYS).getResultList();
		String max = session.createNativeQuery("select max(uid) from trd_user_info where uid like :prefix", String.class)
			.setParameter("prefix", day + "%").setHibernateFlushMode(FlushMode.ALWAYS).getSingleResult();
		return next(day, max);
	}

	/** 오늘 접두사(UPyyMMdd)와 그날 가장 큰 uid(없으면 null)에서 다음 uid. 임시 테이블(DevTableService)도 같은 규칙을 쓴다 */
	public static String next(String day, String max) {
		int next = max == null ? 1 : Integer.parseInt(max.substring(day.length())) + 1;
		if (next > MAX_PER_DAY) {
			throw new ApiException(ErrorCode.SIGNUP_DAILY_LIMIT);
		}
		return "%s%03d".formatted(day, next);
	}

	public static String todayPrefix() {
		return PREFIX + LocalDate.now(KoreanDates.SEOUL).format(DAY);
	}

	@Override
	public EnumSet<EventType> getEventTypes() {
		return EnumSet.of(EventType.INSERT);
	}

}
