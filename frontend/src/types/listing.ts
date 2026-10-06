export type ListingType = "sell" | "buy";
export type SellerKind = "individual" | "business";

export interface ListingSummary {
  id: string;
  type: ListingType;
  title: string;
  category: string;
  quantity: number;
  /** 원 단위. 가격 미정(제안·견적 요청)은 null */
  price: number | null;
  priceUnit?: string;
  sellerKind: SellerKind;
  createdAt: string;
}

export type TradeStatus = "available" | "completed";

/** POST /api/v1/listings 요청. 백엔드 ListingCreateRequest 와 1:1 (선택 필드는 보내지 않으면 서버 기본값) */
export interface ListingCreateRequest {
  categoryCode: string;
  prodName: string;
  prodNo?: string;
  prodBrand: string;
  /** yyyyMMdd */
  prodMufcDate?: string;
  prodSpecInfo?: string;
  productDataSheet?: string;
  tradeType: string;
  /** 드롭다운 구간 값 (lib/validation/listing PROD_STATES) */
  prodState: string;
  salesUnitPrice: number;
  salesQuantity: number;
  minOrderQuantity?: number;
  orderUnit?: number;
  /** YYYY-MM-DD */
  deliveryDate?: string;
  stockQuantity?: number;
  description?: string;
  /** 업로드 키 (POST /api/v1/uploads 응답) */
  listingDataSheet?: string;
  photos?: string[];
}

/** 등록 응답(ListingResponse) 중 상세 화면으로 이동하는 데 쓰는 키만. 전체 응답 타입은 상세 화면 작업이 정의한다 */
export interface ListingCreated {
  userId: string;
  regDate: string;
}

/** POST /api/v1/uploads 의 kind 중 매물 등록 폼이 쓰는 것 */
export type ListingUploadKind = "listing-photo" | "listing-datasheet";

/** 검색 결과 행. 백엔드 검색 API를 만들 때 DTO를 이와 1:1로 맞춘다 */
export interface ListingSearchItem {
  userId: string;
  /** yyyyMMddHHmmss. userId와 함께 매물 식별자 */
  regDate: string;
  /** 상품번호(제조사 번호) */
  prodNo: string | null;
  prodName: string;
  prodBrand: string;
  category: string;
  /** 제조일 YYYY-MM-DD (products.prod_mufc_date) */
  mufcDate: string | null;
  /** 상품설명 (listings.prod_description) */
  prodDescription: string | null;
  hasDataSheet: boolean;
  hasPhoto: boolean;
  // 아래 5개는 등록 후 추가등록(PATCH)으로만 채워져 비어 있는 경우가 흔하다 (PR #17)
  /** 보증기한 YYYY-MM-DD. DB는 일수(warranty_period)라 백엔드가 등록일 + 일수로 계산해 내려준다 */
  warrantyUntil: string | null;
  /** 불량지원방법 (warranty_coverage: 대체/환불) */
  warrantyCoverage: string | null;
  hasReplaceProd: boolean;
  hasTestReport: boolean;
  hasCertificate: boolean;
  /** 상품상태 자유 텍스트 (예: 양호, 신품대비 90%) */
  prodState: string;
  stockQuantity: number | null;
  salesUnitPrice: number;
  /** YYYY-MM-DD */
  deliveryDate: string | null;
  /** 백엔드는 dt_expire가 비면 available, 있으면 completed (decisions.md 2026-10-01) */
  tradeStatus: TradeStatus;
}

/** 검색 API 한 페이지. total 은 같은 조건의 전체 개수(커서와 무관) */
export interface ListingSearchPage {
  items: ListingSearchItem[];
  nextCursor: string | null;
  total: number;
}

/** 매물 상세. 백엔드 ListingResponse 와 1:1 */
export interface ListingDetail {
  userId: string;
  /** yyyyMMddHHmmss */
  regDate: string;
  prodId: string;
  prodName: string;
  prodBrand: string;
  prodNo: string | null;
  prodSpecInfo: string | null;
  tradeType: string;
  prodState: string;
  salesUnitPrice: number;
  salesQuantity: number;
  minOrderQuantity: number;
  orderUnit: number;
  /** YYYY-MM-DD */
  deliveryDate: string | null;
  stockQuantity: number | null;
  description: string | null;
  /** 저장소 키 */
  listingDataSheet: string | null;
  /** 저장소 키 0~4개 */
  photos: string[];
  warrantyPeriod: number | null;
  warrantyCoverage: string | null;
  replaceProd: string | null;
  testReport: string | null;
  certificateOfAuthen: string | null;
  dtUpdate: string | null;
  dtExpire: string | null;
  category: string;
  /** YYYY-MM-DD. 날짜로 읽히지 않는 레거시 값은 원문 그대로 */
  mufcDate: string | null;
  tradeStatus: TradeStatus;
  /** 등록일 + 보증 일수, YYYY-MM-DD */
  warrantyUntil: string | null;
}

/** PATCH /api/v1/listings/{userId}/{regDate} 요청. 백엔드 ListingUpdateRequest 와 1:1 — 생략 = 안 바꿈, 파일·납기일·설명 칸의 "" = 비우기 */
export interface ListingUpdateRequest {
  prodState?: string;
  salesUnitPrice?: number;
  salesQuantity?: number;
  minOrderQuantity?: number;
  orderUnit?: number;
  deliveryDate?: string;
  stockQuantity?: number;
  description?: string;
  listingDataSheet?: string;
  photos?: string[];
  /** 일수. 화면은 개월 드롭다운(개월 × 30) */
  warrantyPeriod?: number;
  /** 대체 / 환불. "" = 비우기 */
  warrantyCoverage?: string;
  replaceProd?: string;
  testReport?: string;
  certificateOfAuthen?: string;
}
