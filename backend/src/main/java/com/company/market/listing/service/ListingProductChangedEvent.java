package com.company.market.listing.service;

import java.util.UUID;

/**
 * 매물 수정으로 상품(prod_id, PK 의 일부)이 바뀌었다. 같은 트랜잭션 안에서 동기로 들린다 — 거래 도메인이 그 매물을
 * 가리키는 거래 행의 prod_id 를 맞춰 (seller_id, prod_reg_date, prod_id) 로 계속 찾게 한다
 */
public record ListingProductChangedEvent(UUID sellerId, String regDate, String oldProdId, String newProdId) {
}
