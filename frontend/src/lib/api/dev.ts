import { api, post, upload } from "@/lib/api/client";
import type { ApiResult } from "@/types/api";
import type { DevCell, DevImportResult, DevRow, DevRows, DevTable } from "@/types/dev";

// 로컬 전용 임시 테이블 관리 (APP_ENV=local 백엔드에서만 응답). 계획 2026-10-30-dev-table-admin.md
const BASE = "/api/v1/dev";

export function fetchDevTables(): Promise<ApiResult<{ tables: DevTable[] }>> {
  return api(`${BASE}/tables`);
}

export function fetchDevRows(table: string, limit: number, offset: number): Promise<ApiResult<DevRows>> {
  return api(`${BASE}/tables/${table}/rows?limit=${limit}&offset=${offset}`);
}

export function createDevRow(table: string, values: Record<string, DevCell>): Promise<ApiResult<{ inserted: number }>> {
  return post(`${BASE}/tables/${table}/rows`, values);
}

export function updateDevRow(
  table: string,
  key: Record<string, DevCell>,
  values: Record<string, DevCell>,
): Promise<ApiResult<{ updated: number }>> {
  return api(`${BASE}/tables/${table}/rows`, { method: "PUT", body: JSON.stringify({ key, values }) });
}

/** [삭제] 전 미리보기 — 이 행과 같이 지워질 다른 테이블의 행 수 (테이블별, 없으면 빈 객체) */
export function fetchRelatedDevRows(table: string, key: DevRow): Promise<ApiResult<{ related: Record<string, number> }>> {
  return post(`${BASE}/tables/${table}/rows/related`, key);
}

/** 이 행과 딸린 다른 테이블의 행을 같이 지운다. tables = 테이블별로 지운 행 수 */
export function deleteDevRow(table: string, key: DevRow): Promise<ApiResult<{ deleted: number; tables: Record<string, number> }>> {
  return api(`${BASE}/tables/${table}/rows`, { method: "DELETE", body: JSON.stringify(key) });
}

function fileForm(file: File): FormData {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export function importDevTable(table: string, file: File): Promise<ApiResult<{ results: DevImportResult[] }>> {
  return upload(`${BASE}/tables/${table}/import`, fileForm(file));
}

export function importDevAll(file: File): Promise<ApiResult<{ results: DevImportResult[] }>> {
  return upload(`${BASE}/import`, fileForm(file));
}
