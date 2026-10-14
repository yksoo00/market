package com.company.market.listing.repository;

import com.company.market.listing.domain.Category;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, String> {

	List<Category> findByIsDisplayOrderByCategoryCode(String isDisplay);

}
