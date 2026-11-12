// 엑셀 대량구매 API 타입. 백엔드 CartBulkRowDto·CartBulkRowResult·CartBulk*Result 와 1:1 (trade/dto)

export type BuyStatus = "AVAILABLE" | "UNAVAILABLE" | "FAILED";

/** 서버가 주고받는 한 줄. 수량도 글자로 (엑셀 칸이 글자여도 줄 오류로 보이게). sellerId·regDate = 사용자가 고른 매물 */
export interface CartBulkRowApi {
  rowNo: number;
  prodId: string | null;
  prodName: string | null;
  prodBrand: string | null;
  prodClassNo: string | null;
  orderQuantity: string | null;
  reqDeliDate: string | null;
  remarks: string | null;
  sellerId: string | null;
  regDate: string | null;
  /** 조건 칸 — 모두 선택, 비우면 조건 없음. need* 는 "Y" 만 의미가 있다 (그 증빙이 매물에 있어야 함) */
  minState: string | null;
  maxPrice: string | null;
  minWarrantyMonths: string | null;
  needDataSheet: string | null;
  needPhoto: string | null;
  needCoverage: string | null;
  needTestReport: string | null;
  needCertificate: string | null;
}

/** 조건을 통과한 매물 중 기본으로 고르는 기준 (서버 CartBulkSort). 모든 줄에 하나가 적용된다 */
export type BuySort = "price" | "state" | "warranty";

/** 매물 상태·보증일·증빙 유무 (파일 키는 없다). warrantyDays 가 null 이면 보증 없음 */
export interface ListingTraits {
  prodState: string | null;
  warrantyDays: number | null;
  hasDataSheet: boolean;
  hasPhoto: boolean;
  hasWarrantyCoverage: boolean;
  hasTestReport: boolean;
  hasCertificate: boolean;
}

/**
 * 매물 한 건. reason = 하드 막힘(null 이면 살 수 있고, 있으면 못 사는 사유 — 못 고름). mismatches = 조건과 다른 점(상태·단가·보증·서류·제공가능일)
 * — 비어 있지 않아도 사용자가 알고 고를 수 있고, 기본 매물로는 안 뽑힌다
 */
export interface ListingOption {
  sellerId: string;
  regDate: string;
  sellerNickname: string | null;
  unitPrice: number;
  stock: number;
  minOrder: number;
  orderUnit: number;
  deliveryDate: string | null;
  replaceHint: string | null;
  reason: string | null;
  mismatches: string[];
  traits: ListingTraits;
}

export interface Alternative {
  prodId: string;
  prodName: string;
  prodBrand: string;
  options: ListingOption[];
}

export interface BuyCandidate {
  prodId: string;
  prodName: string;
  prodBrand: string;
  prodClassNo: string | null;
}

export interface CartBulkResult {
  rowNo: number;
  status: BuyStatus;
  prodId: string | null;
  matchedName: string | null;
  chosen: ListingOption | null;
  options: ListingOption[];
  alternatives: Alternative[];
  candidates: BuyCandidate[];
  notices: string[];
  /** 칸 이름(CartBulkRowApi 의 키) 또는 listing(고른 매물) → 사유 */
  fields: Record<string, string>;
  substituted: boolean;
}

export interface CartBulkParseResponse {
  rows: CartBulkRowApi[];
  results: CartBulkResult[];
  cartCount: number;
  cartMax: number;
}

export interface CartBulkCheckResponse {
  results: CartBulkResult[];
  cartCount: number;
  cartMax: number;
}

/** 담기 결과 한 줄 — 입력 줄과 같은 개수·순서 */
export interface CartBulkOutcome {
  rowNo: number;
  ok: boolean;
  code: string | null;
  message: string | null;
}

export interface CartBulkCommitResponse {
  results: CartBulkOutcome[];
  cartCount: number;
}
