package com.company.market.listing.repository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.company.market.listing.dto.ListingSearchCondition;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

/**
 * 매물 검색. 조건이 있을 때만 붙는 동적 JPQL — 값은 전부 파라미터 바인딩(문자열에 끼워 넣지 않음, security.md 인젝션).
 * listings 와 products 는 엔티티 연관 없이 prod_id 로만 이어져 있어 명시 조인.
 */
@Repository
@RequiredArgsConstructor
public class ListingSearchRepository {

	private final EntityManager em;

	/** 각 행은 [Listing, Product]. after* 가 있으면 그 커서 다음부터 */
	public List<Object[]> findPage(ListingSearchCondition c, String afterRegDate, UUID afterUserId, int limit) {
		Map<String, Object> params = new HashMap<>();
		StringBuilder jpql = new StringBuilder("select l, p from Listing l join Product p on p.prodId = l.prodId where 1=1");
		appendConditions(jpql, params, c);
		if (afterRegDate != null) {
			jpql.append(" and (l.regDate < :cr or (l.regDate = :cr and l.userId < :cu))");
			params.put("cr", afterRegDate);
			params.put("cu", afterUserId);
		}
		jpql.append(" order by l.regDate desc, l.userId desc");
		TypedQuery<Object[]> query = em.createQuery(jpql.toString(), Object[].class);
		params.forEach(query::setParameter);
		return query.setMaxResults(limit).getResultList();
	}

	public long count(ListingSearchCondition c) {
		Map<String, Object> params = new HashMap<>();
		StringBuilder jpql = new StringBuilder("select count(l) from Listing l join Product p on p.prodId = l.prodId where 1=1");
		appendConditions(jpql, params, c);
		TypedQuery<Long> query = em.createQuery(jpql.toString(), Long.class);
		params.forEach(query::setParameter);
		return query.getSingleResult();
	}

	private static void appendConditions(StringBuilder jpql, Map<String, Object> params, ListingSearchCondition c) {
		String scope = switch (c.field()) {
			case "name" -> "concat(p.prodName, ' ', coalesce(p.prodNo, ''))";
			case "brand" -> "p.prodBrand";
			default -> "concat(p.prodName, ' ', coalesce(p.prodNo, ''), ' ', p.prodBrand)";
		};
		// 공백으로 나눈 낱말이 전부 들어 있어야 매칭 (프론트 10-01 규칙과 같음: "DDR4 ECC 32GB" ↔ "DDR4 32GB ECC RDIMM")
		// (?U): 한글 IME 의 전각 공백(U+3000)·NBSP 도 나눈다 (JS /\s+/ 와 같게)
		List<String> words = c.q() == null ? List.of()
				: List.of(c.q().split("(?U)\\s+")).stream().filter(w -> !w.isEmpty()).toList();
		for (int i = 0; i < words.size(); i++) {
			// 소문자 변환은 양쪽 다 DB lower() 로 — Java 와 PostgreSQL 은 İ·Σ 같은 글자를 다르게 바꿔 매칭이 어긋난다
			jpql.append(" and lower(").append(scope).append(") like lower(:w").append(i).append(") escape '\\'");
			params.put("w" + i, "%" + escapeLike(words.get(i)) + "%");
		}
		switch (c.status()) {
			case "available" -> jpql.append(" and l.dtExpire is null");
			case "completed" -> jpql.append(" and l.dtExpire is not null");
			default -> {
			}
		}
		if (c.minStock() != null) {
			jpql.append(" and l.stockQuantity >= :minStock");
			params.put("minStock", c.minStock());
		}
		if (c.minPrice() != null) {
			jpql.append(" and l.salesUnitPrice >= :minPrice");
			params.put("minPrice", c.minPrice());
		}
		if (c.maxPrice() != null) {
			jpql.append(" and l.salesUnitPrice <= :maxPrice");
			params.put("maxPrice", c.maxPrice());
		}
		if (c.deliveryBy() != null) {
			// delivery_date 는 YYYY-MM-DD 문자열이라 문자열 비교가 날짜 비교와 같다. 납기일 없는 매물은 제외
			jpql.append(" and l.deliveryDate is not null and l.deliveryDate <= :deliveryBy");
			params.put("deliveryBy", c.deliveryBy().toString());
		}
	}

	/** 사용자가 친 % _ \ 를 와일드카드가 아니라 글자로 */
	private static String escapeLike(String word) {
		return word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
