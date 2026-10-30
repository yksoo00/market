package com.company.market.listing.repository;

import java.util.List;
import java.util.Optional;

import com.company.market.listing.domain.Product;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, String> {

	/** 같은 상품 = 이름·제조사·분류번호·제조일이 모두 같음. 분류번호·제조일은 호출하는 쪽이 null 을 "" 로 넘긴다 (null 바인딩 타입 문제 회피) */
	@Query("""
		select p from Product p
		where p.prodName = :name and p.prodBrand = :brand
		  and coalesce(p.prodClassNo, '') = :classNo and coalesce(p.prodMufcDate, '') = :mufcDate
		""")
	Optional<Product> findSame(@Param("name") String name, @Param("brand") String brand, @Param("classNo") String classNo,
			@Param("mufcDate") String mufcDate);

	/**
	 * 상품마스터 생성 잠금 (트랜잭션 끝까지). unique(이름, 제조사)를 없앤 뒤(2026-10-27 설계 PR 2) 같은 네 값의 중복 생성과
	 * 채번(KP-연도-일련번호, 개수 기반) 충돌을 함께 막는다. 생성은 드물어 키 하나로 줄 세운다
	 */
	@Query(value = "select 1 from (select pg_advisory_xact_lock(hashtext('prod-master'))) l", nativeQuery = true)
	Integer lockCreation();

	long countByProdIdStartingWith(String prefix);

	/** pattern 은 호출하는 쪽이 %·_ 를 이스케이프(\)해 만든 LIKE 패턴 — 이름·제조사·상품번호 어디든 부분 일치 */
	@Query("""
		select p from Product p
		where lower(p.prodName) like lower(:pattern) escape '\\'
		   or lower(p.prodBrand) like lower(:pattern) escape '\\'
		   or lower(p.prodNo) like lower(:pattern) escape '\\'
		order by p.prodName, p.prodId
		""")
	List<Product> search(@Param("pattern") String pattern, Pageable pageable);

	/** 상품명만 부분 일치하는 상품ID (거래이력 상품명 검색). pattern 은 search 와 같은 이스케이프 규칙 */
	@Query("""
		select p.prodId from Product p
		where lower(p.prodName) like lower(:pattern) escape '\\'
		order by p.prodId
		""")
	List<String> findIdsByName(@Param("pattern") String pattern, Pageable pageable);

}
