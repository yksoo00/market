package com.company.market.listing.repository;

import java.util.List;

import com.company.market.listing.domain.Listing;
import com.company.market.listing.domain.ListingId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ListingRepository extends JpaRepository<Listing, ListingId> {

	List<Listing> findTop21ByRegDateLessThanOrderByRegDateDesc(String cursor);

	List<Listing> findTop21ByOrderByRegDateDesc();

}
