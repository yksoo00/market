// 엑셀 다량 등록 API 타입. 백엔드 BulkRowDto·BulkRowResult·Bulk*Response 와 1:1 (listing/dto)

export type BulkStatus = "MATCHED" | "NEW_MASTER" | "FAILED";

/** 서버가 주고받는 한 줄. 숫자 칸도 글자로 (엑셀 칸이 글자여도 줄 오류로 보이게) */
export interface BulkRowApi {
  rowNo: number;
  prodId: string | null;
  prodName: string | null;
  prodBrand: string | null;
  prodClassNo: string | null;
  prodNo: string | null;
  categoryCode: string | null;
  prodState: string | null;
  salesUnitPrice: string | null;
  salesQuantity: string | null;
  minOrderQuantity: string | null;
  orderUnit: string | null;
  deliveryDate: string | null;
  description: string | null;
}

export interface BulkCandidate {
  prodId: string;
  prodName: string;
  prodBrand: string;
  prodClassNo: string | null;
}

export interface BulkResult {
  rowNo: number;
  status: BulkStatus;
  prodId: string | null;
  matchedName: string | null;
  candidates: BulkCandidate[];
  notices: string[];
  /** 칸 이름(BulkRowApi 의 키) → 사유 */
  fields: Record<string, string>;
}

export interface BulkParseResponse {
  rows: BulkRowApi[];
  results: BulkResult[];
}

export interface BulkCheckResponse {
  results: BulkResult[];
}

export interface BulkCommitResponse {
  created: number;
}
