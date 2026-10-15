package com.company.market.listing.repository;

import java.util.List;
import java.util.Optional;

import com.company.market.listing.domain.Product;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, String> {

	Optional<Product> findByProdNameAndProdBrand(String prodName, String prodBrand);

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
