package com.company.market.listing.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import com.company.market.listing.domain.Product;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, String> {

	/** 같은 상품 = 이름·제조사·분류번호가 같음 (제조일은 2026-11-04 에 뺐다). 분류번호는 호출하는 쪽이 null 을 "" 로 넘긴다 (null 바인딩 타입 문제 회피) */
	@Query("""
		select p from Product p
		where p.prodName = :name and p.prodBrand = :brand and coalesce(p.prodClassNo, '') = :classNo
		order by p.prodId
		""")
	List<Product> findAllSame(@Param("name") String name, @Param("brand") String brand, @Param("classNo") String classNo, Pageable pageable);

	/** 엑셀 다량 등록용 느슨한 일치 — 대소문자만 무시한다(입력 쪽 공백은 호출하는 쪽이 정리). 분류번호는 위와 같이 null 을 "" 로 넘긴다 */
	@Query("""
		select p from Product p
		where lower(p.prodName) = lower(:name) and lower(p.prodBrand) = lower(:brand) and lower(coalesce(p.prodClassNo, '')) = lower(:classNo)
		order by p.prodId
		""")
	List<Product> findAllSameIgnoreCase(@Param("name") String name, @Param("brand") String brand, @Param("classNo") String classNo,
			Pageable pageable);

	/** 엑셀 대량구매의 대체상품 찾기 — 이름이 (대소문자만 무시하고) 같은 마스터. 입력 쪽 공백은 호출하는 쪽이 정리 */
	@Query("select p from Product p where lower(p.prodName) = lower(:name) order by p.prodId")
	List<Product> findAllByNameIgnoreCase(@Param("name") String name);

	/**
	 * 엑셀 대량구매의 상품 찾기 — 이름·제조사는 대소문자·공백·하이픈을 무시하고 같아야 하되 제조사가 ''(없음)이면 보지 않고, 분류번호도
	 * ''(없음)이면 보지 않는다(적혀 있으면 대소문자만 무시하고 같아야 함). name·brand 는 호출하는 쪽이 같은 규칙으로 정리해 넘긴다
	 * (소문자, 공백·하이픈 제거). 여럿이면 자동으로 고르지 않고 사용자가 고르게 하려고 **전부** 돌려준다(상한은 pageable)
	 */
	@Query("""
		select p from Product p
		where lower(replace(replace(p.prodName, ' ', ''), '-', '')) = :name
		  and (:brand = '' or lower(replace(replace(p.prodBrand, ' ', ''), '-', '')) = :brand)
		  and (:classNo = '' or lower(coalesce(p.prodClassNo, '')) = lower(:classNo))
		order by p.prodId
		""")
	List<Product> findAllLoose(@Param("name") String name, @Param("brand") String brand, @Param("classNo") String classNo, Pageable pageable);

	/**
	 * 엑셀 대량구매의 폴백 — 이름이 정확히 같은 마스터가 없을 때 이름에 키가 **포함된** 마스터. pattern 은 호출하는 쪽이 소문자·공백·하이픈을 빼고
	 * %·_·\ 를 이스케이프해 만든 LIKE 패턴이고, DB 쪽 이름도 같은 정리를 한다. 이름이 짧은(= 더 가까운) 순
	 */
	@Query("""
		select p from Product p
		where lower(replace(replace(p.prodName, ' ', ''), '-', '')) like :pattern escape '\\'
		order by length(p.prodName), p.prodName, p.prodId
		""")
	List<Product> findAllNameContains(@Param("pattern") String pattern, Pageable pageable);

	/** 제조일만 달라 따로 있던 옛 마스터가 여럿이면 가장 오래된(prod_id 가 작은) 한 행 — 단일 결과 예외를 피한다 */
	default Optional<Product> findSame(String name, String brand, String classNo) {
		return findAllSame(name, brand, classNo, PageRequest.of(0, 1)).stream().findFirst();
	}

	/**
	 * 상품마스터 생성 잠금 (트랜잭션 끝까지). unique(이름, 제조사)를 없앤 뒤(2026-10-27 설계 PR 2) 같은 네 값의 중복 생성과
	 * 채번(KP-연도-일련번호, 개수 기반) 충돌을 함께 막는다. 생성은 드물어 키 하나로 줄 세운다
	 */
	@Query(value = "select 1 from (select pg_advisory_xact_lock(hashtext('prod-master'))) l", nativeQuery = true)
	Integer lockCreation();

	long countByProdIdStartingWith(String prefix);

	/**
	 * 상품마스터 검색(페이지 번호)의 정렬된 상품ID 전부 (계획 2026-11-09-product-search-modal.md). 빈 글("")은 "그 조건 없음" — null 바인딩의 타입 문제를 피한다.
	 * contains·prefix·brand 는 호출하는 쪽이 %·_·\ 를 이스케이프(\)해 만든 LIKE 패턴, q 는 이름 비교용 원문.
	 * 정렬: 이름이 q 와 정확히 같음 → q 로 시작 → q 를 포함 → 그 밖(제조사·번호·분류번호에서만 걸림), 같은 등급 안에서는 이름순·상품ID순 (결정적이라 페이지 사이에 중복·누락이 없다)
	 */
	@Query(value = """
		select p.prod_id from trd_prod_master p
		 where (:major = '' or p.major_category = :major)
		   and (:middle = '' or p.middle_category = :middle)
		   and (:minor = '' or p.minor_category = :minor)
		   and (:brand = '' or lower(p.prod_brand) like lower(:brand) escape '\\')
		   and (:q = '' or lower(p.prod_name) like lower(:contains) escape '\\'
		        or lower(p.prod_brand) like lower(:contains) escape '\\'
		        or lower(coalesce(p.prod_part_no, '')) like lower(:contains) escape '\\'
		        or lower(coalesce(p.prod_class_no, '')) like lower(:contains) escape '\\')
		 order by case when :q = '' then 0
		               when lower(p.prod_name) = lower(:q) then 0
		               when lower(p.prod_name) like lower(:prefix) escape '\\' then 1
		               when lower(p.prod_name) like lower(:contains) escape '\\' then 2
		               else 3 end,
		          lower(p.prod_name), p.prod_id
		""", nativeQuery = true)
	List<String> orderedIds(@Param("q") String q, @Param("contains") String contains, @Param("prefix") String prefix,
			@Param("major") String major, @Param("middle") String middle, @Param("minor") String minor, @Param("brand") String brand);

	/** 마스터별 판매 가능한 매물 수 — 재고가 있고 거래완료가 아닌 것. 없는 마스터는 결과에 안 나온다 */
	@Query(value = """
		select r.prod_id, count(*) from trd_prod_reg r
		 where r.prod_id in (:ids) and r.dt_expire is null and r.stock_quantity > 0
		 group by r.prod_id
		""", nativeQuery = true)
	List<Object[]> countAvailableListings(@Param("ids") Collection<String> ids);

	/** pattern 은 호출하는 쪽이 %·_ 를 이스케이프(\)해 만든 LIKE 패턴 — 이름·제조사·상품번호 어디든 부분 일치 */
	@Query("""
		select p from Product p
		where lower(p.prodName) like lower(:pattern) escape '\\'
		   or lower(p.prodBrand) like lower(:pattern) escape '\\'
		   or lower(p.prodNo) like lower(:pattern) escape '\\'
		order by p.prodName, p.prodId
		""")
	List<Product> search(@Param("pattern") String pattern, Pageable pageable);

}
