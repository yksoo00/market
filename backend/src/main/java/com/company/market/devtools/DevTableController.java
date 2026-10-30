package com.company.market.devtools;

import java.util.List;
import java.util.Map;

import com.company.market.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 로컬 전용 임시 테이블 관리 (계획 2026-10-30-dev-table-admin.md). APP_ENV=local 이 아니면 이 빈이 없어 404.
 * SecurityConfig 가 /api/v1/dev/** 를 로그인 없이 열어 두므로 운영 .env 에 APP_ENV=local 을 넣으면 안 된다.
 */
@RestController
@RequestMapping("/api/v1/dev")
@ConditionalOnProperty(name = "app.env", havingValue = "local")
@RequiredArgsConstructor
public class DevTableController {

	private final DevTableService service;

	@GetMapping("/tables")
	public ApiResponse<Map<String, Object>> tables() {
		return ApiResponse.of(Map.of("tables", service.tables()));
	}

	@GetMapping("/tables/{table}/rows")
	public ApiResponse<Map<String, Object>> rows(@PathVariable String table, @RequestParam(defaultValue = "100") int limit,
			@RequestParam(defaultValue = "0") int offset) {
		return ApiResponse.of(service.rows(table, limit, offset));
	}

	@PostMapping("/tables/{table}/rows")
	public ApiResponse<Map<String, Object>> insert(@PathVariable String table, @RequestBody Map<String, Object> body) {
		service.insert(table, body);
		return ApiResponse.of(Map.of("inserted", 1));
	}

	public record UpdateRequest(Map<String, Object> key, Map<String, Object> values) {
	}

	@PutMapping("/tables/{table}/rows")
	public ApiResponse<Map<String, Object>> update(@PathVariable String table, @RequestBody UpdateRequest req) {
		service.update(table, req.key(), req.values());
		return ApiResponse.of(Map.of("updated", 1));
	}

	@DeleteMapping("/tables/{table}/rows")
	public ApiResponse<Map<String, Object>> delete(@PathVariable String table, @RequestBody Map<String, Object> key) {
		service.delete(table, key);
		return ApiResponse.of(Map.of("deleted", 1));
	}

	@PostMapping("/tables/{table}/import")
	public ApiResponse<Map<String, List<DevTableService.ImportResult>>> importTable(@PathVariable String table,
			@RequestParam("file") MultipartFile file) {
		return ApiResponse.of(Map.of("results", service.importTable(table, file)));
	}

	@PostMapping("/import")
	public ApiResponse<Map<String, List<DevTableService.ImportResult>>> importAll(@RequestParam("file") MultipartFile file) {
		return ApiResponse.of(Map.of("results", service.importAll(file)));
	}

}
