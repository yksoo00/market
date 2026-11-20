package com.company.market.user.domain;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.hibernate.annotations.IdGeneratorType;

/** 사용자 식별자(uid) 자동 부여: UP + yyMMdd + 날짜별 일련번호 3자리 (UidGenerator) */
@IdGeneratorType(UidGenerator.class)
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.FIELD, ElementType.METHOD })
public @interface UidGeneratedValue {

}
