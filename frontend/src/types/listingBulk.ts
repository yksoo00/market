// 엑셀 다량 등록 API 타입. 백엔드 BulkRowDto·BulkRowResult·Bulk*Response 와 1:1 (listing/dto)

export type BulkStatus = "MATCHED" | "NEW_MASTER" | "FAILED";

/** 줄의 첨부 한 칸 (사진·데이터시트). name 은 엑셀에 적은 파일명, key 는 서버가 ZIP 에서 꺼내 저장한 업로드 키, problem 은 그 칸의 문제(서버가 준 문구) */
export interface BulkFileApi {
  name: string | null;
  key: string | null;
  problem: string | null;
}

/** 줄의 첨부 칸 이름 (백엔드 BulkRowDto.FILE_FIELDS 와 같은 순서) */
export const BULK_FILE_SLOTS = ["photo1", "photo2", "photo3", "photo4", "dataSheet"] as const;
export type BulkFileSlot = (typeof BULK_FILE_SLOTS)[number];

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
  /** ZIP 첨부 (계획 2026-11-18-bulk-listing-zip.md). 보관해 둔 옛 줄에는 없다 */
  photo1?: BulkFileApi | null;
  photo2?: BulkFileApi | null;
  photo3?: BulkFileApi | null;
  photo4?: BulkFileApi | null;
  dataSheet?: BulkFileApi | null;
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
