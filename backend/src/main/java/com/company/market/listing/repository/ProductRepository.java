package com.company.market.listing.repository;

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
