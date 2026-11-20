package com.company.market.devtools;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import com.company.market.common.time.KoreanDates;
import com.company.market.trade.service.TradeIdGenerator;
import com.company.market.user.domain.UidGenerator;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * 임시 테이블 행 한 줄을 넣기 전에 서비스가 하던 일을 대신한다 (계획 2026-11-20-dev-table-auto-keys.md).
 * 주 PK 와 시각 칸은 값이 와도 무시하고 서비스 규칙대로 새로 만들고, 그 키를 가리키는 칸은 새 키에 맞춘다.
 * 인스턴스 하나가 한 번의 요청(폼 한 줄 또는 엑셀 한 파일)이고, 엑셀 여러 시트를 넣는 동안 `옛 키 → 새 키` 대응표를 쌓는다.
 * 참조 값은 ① 이 파일에서 만든 대응표 ② DB 에 있는 값 순으로 찾고 둘 다 없으면 한글 오류로 막는다.
 */
final class DevRowPreparer {

	private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

	/** 테이블별로 생성할 때 서버가 채우는 칸 — 생성 폼이 이 칸을 숨긴다 */
	static final Map<String, List<String>> AUTO_ON_CREATE = Map.of(
			"trd_user_info", List.of("uid", "dt_reg", "dt_update"),
			"trd_ctgr_code", List.of("reg_date"),
			"trd_ctgr_master", List.of("reg_date"),
			"trd_prod_master", List.of("prod_id", "reg_date"),
			"trd_prod_reg", List.of("reg_date", "dt_update"),
			"trd_trade_info", List.of("trade_id", "reg_date"),
			"trd_cart_info", List.of("ser_no", "reg_date"));

	private final JdbcTemplate jdbc;

	private final Clock clock;

	private final TradeIdGenerator tradeIds;

	/** true 면 엑셀 가져오기 — 오류 문구에 "같은 파일에도"를 붙인다 */
	private final boolean fileMode;

	private final Map<String, String> users = new LinkedHashMap<>();

	private final Map<String, String> prods = new LinkedHashMap<>();

	/** 키 = 옛 판매자|옛 등록일시|옛 상품, 값 = 새 등록일시 */
	private final Map<String, String> listings = new LinkedHashMap<>();

	/** 키 = 옛 구매자|옛 거래ID, 값 = 새 거래ID */
	private final Map<String, String> trades = new LinkedHashMap<>();

	private final Set<String> usedListingKeys = new HashSet<>();

	/** 판매자 별로 마지막에 준 등록일시 — 다음 행은 그 다음 초부터 찾는다 */
	private final Map<String, LocalDateTime> lastListingReg = new HashMap<>();

	private final List<String> keyLog = new ArrayList<>();

	/** 저장 형식 yyyyMMddHHmmss 의 지금(서버 clock, UTC) */
	static String timestamp(Clock clock) {
		return LocalDateTime.now(clock).format(TIMESTAMP);
	}

	DevRowPreparer(JdbcTemplate jdbc, Clock clock, TradeIdGenerator tradeIds, boolean fileMode) {
		this.jdbc = jdbc;
		this.clock = clock;
		this.tradeIds = tradeIds;
		this.fileMode = fileMode;
	}

	/** 화면에 보여 줄 `옛 키 → 새 키` 목록 (바뀐 것만) */
	List<String> keyLog() {
		return List.copyOf(keyLog);
	}

	/** values: 컬럼 이름 → 파싱된 값 (엑셀·폼에 있던 것). 반환: 실제로 넣을 값 */
	Map<String, Object> prepare(String table, Map<String, Object> values, String where) {
		Map<String, Object> v = new LinkedHashMap<>(values);
		String now = timestamp(clock);
		switch (table) {
			case "trd_user_info" -> {
				String oldUid = text(v.get("uid"));
				String uid = nextUid();
				remember(users, oldUid, uid, "사용자");
				v.put("uid", uid);
				v.put("dt_reg", now);
				v.put("dt_update", now);
			}
			case "trd_ctgr_code", "trd_ctgr_master" -> v.put("reg_date", now);
			case "trd_prod_master" -> {
				String oldProd = text(v.get("prod_id"));
				String prodId = nextProdId();
				remember(prods, oldProd, prodId, "상품마스터");
				v.put("prod_id", prodId);
				v.put("reg_date", now);
			}
			case "trd_prod_reg" -> prepareListing(v, now, where);
			case "trd_trade_info" -> prepareTrade(v, now, where);
			case "trd_cart_info" -> prepareCart(v, now, where);
			case "trd_trade_history" -> prepareHistory(v, where);
			default -> {
			}
		}
		return v;
	}

	// ---- 매물 ----

	private void prepareListing(Map<String, Object> v, String now, String where) {
		String oldUser = text(v.get("user_id"));
		String oldProd = text(v.get("prod_id"));
		String oldReg = text(v.get("reg_date"));
		String user = resolveUser(v, "user_id", where);
		resolveProd(v, "prod_id", where);
		String reg = freeListingReg(user, now);
		if (oldUser != null && oldProd != null && oldReg != null) {
			remember(listings, oldUser + "|" + oldReg + "|" + oldProd, reg, "매물");
		}
		v.put("reg_date", reg);
		v.remove("dt_update");
	}

	/**
	 * 지금 시각, 같은 판매자의 매물이 이 요청 안이나 DB 에 같은 reg_date 로 이미 있으면 1초씩 늦춰 빈 값을 찾는다.
	 * 상품이 달라도 겹치면 안 된다 — 매물 주소·상세·수정은 (판매자, reg_date) 두 값으로 한 건을 찾고(`findByUserIdAndRegDate`),
	 * 직접 등록(`ListingService.create`)·다량 등록도 판매자 단위로 같은 초를 막는다.
	 */
	private String freeListingReg(String user, String now) {
		LocalDateTime at = LocalDateTime.parse(now, TIMESTAMP);
		LocalDateTime last = lastListingReg.get(user);
		if (last != null && !at.isAfter(last)) {
			at = last.plusSeconds(1);
		}
		while (true) {
			String reg = at.format(TIMESTAMP);
			String key = user + "|" + reg;
			Integer taken = user == null ? 0 : jdbc.queryForObject("select count(*) from trd_prod_reg where user_id = ? and reg_date = ?", Integer.class, user, reg);
			if (usedListingKeys.add(key) && (taken == null || taken == 0)) {
				lastListingReg.put(user, at);
				return reg;
			}
			at = at.plusSeconds(1);
		}
	}

	// ---- 거래 ----

	private void prepareTrade(Map<String, Object> v, String now, String where) {
		String oldBuyer = text(v.get("user_id"));
		String oldSeller = text(v.get("seller_id"));
		String oldProd = text(v.get("prod_id"));
		String oldTrade = text(v.get("trade_id"));
		String oldProdReg = text(v.get("prod_reg_date"));
		resolveUser(v, "user_id", where);
		String seller = resolveUser(v, "seller_id", where);
		String prod = resolveProd(v, "prod_id", where);
		resolveListing(v, "prod_reg_date", oldSeller, oldProdReg, oldProd, seller, prod, where);
		String tradeId = tradeIds.next();
		if (oldBuyer != null && oldTrade != null) {
			remember(trades, oldBuyer + "|" + oldTrade, tradeId, "거래");
		}
		v.put("trade_id", tradeId);
		v.put("reg_date", now);
	}

	// ---- 장바구니 ----

	private void prepareCart(Map<String, Object> v, String now, String where) {
		String oldSeller = text(v.get("seller_id"));
		String oldProd = text(v.get("prod_no"));
		String oldProdDate = text(v.get("prod_date"));
		String oldBuyer = text(v.get("user_id"));
		String oldTrade = text(v.get("trade_id"));
		String buyer = resolveUser(v, "user_id", where);
		String seller = resolveUser(v, "seller_id", where);
		String prod = resolveProd(v, "prod_no", where);
		resolveListing(v, "prod_date", oldSeller, oldProdDate, oldProd, seller, prod, where);
		resolveTrade(v, "trade_id", oldBuyer, oldTrade, buyer, where);
		if (buyer != null) {
			jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?))", "ser_no:" + buyer);
		}
		Integer serNo = buyer == null ? Integer.valueOf(1)
				: jdbc.queryForObject("select coalesce(max(ser_no), 0) + 1 from trd_cart_info where user_id = ?", Integer.class, buyer);
		v.put("ser_no", serNo);
		v.put("reg_date", now);
	}

	// ---- 거래이력 ----

	private void prepareHistory(Map<String, Object> v, String where) {
		String oldBuyer = text(v.get("user_id"));
		String oldTrade = text(v.get("trade_id"));
		String buyer = resolveUser(v, "user_id", where);
		resolveUser(v, "seller_id", where);
		resolveProd(v, "prod_id", where);
		resolveTrade(v, "trade_id", oldBuyer, oldTrade, buyer, where);
	}

	// ---- 참조 맞추기 ----

	private String resolveUser(Map<String, Object> v, String column, String where) {
		String old = text(v.get(column));
		if (old == null) {
			return null;
		}
		String resolved = users.get(old);
		if (resolved == null) {
			if (!exists("select count(*) from trd_user_info where uid = ?", old)) {
				throw missing(where, column, old, "사용자");
			}
			resolved = old;
		}
		v.put(column, resolved);
		return resolved;
	}

	private String resolveProd(Map<String, Object> v, String column, String where) {
		String old = text(v.get(column));
		if (old == null) {
			return null;
		}
		String resolved = prods.get(old);
		if (resolved == null) {
			if (!exists("select count(*) from trd_prod_master where prod_id = ?", old)) {
				throw missing(where, column, old, "상품마스터");
			}
			resolved = old;
		}
		v.put(column, resolved);
		return resolved;
	}

	/** 매물을 가리키는 등록일시 칸(거래 prod_reg_date, 장바구니 prod_date) */
	private void resolveListing(Map<String, Object> v, String column, String oldSeller, String oldReg, String oldProd, String seller, String prod,
			String where) {
		if (oldReg == null) {
			return;
		}
		String resolved = oldSeller == null || oldProd == null ? null : listings.get(oldSeller + "|" + oldReg + "|" + oldProd);
		if (resolved == null) {
			if (seller == null || prod == null
					|| !exists("select count(*) from trd_prod_reg where user_id = ? and reg_date = ? and prod_id = ?", seller, oldReg, prod)) {
				throw missing(where, column, oldReg, "매물");
			}
			resolved = oldReg;
		}
		v.put(column, resolved);
	}

	private void resolveTrade(Map<String, Object> v, String column, String oldBuyer, String oldTrade, String buyer, String where) {
		if (oldTrade == null) {
			return;
		}
		String resolved = oldBuyer == null ? null : trades.get(oldBuyer + "|" + oldTrade);
		if (resolved == null) {
			if (buyer == null || !exists("select count(*) from trd_trade_info where user_id = ? and trade_id = ?", buyer, oldTrade)) {
				throw missing(where, column, oldTrade, "거래");
			}
			resolved = oldTrade;
		}
		v.put(column, resolved);
	}

	private boolean exists(String sql, Object... args) {
		Integer n = jdbc.queryForObject(sql, Integer.class, args);
		return n != null && n > 0;
	}

	private ApiException missing(String where, String column, String value, String parent) {
		String scope = fileMode ? "같은 파일에도 DB에도" : "DB에";
		return new ApiException(ErrorCode.BAD_REQUEST, where + column + " '" + value + "' 에 해당하는 " + parent + "이(가) " + scope + " 없습니다.");
	}

	private void remember(Map<String, String> map, String old, String fresh, String label) {
		if (old == null) {
			return;
		}
		map.put(old, fresh);
		if (!old.equals(fresh)) {
			keyLog.add(label + " " + old + " → " + fresh);
		}
	}

	// ---- 번호 만들기 ----

	/** UidGenerator 와 같은 규칙. 같은 날 동시 생성은 날짜 advisory lock 으로 줄 세운다 */
	private String nextUid() {
		String day = UidGenerator.todayPrefix();
		jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?))", "uid:" + day);
		String max = jdbc.queryForObject("select max(uid) from trd_user_info where uid like ?", String.class, day + "%");
		return UidGenerator.next(day, max);
	}

	/** 상품 서비스와 같은 규칙: KP-한국 연도-6자리, 개수 + 1 (이미 있으면 빈 번호까지 올린다) */
	private String nextProdId() {
		String prefix = "KP-" + KoreanDates.today(clock).getYear() + "-";
		jdbc.queryForList("select pg_advisory_xact_lock(hashtext(?))", "prod_id:" + prefix);
		Long count = jdbc.queryForObject("select count(*) from trd_prod_master where prod_id like ?", Long.class, prefix + "%");
		long sequence = (count == null ? 0 : count) + 1;
		while (exists("select count(*) from trd_prod_master where prod_id = ?", prefix + "%06d".formatted(sequence))) {
			sequence++;
		}
		return prefix + "%06d".formatted(sequence);
	}

	private static String text(Object value) {
		return value == null ? null : value.toString();
	}

}
