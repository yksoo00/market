import { z } from "zod";
import { isValidDate } from "@/lib/search";
import { listing } from "@/messages/listing";

// 매물 등록 폼. 수치는 docs/security.md "입력 검증 > 매물"이 원본이고 백엔드 ListingCreateRequest 와 같다.
// 칸은 문자열로 받고(빈 칸 = 미입력) 출력에서 숫자·undefined 로 바꾼다 (searchFilter 와 같은 방식).
const v = listing.validation;

export const MAX_PRICE = 1_000_000_000;
export const MAX_QUANTITY = 100_000;
export const MAX_PHOTOS = 4;
export const MAX_DESCRIPTION = 200;

/**
 * 상품상태 드롭다운 값 = 저장 값. 백엔드 ListingCreateRequest.PROD_STATE_PATTERN 과 같은 목록 (2026-10-06).
 * 위쪽은 10% 단위로 촘촘하게(100%와 80%대를 한 구간으로 묶으면 차이가 너무 커서), 50% 미만은 하나로
 */
export const PROD_STATES = [
  "신품",
  "신품대비 90~99%",
  "신품대비 80~89%",
  "신품대비 70~79%",
  "신품대비 60~69%",
  "신품대비 50~59%",
  "신품대비 50% 미만",
] as const;

const requiredText = (max: number, message: string) => z.string().trim().min(1, v.required).max(max, message);
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((s) => (s === "" ? undefined : s));

/** 숫자만(쉼표·부호·소수점·공백 거부). Number("1e3") 같은 우회를 막으려고 정규식으로 본다 */
export const isInt = (s: string) => /^\d+$/.test(s);
const requiredInt = (min: number, max: number, message: string) =>
  z
    .string()
    .min(1, v.required)
    .refine((s) => isInt(s) && Number(s) >= min && Number(s) <= max, message)
    .transform(Number);
const optionalInt = (min: number, max: number, message: string) =>
  z
    .string()
    .refine((s) => s === "" || (isInt(s) && Number(s) >= min && Number(s) <= max), message)
    .transform((s) => (s === "" ? undefined : Number(s)));

const optionalDate = z
  .string()
  .refine((s) => s === "" || isValidDate(s), v.date)
  .transform((s) => (s === "" ? undefined : s));

/** today = 한국 날짜 YYYY-MM-DD (lib/listingForm todayInSeoul). 제조일·납기일 범위의 기준 */
export function listingFormSchema(today: string) {
  return z
    .object({
      categoryCode: requiredText(10, v.categoryCode),
      prodName: requiredText(50, v.prodName),
      prodBrand: requiredText(50, v.prodBrand),
      prodNo: optionalText(20, v.prodNo),
      prodMufcDate: optionalDate,
      prodSpecInfo: optionalText(100, v.prodSpecInfo),
      prodState: z.string().refine((s) => (PROD_STATES as readonly string[]).includes(s), v.prodState),
      salesUnitPrice: requiredInt(0, MAX_PRICE, v.salesUnitPrice),
      salesQuantity: requiredInt(1, MAX_QUANTITY, v.salesQuantity),
      stockQuantity: optionalInt(0, MAX_QUANTITY, v.stockQuantity),
      minOrderQuantity: optionalInt(1, MAX_QUANTITY, v.minOrderQuantity),
      orderUnit: optionalInt(1, MAX_QUANTITY, v.orderUnit),
      deliveryDate: optionalDate,
      description: optionalText(MAX_DESCRIPTION, v.description),
      photos: z.array(z.string()).max(MAX_PHOTOS, v.photos),
      listingDataSheet: z.string().transform((s) => (s === "" ? undefined : s)),
    })
    // zod 4는 칸 검사가 실패해도 이 단계를 돈다 → 값이 이미 변환된 타입일 때만 비교한다
    .superRefine((d, ctx) => {
      if (typeof d.minOrderQuantity === "number" && typeof d.salesQuantity === "number" && d.minOrderQuantity > d.salesQuantity) {
        ctx.addIssue({ code: "custom", path: ["minOrderQuantity"], message: v.minOrderOverSales });
      }
      // YYYY-MM-DD 문자열은 사전순 = 날짜순
      if (typeof d.prodMufcDate === "string" && d.prodMufcDate > today) {
        ctx.addIssue({ code: "custom", path: ["prodMufcDate"], message: v.prodMufcDate });
      }
      if (typeof d.deliveryDate === "string" && d.deliveryDate < today) {
        ctx.addIssue({ code: "custom", path: ["deliveryDate"], message: v.deliveryDate });
      }
    });
}

export type ListingFormInput = z.input<ReturnType<typeof listingFormSchema>>;
export type ListingFormOutput = z.output<ReturnType<typeof listingFormSchema>>;

export const emptyListingForm: ListingFormInput = {
  categoryCode: "",
  prodName: "",
  prodBrand: "",
  prodNo: "",
  prodMufcDate: "",
  prodSpecInfo: "",
  prodState: "",
  salesUnitPrice: "",
  salesQuantity: "",
  stockQuantity: "",
  minOrderQuantity: "",
  orderUnit: "",
  deliveryDate: "",
  description: "",
  photos: [],
  listingDataSheet: "",
};
