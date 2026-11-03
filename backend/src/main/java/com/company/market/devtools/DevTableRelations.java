package com.company.market.devtools;

import java.util.List;
import java.util.Map;

/**
 * 임시 테이블의 의미상 관계 (정의서의 FOREIGN KEY 표). DB 외래키는 2026-10-27 에 없앴으므로 부모 행을 지워도 자식 행이 남는다 —
 * 임시 화면의 [삭제]가 부모 → 자식 방향으로 같이 지우려고 이 표를 쓴다. 자식 → 부모 방향은 지우지 않는다.
 * 조건 식은 고정 문자열이고 값은 전부 바인드한다 (parentColumns = ? 자리에 들어갈 부모 행의 컬럼, 순서대로).
 */
final class DevTableRelations {

	/** 부모 행에서 자식 행을 찾는 규칙 한 줄 */
	record Rule(String child, String condition, List<String> parentColumns) {
	}

	static final Map<String, List<Rule>> BY_PARENT = Map.of(
			// 사용자(uid): 내 매물, 내가 사거나 판 거래, 내 장바구니·비교, 내 거래이력
			"trd_user_info", List.of(
					new Rule("trd_prod_reg", "user_id = ?", List.of("uid")),
					new Rule("trd_trade_info", "user_id = ? or seller_id = ?", List.of("uid", "uid")),
					new Rule("trd_cart_info", "user_id = ? or seller_id = ?", List.of("uid", "uid")),
					new Rule("trd_trade_history", "user_id = ? or seller_id = ?", List.of("uid", "uid"))),
			// 상품마스터(prod_id): 그 상품의 매물·거래·장바구니(prod_no)·거래이력
			"trd_prod_master", List.of(
					new Rule("trd_prod_reg", "prod_id = ?", List.of("prod_id")),
					new Rule("trd_trade_info", "prod_id = ?", List.of("prod_id")),
					new Rule("trd_cart_info", "prod_no = ?", List.of("prod_id")),
					new Rule("trd_trade_history", "prod_id = ?", List.of("prod_id"))),
			// 매물(판매자·등록일시·상품): 그 매물의 거래, 장바구니·비교. 거래이력은 거래를 지울 때 같이 지운다
			"trd_prod_reg", List.of(
					new Rule("trd_trade_info", "seller_id = ? and prod_reg_date = ? and prod_id = ?", List.of("user_id", "reg_date", "prod_id")),
					new Rule("trd_cart_info", "seller_id = ? and prod_date = ? and prod_no = ?", List.of("user_id", "reg_date", "prod_id"))),
			// 거래(구매자·거래ID): 그 거래의 장바구니·비교 정보와 거래이력
			"trd_trade_info", List.of(
					new Rule("trd_cart_info", "user_id = ? and trade_id = ?", List.of("user_id", "trade_id")),
					new Rule("trd_trade_history", "user_id = ? and trade_id = ?", List.of("user_id", "trade_id"))),
			// 카테고리(코드 조각): 아래 단계 카테고리와 그 카테고리의 상품
			"trd_ctgr_master", List.of(
					new Rule("trd_ctgr_master", "parent_code = ?", List.of("category_code")),
					new Rule("trd_prod_master", "major_category = ? or middle_category = ? or minor_category = ?",
							List.of("category_code", "category_code", "category_code"))));

	private DevTableRelations() {
	}

}
