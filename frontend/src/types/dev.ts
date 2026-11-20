// 로컬 전용 임시 테이블 관리 API 응답 (backend devtools 패키지와 1:1)
export interface DevColumn {
  name: string;
  type: string;
  nullable: boolean;
  /** DB 기본값이 있어 생성 때 비워 두면 그 값이 들어간다 */
  hasDefault: boolean;
}

export interface DevTable {
  name: string;
  columns: DevColumn[];
  primaryKey: string[];
  /** 생성할 때 서버가 채우는 칸 — 생성 폼이 숨긴다 (backend DevRowPreparer) */
  autoColumns: string[];
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
  /** 서버가 새로 만든 키 중 엑셀의 옛 값과 달라진 것 ("사용자 옛 → 새") */
  keys: string[];
}
