package com.company.market.listing.repository;

import java.util.Optional;

import com.company.market.listing.domain.Product;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, String> {

	Optional<Product> findByProdNameAndProdBrand(String prodName, String prodBrand);

	long countByProdIdStartingWith(String prefix);

}
