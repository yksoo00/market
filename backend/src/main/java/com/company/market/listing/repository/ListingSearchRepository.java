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

	/** 각 행은 [Listing, Product]. ownerId 가 있으면 그 사용자 글만, after* 가 있으면 그 커서 다음부터 */
	public List<Object[]> findPage(ListingSearchCondition c, UUID ownerId, String afterRegDate, UUID afterUserId, int limit) {
		Map<String, Object> params = new HashMap<>();
		StringBuilder jpql = new StringBuilder("select l, p from Listing l join Product p on p.prodId = l.prodId where 1=1");
		appendConditions(jpql, params, c, ownerId);
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

	/** 내 매물 한 페이지(각 행 [Listing, Product]). 같은 사용자의 regDate 는 유일해 regDate 만으로 커서가 된다 */
	public List<Object[]> findMinePage(UUID userId, String afterRegDate, int limit) {
		StringBuilder jpql = new StringBuilder(
				"select l, p from Listing l join Product p on p.prodId = l.prodId where l.userId = :u and l.dtExpire is null");
		if (afterRegDate != null) {
			jpql.append(" and l.regDate < :cr");
		}
		jpql.append(" order by l.regDate desc");
		TypedQuery<Object[]> query = em.createQuery(jpql.toString(), Object[].class).setParameter("u", userId);
		if (afterRegDate != null) {
			query.setParameter("cr", afterRegDate);
		}
		return query.setMaxResults(limit).getResultList();
	}

	public long count(ListingSearchCondition c, UUID ownerId) {
		Map<String, Object> params = new HashMap<>();
		StringBuilder jpql = new StringBuilder("select count(l) from Listing l join Product p on p.prodId = l.prodId where 1=1");
		appendConditions(jpql, params, c, ownerId);
		TypedQuery<Long> query = em.createQuery(jpql.toString(), Long.class);
		params.forEach(query::setParameter);
		return query.getSingleResult();
	}

	private static void appendConditions(StringBuilder jpql, Map<String, Object> params, ListingSearchCondition c, UUID ownerId) {
		// ownerId 가 있으면 그 사용자 글만 (mine=true — id 는 인증 정보에서 온 값이라 파라미터 바인딩만 한다)
		if (ownerId != null) {
			jpql.append(" and l.userId = :owner");
			params.put("owner", ownerId);
		}
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
			// prov_date 는 YYYY-MM-DD 문자열이라 문자열 비교가 날짜 비교와 같다. 납기일 없는 매물은 제외
			jpql.append(" and l.deliveryDate is not null and l.deliveryDate <= :deliveryBy");
			params.put("deliveryBy", c.deliveryBy().toString());
		}
		appendDetailConditions(jpql, params, c);
	}

	/** 상품상태 "이 구간 이상" — 좋은 상태부터. 등록 폼 목록(ListingCreateRequest.PROD_STATE_PATTERN)과 같은 값 */
	private static final List<String> STATES = List.of("신품", "신품대비 90~99%", "신품대비 80~89%", "신품대비 70~79%",
			"신품대비 60~69%", "신품대비 50~59%");

	private static final Map<String, Integer> STATE_RANK = Map.of("new", 1, "90", 2, "80", 3, "70", 4, "60", 5, "50", 6);

	// has 키 → 매물 컬럼. 검색 결과 표시(ListingService.toSearchItem)와 같게 매물 값만 본다
	private static final Map<String, String> HAS_COLUMNS = Map.of(
			"datasheet", "l.prodDataSheet is not null",
			"photo", "(l.prodPhoto1 is not null or l.prodPhoto2 is not null or l.prodPhoto3 is not null or l.prodImage4 is not null)",
			"testReport", "l.testReport is not null",
			"certificate", "l.certificateOfAuthen is not null",
			"replaceProd", "l.replaceProd is not null");

	/** 상세 필터 (2026-10-19). 값은 검증된 키뿐이고 조각은 위 상수에서만 고른다 — 사용자 입력은 바인딩으로만 */
	private static void appendDetailConditions(StringBuilder jpql, Map<String, Object> params, ListingSearchCondition c) {
		if (c.category() != null) {
			// 'P01' 은 P01 자신과 'P01-…' 만 (P011 같은 다른 코드는 아님). 코드는 글자 제한이라 like 이스케이프 불필요
			jpql.append(" and (p.categoryCode = :cat or p.categoryCode like :catPrefix)");
			params.put("cat", c.category());
			params.put("catPrefix", c.category() + "-%");
		}
		if (c.state() != null) {
			jpql.append(" and l.prodState in :states");
			params.put("states", STATES.subList(0, STATE_RANK.get(c.state())));
		}
		if (c.brand() != null) {
			jpql.append(" and lower(p.prodBrand) like lower(:brand) escape '\\'");
			params.put("brand", "%" + escapeLike(c.brand()) + "%");
		}
		// 0 은 "상관없음" — 보증 없는(null) 매물도 남긴다
		if (c.minWarranty() != null && c.minWarranty() > 0) {
			jpql.append(" and l.warrantyPeriod >= :minWarranty");
			params.put("minWarranty", c.minWarranty());
		}
		if (c.coverage() != null) {
			jpql.append(" and l.warrantyCoverage = :coverage");
			params.put("coverage", "replace".equals(c.coverage()) ? "대체" : "환불");
		}
		for (String item : c.hasItems().stream().sorted().toList()) {
			jpql.append(" and ").append(HAS_COLUMNS.get(item));
		}
		if (c.maxMinOrder() != null) {
			jpql.append(" and l.minOrderQuantity <= :maxMinOrder");
			params.put("maxMinOrder", c.maxMinOrder());
		}
	}

	/** 사용자가 친 % _ \ 를 와일드카드가 아니라 글자로 */
	private static String escapeLike(String word) {
		return word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
