import { PROD_STATES } from "@/lib/validation/listing";
import type { ListingDetail, ListingUpdateRequest } from "@/types/listing";

type ProdState = (typeof PROD_STATES)[number];

/**
 * DB 에 저장된 상품상태 → 드롭다운 값. 목록 값이면 그대로, 옛 형식 "신품대비 N%"(2026-10-06 이전)는 N 이 속한 구간으로,
 * 그 밖("양호"·"new" 등)은 빈 값 — 사용자가 다시 고르게 한다.
 */
export function prodStateFromStored(stored: string): ProdState | "" {
  const listed = PROD_STATES.find((s) => s === stored);
  if (listed) return listed;
  const m = /^신품대비 ([1-9]\d?|100)%$/.exec(stored);
  if (!m) return "";
  const n = Number(m[1]);
  if (n >= 100) return "신품";
  if (n >= 90) return "신품대비 90~99%";
  if (n >= 80) return "신품대비 80~89%";
  if (n >= 70) return "신품대비 70~79%";
  if (n >= 60) return "신품대비 60~69%";
  if (n >= 50) return "신품대비 50~59%";
  return "신품대비 50% 미만";
}

/** 수정 폼의 입력 상태. 숫자 칸은 문자열(빈 칸 = 미입력), 파일 칸은 업로드 키("" = 없음) */
export interface ListingEditValues {
  prodState: string;
  salesUnitPrice: string;
  salesQuantity: string;
  stockQuantity: string;
  minOrderQuantity: string;
  orderUnit: string;
  deliveryDate: string;
  description: string;
  photos: string[];
  listingDataSheet: string;
}

const str = (n: number | null) => (n === null ? "" : String(n));

export function editInitialValues(d: ListingDetail): ListingEditValues {
  return {
    prodState: prodStateFromStored(d.prodState),
    salesUnitPrice: str(d.salesUnitPrice),
    salesQuantity: str(d.salesQuantity),
    stockQuantity: str(d.stockQuantity),
    minOrderQuantity: str(d.minOrderQuantity),
    orderUnit: str(d.orderUnit),
    deliveryDate: d.deliveryDate ?? "",
    description: d.description ?? "",
    photos: [...d.photos],
    listingDataSheet: d.listingDataSheet ?? "",
  };
}

const numberFields = ["salesUnitPrice", "salesQuantity", "stockQuantity", "minOrderQuantity", "orderUnit"] as const;
const textFields = ["prodState", "deliveryDate", "description", "listingDataSheet"] as const;

/**
 * 처음 값과 달라진 칸만 PATCH 요청으로. 안 바뀐 칸은 키를 생략한다(서버는 null·생략 = 안 바꿈).
 * 그래서 상태를 안 건드리면 옛 형식 값이 DB 에 그대로 남고, 지운 칸(납기일·설명·데이터시트)은 ""(비우기)로 간다.
 * current 는 검증을 통과한 값이다 (숫자 칸은 숫자 문자열).
 */
export function diffToUpdateRequest(initial: ListingEditValues, current: ListingEditValues): ListingUpdateRequest {
  const req: ListingUpdateRequest = {};
  for (const key of numberFields) {
    if (initial[key] !== current[key]) req[key] = Number(current[key]);
  }
  for (const key of textFields) {
    if (initial[key] !== current[key]) req[key] = current[key];
  }
  // 배열은 순서도 비교 — 첫 장이 대표 사진이다
  if (initial.photos.join("|") !== current.photos.join("|")) req.photos = [...current.photos];
  return req;
}
