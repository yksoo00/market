// 로컬 전용 임시 테이블 관리 API 응답 (backend devtools 패키지와 1:1)
export interface DevColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface DevTable {
  name: string;
  columns: DevColumn[];
  primaryKey: string[];
}

export type DevCell = string | number | boolean | null;
export type DevRow = Record<string, DevCell>;

export interface DevRows {
  rows: DevRow[];
  total: number;
  limit: number;
  offset: number;
}

export interface DevImportResult {
  table: string;
  inserted: number;
}
