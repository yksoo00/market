package com.company.market.devtools;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.company.market.common.exception.ApiException;
import com.company.market.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 로컬 전용 임시 테이블 관리 (계획 2026-10-30-dev-table-admin.md). 서비스 로직·검증을 거치지 않고 테이블에 바로
 * 읽고 쓴다 — 테스트 데이터 대량 입력용이라 운영에서는 빈 자체가 없어야 한다(APP_ENV=local 에서만 생성).
 * 테이블·컬럼 이름은 화이트리스트 + information_schema 에 있는 값만 SQL 식별자로 쓰고, 값은 전부 바인드한다.
 */
@Service
@ConditionalOnProperty(name = "app.env", havingValue = "local")
@RequiredArgsConstructor
public class DevTableService {

	/** 정의서 테이블 8개. flyway_schema_history 같은 건 다루지 않는다 */
	static final List<String> TABLES = List.of("trd_user_info", "trd_ctgr_code", "trd_ctgr_master", "trd_prod_master",
			"trd_prod_reg", "trd_trade_info", "trd_cart_info", "trd_trade_history");

	static final int MAX_LIMIT = 1000;

	static final int MAX_SHEET_ROWS = 50_000;

	/** 조회 응답에서 가리는 컬럼. 수정에서 이 값 그대로 돌아오면 안 바꾼 것으로 본다 */
	static final String MASK_COLUMN = "password";

	static final String MASK = "***";

	private final JdbcTemplate jdbc;

	public record ColumnInfo(String name, String type, boolean nullable) {
	}

	public record TableInfo(String name, List<ColumnInfo> columns, List<String> primaryKey) {
	}

	public record ImportResult(String table, int inserted) {
	}

	public List<TableInfo> tables() {
		return load(TABLES);
	}

	public Map<String, Object> rows(String tableName, int limit, int offset) {
		TableInfo t = table(tableName);
		int lim = Math.max(1, Math.min(limit, MAX_LIMIT));
		int off = Math.max(0, offset);
		String order = t.primaryKey().isEmpty() ? "1" : t.primaryKey().stream().map(DevTableService::quote).collect(Collectors.joining(", "));
		List<Map<String, Object>> rows = new ArrayList<>();
		for (Map<String, Object> raw : jdbc.queryForList("select * from " + quote(t.name()) + " order by " + order + " limit ? offset ?", lim, off)) {
			Map<String, Object> row = new LinkedHashMap<>();
			raw.forEach((k, v) -> row.put(k, MASK_COLUMN.equals(k) && v != null ? MASK : v instanceof UUID ? v.toString() : v));
			rows.add(row);
		}
		Long total = jdbc.queryForObject("select count(*) from " + quote(t.name()), Long.class);
		return Map.of("rows", rows, "total", total == null ? 0 : total, "limit", lim, "offset", off);
	}

	public void insert(String tableName, Map<String, Object> body) {
		TableInfo t = table(tableName);
		Map<String, Object> values = convert(t, body, "");
		if (values.isEmpty()) {
			throw bad("넣을 값이 없습니다.");
		}
		exec(insertSql(t, new ArrayList<>(values.keySet())), new ArrayList<>(values.values()), "");
	}

	public void update(String tableName, Map<String, Object> key, Map<String, Object> values) {
		TableInfo t = table(tableName);
		Map<String, Object> keyValues = convert(t, key, "key ");
		if (!keyValues.keySet().equals(new LinkedHashSet<>(t.primaryKey()))) {
			throw bad("key 는 PK 컬럼 전부여야 합니다: " + String.join(", ", t.primaryKey()));
		}
		Map<String, Object> raw = new LinkedHashMap<>(values == null ? Map.of() : values);
		// 조회 화면이 가린 값(***)을 그대로 돌려보내도 실제 값을 덮어쓰지 않는다
		raw.entrySet().removeIf(e -> MASK_COLUMN.equalsIgnoreCase(e.getKey()) && MASK.equals(e.getValue()));
		Map<String, Object> set = convert(t, raw, "");
		if (set.isEmpty()) {
			throw bad("바꿀 값이 없습니다.");
		}
		List<Object> args = new ArrayList<>(set.values());
		args.addAll(keyValues.values());
		String sql = "update " + quote(t.name()) + " set " + set.keySet().stream().map(c -> quote(c) + " = ?").collect(Collectors.joining(", "))
				+ " where " + keyValues.keySet().stream().map(c -> quote(c) + " = ?").collect(Collectors.joining(" and "));
		if (exec(sql, args, "") == 0) {
			throw new ApiException(ErrorCode.NOT_FOUND, "해당 행이 없습니다.");
		}
	}

	public void delete(String tableName, Map<String, Object> key) {
		TableInfo t = table(tableName);
		Map<String, Object> keyValues = convert(t, key, "key ");
		if (!keyValues.keySet().equals(new LinkedHashSet<>(t.primaryKey()))) {
			throw bad("PK 컬럼 전부를 보내야 합니다: " + String.join(", ", t.primaryKey()));
		}
		String sql = "delete from " + quote(t.name()) + " where " + keyValues.keySet().stream().map(c -> quote(c) + " = ?").collect(Collectors.joining(" and "));
		if (exec(sql, new ArrayList<>(keyValues.values()), "") == 0) {
			throw new ApiException(ErrorCode.NOT_FOUND, "해당 행이 없습니다.");
		}
	}

	/** 첫 시트 한 장을 이 테이블에. 한 행이라도 실패하면 전부 되돌린다 */
	@Transactional
	public List<ImportResult> importTable(String tableName, MultipartFile file) {
		TableInfo t = table(tableName);
		try (XSSFWorkbook wb = open(file)) {
			if (wb.getNumberOfSheets() == 0) {
				throw bad("시트가 없습니다.");
			}
			return List.of(importSheet(t, wb.getSheetAt(0)));
		}
		catch (IOException e) {
			throw bad("엑셀 파일을 닫는 중 오류가 났습니다.");
		}
	}

	/** 시트 이름 = 테이블 이름. 화이트리스트 밖 시트가 하나라도 있으면 아무것도 넣지 않는다 */
	@Transactional
	public List<ImportResult> importAll(MultipartFile file) {
		Map<String, TableInfo> byName = load(TABLES).stream().collect(Collectors.toMap(TableInfo::name, x -> x));
		try (XSSFWorkbook wb = open(file)) {
			List<Sheet> sheets = new ArrayList<>();
			for (Sheet sh : wb) {
				if (!byName.containsKey(sh.getSheetName().toLowerCase(Locale.ROOT))) {
					throw bad("시트 이름이 테이블이 아닙니다: " + sh.getSheetName());
				}
				sheets.add(sh);
			}
			if (sheets.isEmpty()) {
				throw bad("시트가 없습니다.");
			}
			List<ImportResult> results = new ArrayList<>();
			for (Sheet sh : sheets) {
				results.add(importSheet(byName.get(sh.getSheetName().toLowerCase(Locale.ROOT)), sh));
			}
			return results;
		}
		catch (IOException e) {
			throw bad("엑셀 파일을 닫는 중 오류가 났습니다.");
		}
	}

	private ImportResult importSheet(TableInfo t, Sheet sheet) {
		String sheetName = sheet.getSheetName();
		Row header = sheet.getRow(0);
		if (header == null) {
			throw bad("시트 " + sheetName + ": 1행(컬럼 이름)이 없습니다.");
		}
		if (sheet.getLastRowNum() > MAX_SHEET_ROWS) {
			throw bad("시트 " + sheetName + ": " + MAX_SHEET_ROWS + "행을 넘습니다.");
		}
		Map<String, ColumnInfo> known = t.columns().stream().collect(Collectors.toMap(ColumnInfo::name, c -> c));
		Map<Integer, ColumnInfo> byIndex = new LinkedHashMap<>();
		for (int c = 0; c < header.getLastCellNum(); c++) {
			String h = cellText(header.getCell(c));
			if (h == null) {
				continue;
			}
			ColumnInfo col = known.get(h.trim().toLowerCase(Locale.ROOT));
			if (col == null) {
				throw bad("시트 " + sheetName + ": 모르는 컬럼 " + h);
			}
			if (byIndex.containsValue(col)) {
				throw bad("시트 " + sheetName + ": 컬럼이 두 번 나옵니다 " + col.name());
			}
			byIndex.put(c, col);
		}
		if (byIndex.isEmpty()) {
			throw bad("시트 " + sheetName + ": 컬럼 이름이 없습니다.");
		}
		String sql = insertSql(t, byIndex.values().stream().map(ColumnInfo::name).toList());
		int inserted = 0;
		for (int r = 1; r <= sheet.getLastRowNum(); r++) {
			Row row = sheet.getRow(r);
			if (row == null) {
				continue;
			}
			String where = "시트 " + sheetName + ", " + (r + 1) + "행: ";
			List<Object> args = new ArrayList<>();
			boolean any = false;
			for (Map.Entry<Integer, ColumnInfo> e : byIndex.entrySet()) {
				String text = cellText(row.getCell(e.getKey()));
				any |= text != null;
				args.add(parse(e.getValue(), text, where));
			}
			if (!any) {
				continue;
			}
			exec(sql, args, where);
			inserted++;
		}
		return new ImportResult(t.name(), inserted);
	}

	private XSSFWorkbook open(MultipartFile file) {
		if (file == null || file.isEmpty()) {
			throw bad("파일이 비어 있습니다.");
		}
		try (InputStream in = file.getInputStream()) {
			return new XSSFWorkbook(in);
		}
		catch (Exception e) {
			throw bad("엑셀(.xlsx) 파일을 읽을 수 없습니다.");
		}
	}

	/** 셀을 문자열로. 숫자는 지수 표기 없이 (20261030000000 → "20261030000000"), 빈 셀·빈 문자열은 null */
	private static String cellText(Cell cell) {
		if (cell == null) {
			return null;
		}
		CellType type = cell.getCellType() == CellType.FORMULA ? cell.getCachedFormulaResultType() : cell.getCellType();
		String text = switch (type) {
			case STRING -> cell.getStringCellValue();
			case NUMERIC -> BigDecimal.valueOf(cell.getNumericCellValue()).stripTrailingZeros().toPlainString();
			case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
			default -> null;
		};
		return text == null || text.isBlank() ? null : text;
	}

	/** 요청 바디의 {컬럼: 값}을 컬럼 이름 확인 + 타입 변환. 모르는 컬럼은 400 */
	private Map<String, Object> convert(TableInfo t, Map<String, Object> body, String label) {
		Map<String, ColumnInfo> known = t.columns().stream().collect(Collectors.toMap(ColumnInfo::name, c -> c));
		Map<String, Object> out = new LinkedHashMap<>();
		if (body == null) {
			return out;
		}
		for (Map.Entry<String, Object> e : body.entrySet()) {
			ColumnInfo col = known.get(e.getKey().toLowerCase(Locale.ROOT));
			if (col == null) {
				throw bad(label + "모르는 컬럼: " + e.getKey());
			}
			out.put(col.name(), parse(col, e.getValue() == null ? null : e.getValue().toString(), label));
		}
		return out;
	}

	/** 컬럼 타입에 맞는 Java 값. 숫자·uuid·불리언 컬럼의 빈 문자열은 null */
	private static Object parse(ColumnInfo col, String text, String where) {
		if (text == null) {
			return null;
		}
		boolean textual = col.type().equals("character varying") || col.type().equals("character") || col.type().equals("text");
		if (textual) {
			return text;
		}
		if (text.isBlank()) {
			return null;
		}
		try {
			return switch (col.type()) {
				case "uuid" -> UUID.fromString(text.trim());
				case "integer", "smallint" -> new BigDecimal(text.trim()).intValueExact();
				case "bigint" -> new BigDecimal(text.trim()).longValueExact();
				case "numeric" -> new BigDecimal(text.trim());
				case "boolean" -> Boolean.valueOf(text.trim());
				default -> text;
			};
		}
		catch (IllegalArgumentException | ArithmeticException e) {
			throw bad(where + col.name() + " 값 형식이 맞지 않습니다(" + col.type() + "): " + text);
		}
	}

	private static String insertSql(TableInfo t, List<String> columns) {
		return "insert into " + quote(t.name()) + " (" + columns.stream().map(DevTableService::quote).collect(Collectors.joining(", "))
				+ ") values (" + columns.stream().map(c -> "?").collect(Collectors.joining(", ")) + ")";
	}

	/** 제약 위반 같은 DB 오류는 사유를 그대로 보여 준다(테스트용) */
	private int exec(String sql, List<Object> args, String where) {
		try {
			return jdbc.update(sql, args.toArray());
		}
		catch (DataAccessException e) {
			String reason = e.getMostSpecificCause().getMessage();
			throw bad(where + (reason == null ? "DB 오류" : reason.length() > 300 ? reason.substring(0, 300) : reason));
		}
	}

	private TableInfo table(String name) {
		if (name == null || !TABLES.contains(name)) {
			throw new ApiException(ErrorCode.NOT_FOUND, "다루지 않는 테이블입니다.");
		}
		return load(List.of(name)).get(0);
	}

	private List<TableInfo> load(List<String> names) {
		String in = names.stream().map(n -> "?").collect(Collectors.joining(", "));
		Map<String, List<ColumnInfo>> columns = new LinkedHashMap<>();
		jdbc.query("select table_name, column_name, data_type, is_nullable from information_schema.columns "
				+ "where table_schema = current_schema() and table_name in (" + in + ") order by table_name, ordinal_position", rs -> {
					columns.computeIfAbsent(rs.getString(1), k -> new ArrayList<>())
						.add(new ColumnInfo(rs.getString(2), rs.getString(3), "YES".equals(rs.getString(4))));
				}, names.toArray());
		Map<String, List<String>> keys = new LinkedHashMap<>();
		jdbc.query("select tc.table_name, kcu.column_name from information_schema.table_constraints tc "
				+ "join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema "
				+ "where tc.constraint_type = 'PRIMARY KEY' and tc.table_schema = current_schema() and tc.table_name in (" + in + ") "
				+ "order by tc.table_name, kcu.ordinal_position", rs -> {
					keys.computeIfAbsent(rs.getString(1), k -> new ArrayList<>()).add(rs.getString(2));
				}, names.toArray());
		List<TableInfo> out = new ArrayList<>();
		for (String n : names) {
			out.add(new TableInfo(n, columns.getOrDefault(n, List.of()), keys.getOrDefault(n, List.of())));
		}
		return out;
	}

	private static String quote(String identifier) {
		return "\"" + identifier + "\"";
	}

	private static ApiException bad(String message) {
		return new ApiException(ErrorCode.BAD_REQUEST, message);
	}

}
