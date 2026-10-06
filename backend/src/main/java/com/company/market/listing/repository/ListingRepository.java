package com.company.market.listing.repository;

import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import org.springframework.data.jpa.repository.JpaRepository;

// 목록·검색 페이지 조회는 ListingSearchRepository (조건이 동적이라)
public interface ListingRepository extends JpaRepository<Listing, ListingId> {

	/** 이 상품마스터를 쓰는 매물 수 (공유 상품 보호) */
	long countByProdId(String prodId);
}
