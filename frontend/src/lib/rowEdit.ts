import { z } from "zod";
import { daysToMonths, monthsToDays } from "@/lib/listingExtra";
import { prodStateFromStored } from "@/lib/listingEdit";
import { isValidDate } from "@/lib/search";
import { MAX_DESCRIPTION } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";
import type { ListingDetail, ListingSearchItem, ListingUpdateRequest } from "@/types/listing";

// 내 판매글 표의 행 안 수정 (스펙 2026-10-06-my-listings). 표에 있는 칸: 상품명·상품번호·제조사·제조일·상품상태·보증기간·
// 불량지원 + 행 아래 폼으로 고치는 상품설명·데이터시트·사진·대체품·테스트리포트·정품인증서. 저장은 바뀐 칸만 PATCH 한 번.
const v = listing.validation;

/** 입력 상태. 텍스트 칸은 문자열(빈 문자열 = 없음), 파일 칸은 업로드 키("" = 없음), 제조일은 YYYY-MM-DD */
export interface RowEditValues {
  prodName: string;
  prodBrand: string;
  prodNo: string;
  prodMufcDate: string;
  prodState: string;
  warrantyMonths: number;
  warrantyCoverage: string;
  description: string;
  photos: string[];
  listingDataSheet: string;
  replaceProd: string;
  testReport: string;
  certificateOfAuthen: string;
}

export function rowEditInitialValues(d: ListingDetail): RowEditValues {
  return {
    prodName: d.prodName,
    prodBrand: d.prodBrand,
    prodNo: d.prodNo ?? "",
    prodMufcDate: d.mufcDate ?? "",
    prodState: prodStateFromStored(d.prodState),
    warrantyMonths: daysToMonths(d.warrantyPeriod),
    warrantyCoverage: d.warrantyCoverage ?? "",
    description: d.description ?? "",
    photos: [...d.photos],
    listingDataSheet: d.listingDataSheet ?? "",
    replaceProd: d.replaceProd ?? "",
    testReport: d.testReport ?? "",
    certificateOfAuthen: d.certificateOfAuthen ?? "",
  };
}

/** 제조일 입력(YYYY-MM-DD) → 서버 형식(yyyyMMdd). 비우기("")는 그대로 */
const toServerDate = (iso: string) => iso.replaceAll("-", "");

const trimmedFields = ["prodName", "prodBrand", "prodNo", "description"] as const;
const plainFields = ["prodState", "warrantyCoverage", "listingDataSheet", "replaceProd", "testReport", "certificateOfAuthen"] as const;

/**
 * 처음 값과 달라진 칸만 PATCH 요청으로 (안 바뀐 칸은 키 생략 — 옛 형식 상태값·옛 보증 일수를 서버에 다시 보내지 않는다).
 * 앞뒤 공백은 잘라서 비교·전송한다(폼이 어차피 잘라 보내므로 공백만 바꾼 걸 바뀜으로 보면 [저장]이 켜지는데 보낼 게 없다).
 * 지운 칸은 ""(비우기). 보증은 "개월"이 바뀌었을 때만 일수로 보낸다.
 */
export function diffToRowPatch(initial: RowEditValues, current: RowEditValues): ListingUpdateRequest {
  const req: ListingUpdateRequest = {};
  for (const key of trimmedFields) {
    const now = current[key].trim();
    if (initial[key].trim() !== now) req[key] = now;
  }
  if (initial.prodMufcDate !== current.prodMufcDate) req.prodMufcDate = toServerDate(current.prodMufcDate);
  for (const key of plainFields) {
    if (initial[key] !== current[key]) req[key] = current[key];
  }
  if (initial.warrantyMonths !== current.warrantyMonths) req.warrantyPeriod = monthsToDays(current.warrantyMonths);
  // 배열은 순서도 비교 — 첫 장이 대표 사진이다
  if (initial.photos.join("|") !== current.photos.join("|")) req.photos = [...current.photos];
  return req;
}

/** 칸 검사 규칙 (zod). 수치는 등록·수정 폼과 같다 (docs/security.md "입력 검증 > 매물") */
const rowEditSchema = (today: string) =>
  z.object({
    prodName: z.string().trim().min(1, v.required).max(50, v.prodName),
    prodBrand: z.string().trim().min(1, v.required).max(50, v.prodBrand),
    prodNo: z.string().trim().max(20, v.prodNo),
    // 비우기("")는 통과. YYYY-MM-DD 문자열은 사전순 = 날짜순
    prodMufcDate: z.string().superRefine((s, ctx) => {
      if (s === "") return;
      if (!isValidDate(s)) ctx.addIssue({ code: "custom", message: v.date });
      else if (s > today) ctx.addIssue({ code: "custom", message: v.prodMufcDate });
    }),
    description: z.string().trim().max(MAX_DESCRIPTION, v.description),
  });

const CHECKED_FIELDS = ["prodName", "prodBrand", "prodNo", "prodMufcDate", "description"] as const;

/**
 * 칸별 오류 문구(없으면 {}). **처음 값에서 바뀐 칸만** 본다 — 옛 데이터(날짜로 안 읽히는 제조일, 50자를 넘는 이름)가 그 칸을
 * 안 건드린 수정까지 막지 않게 (서버도 저장값과 같은 날짜·납기일은 건너뛴다). 상품상태는 검사하지 않는다 — 고르지 않았으면
 * diff 가 보내지 않으므로 서버 값이 그대로 남는다. today = 한국 날짜 YYYY-MM-DD (제조일은 오늘까지)
 */
export function validateRowEdit(initial: RowEditValues, values: RowEditValues, today: string): Record<string, string> {
  const result = rowEditSchema(today).safeParse(values);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || errors[field]) continue;
    if (!(CHECKED_FIELDS as readonly string[]).includes(field)) continue;
    if (initial[field as (typeof CHECKED_FIELDS)[number]] === values[field as (typeof CHECKED_FIELDS)[number]]) continue;
    errors[field] = issue.message;
  }
  return errors;
}

/** 저장 응답(상세)으로 표의 행을 갱신한다. 새 상품으로 옮겨졌으면 그 상품 값이 오고, 파일 칸은 표가 유무만 보여 준다 */
export function applyDetailToItem(item: ListingSearchItem, d: ListingDetail): ListingSearchItem {
  return {
    ...item,
    prodNo: d.prodNo,
    prodName: d.prodName,
    prodBrand: d.prodBrand,
    category: d.category,
    mufcDate: d.mufcDate,
    prodDescription: d.description,
    hasDataSheet: d.listingDataSheet !== null,
    hasPhoto: d.photos.length > 0,
    warrantyUntil: d.warrantyUntil,
    warrantyCoverage: d.warrantyCoverage,
    hasReplaceProd: d.replaceProd !== null,
    hasTestReport: d.testReport !== null,
    hasCertificate: d.certificateOfAuthen !== null,
    prodState: d.prodState,
    stockQuantity: d.stockQuantity,
    salesUnitPrice: d.salesUnitPrice,
    deliveryDate: d.deliveryDate,
    tradeStatus: d.tradeStatus,
  };
}
