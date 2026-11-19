package com.company.market.devtools;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * 임시 테이블 엑셀 불러오기의 한글 별명 (계획 2026-11-04-dev-table-korean-alias.md). 정의서(KPIT-BRK-테이블정의서.xlsx,
 * 2026-10-27 판)의 "논리명"을 글자 그대로 — 오타(시용자ID, 개업년원일, 일렬번호)도 그대로 — 쓰고, 불러올 때 현재 DB 물리명으로
 * 바꿔 준다. DB 이름은 바꾸지 않는다. 모든 DB 컬럼에 별명이 있다(DevTableAliasTest). 제조일(prod_mufc_date·mufc_date)은 2026-11-04 에 DB 에서 지웠다.
 * 정의서가 바뀌면 이 표도 같이 고친다.
 */
final class DevTableAliases {

	/** 물리 테이블 이름 → 정의서 테이블명 (논리) */
	static final Map<String, String> TABLES = Map.of(
			"trd_user_info", "사용자 정보",
			"trd_ctgr_code", "카테고리 코드",
			"trd_ctgr_master", "카테고리 마스터",
			"trd_prod_master", "상품 마스터",
			"trd_prod_reg", "상품등록 정보",
			"trd_trade_info", "거래 정보",
			"trd_cart_info", "바구니 정보",
			"trd_trade_history", "거래이력 정보");

	/** 물리 테이블 → (현재 DB 컬럼 이름 → 정의서 컬럼명 (논리)). 정의서가 물리명을 REG_DATE 로 겹쳐 적은 칸도 DB 이름 기준 */
	static final Map<String, Map<String, String>> COLUMNS = Map.of(
			"trd_user_info", cols(
					"uid", "사용자식별자", "user_id", "시용자ID", "password", "비밀번호", "user_class", "사용자 구분", "user_name", "사용자 명",
					"user_phone", "휴대폰 번호", "user_email", "이메일", "user_address", "주소", "contact_method", "연락수단",
					"user_nickname", "별칭", "nickname_usage", "별칭사용여부", "bus_reg_id", "사업자등록번호", "company_type", "기업구분",
					"company_name", "회사명", "company_open_date", "개업년원일", "company_tel", "회사전화번호", "company_address", "회사주소",
					"dt_reg", "등록 일시", "dt_update", "최종갱신일시", "dt_expire", "사용만료일시", "spare_col", "예비컬럼"),
			"trd_ctgr_code", cols(
					"category_code", "카테고리코드", "category_name", "카테고리명", "category_depth", "카테고리구분", "category_class", "분류레벨",
					"parent_code", "부모 카테고리", "is_display", "메뉴노출 여부", "sort_order", "메뉴 정렬 순서", "reg_date", "등록일시",
					"spare_col", "예비컬럼"),
			"trd_ctgr_master", cols(
					"category_code", "카테고리코드", "category_name", "카테고리명", "category_depth", "분류레벨", "parent_code", "부모 카테고리",
					"is_display", "메뉴노출 여부", "sort_order", "메뉴 정렬 순서", "reg_date", "등록일시", "spare_col", "예비컬럼"),
			"trd_prod_master", cols(
					"prod_id", "상품고유ID", "prod_name", "상품명", "prod_part_no", "파트넘버", "prod_brand", "제조사", "prod_class_no", "물품분류번호",
					"major_category", "대분류", "middle_category", "중분류", "minor_category", "소분류", "prod_spec_info", "사양정보",
					"prod_useful_life", "보증년수", "warranty_method", "정품보증방법", "alter_prod_name", "대체상품명",
					"prod_data_sheet", "DATA SHEET", "prod_image", "상품이미지", "reg_date", "등록일시", "spare_col", "예비컬럼"),
			"trd_prod_reg", cols(
					"user_id", "사용자ID", "reg_date", "등록일시", "prod_id", "상품고유ID", "trade_type", "거래종류", "prod_state", "상품상태",
					"sales_unit_price", "등록단가", "sales_quantity", "등록수량", "min_order_quantity", "최소주문량", "order_unit", "주문단위",
					"prov_date", "제공가능일", "stock_quantity", "재고수량", "prod_description", "상품설명", "prod_data_sheet", "DATA SHEET",
					"prod_photo_1", "상품사진1", "prod_photo_2", "상품사진2", "prod_photo_3", "상품사진3", "prod_image_4", "사진4",
					"warranty_period", "보증기한", "warranty_coverage", "불량지원방법", "replace_prod", "대체품", "test_report", "테스트리포트",
					"certificate_of_authenticity", "정품인증서", "dt_update", "최종갱신일시", "dt_expire", "거래완료일시", "spare_col", "예비컬럼"),
			"trd_trade_info", cols(
					"user_id", "사용자ID", "trade_id", "거래ID", "trade_type", "거래종류", "seller_id", "판매자ID", "prod_reg_date", "상품등록일시",
					"prod_id", "상품고유ID", "prod_state", "상품상태", "sales_unit_price", "등록단가", "stock_quantity", "재고수량",
					"min_order_quantity", "최소주문량", "order_unit", "주문단위", "prov_date", "제공가능일", "order_unit_price", "주문단가",
					"order_quantity", "주문량", "req_deli_date", "납품희망일", "remarks", "요청사항", "trade_stats", "거래상태",
					"reg_date", "등록일시", "spare_col", "예비컬럼"),
			"trd_cart_info", cols(
					"user_id", "사용자ID", "trade_id", "거래ID", "ser_no", "일렬번호", "cart_type", "바구니 구분", "seller_id", "판매자ID",
					"prod_date", "상품등록일시", "prod_name", "상품명", "prod_no", "상품번호", "manufacturer", "제조사",
					"prod_spec_info", "사양정보", "prod_state", "상품상태", "prov_date", "제공가능일", "order_unit_price", "주문단가",
					"order_quantity", "주문량", "req_deli_date", "납품희망일", "remarks", "요청사항", "reg_date", "등록일시"),
			"trd_trade_history", cols(
					"user_id", "사용자ID", "trade_id", "거래ID", "trade_date", "확정일시", "prod_id", "상품ID", "trade_type", "거래종류",
					"seller_id", "판매자ID", "trade_unit_price", "거래단가", "trade_quantity", "거래량", "trade_amount", "거래금액",
					"spare_col", "예비컬럼"));

	private DevTableAliases() {
	}

	/** 시트 이름(물리명 또는 논리명) → 물리 테이블 이름. 모르면 빈 값 */
	static Optional<String> table(String name) {
		String key = normalize(name);
		return TABLES.entrySet().stream()
				.filter(e -> normalize(e.getKey()).equals(key) || normalize(e.getValue()).equals(key))
				.map(Map.Entry::getKey).findFirst();
	}

	/**
	 * 헤더 이름(물리명 또는 논리명) → 그 테이블의 물리 컬럼 이름. 별명에 없으면 이름을 정리한 그대로 돌려준다 — 물리명을
	 * 그대로 쓴 헤더를 받으려는 것이라, 실제 있는 컬럼인지는 호출한 쪽이 확인한다
	 */
	static String column(String table, String name) {
		String key = normalize(name);
		return COLUMNS.getOrDefault(table, Map.of()).entrySet().stream()
				.filter(e -> normalize(e.getKey()).equals(key) || normalize(e.getValue()).equals(key))
				.map(Map.Entry::getKey).findFirst().orElse(key);
	}

	/** 공백(줄바꿈·NBSP 포함)을 모두 없애고 소문자로 ("등록 일시" = "등록일시", "DATA SHEET" = "data sheet") */
	static String normalize(String s) {
		return s.replaceAll("[\\s\\p{Z}]+", "").toLowerCase(Locale.ROOT);
	}

	private static Map<String, String> cols(String... pairs) {
		if (pairs.length % 2 != 0) {
			throw new IllegalArgumentException("별명표는 (컬럼, 논리명) 쌍이어야 합니다");
		}
		Map<String, String> m = new LinkedHashMap<>();
		for (int i = 0; i < pairs.length; i += 2) {
			m.put(pairs[i], pairs[i + 1]);
		}
		return m;
	}

}
