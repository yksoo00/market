import { z } from "zod";
import { normalizeDate } from "@/lib/date";
import { MAX_DESCRIPTION, MAX_PRICE, MAX_QUANTITY, PROD_STATES } from "@/lib/validation/listing";
import { listing } from "@/messages/listing";

// 엑셀 다량 등록 줄 한 개의 입력 규칙. 수치는 매물 등록 폼(validation/listing.ts)·백엔드 ListingCreateRequest 와 같다.
// 서버가 마스터를 찾는 일(prodId·후보·신규 마스터)은 여기서 판단하지 않는다 — 형식과 범위만 즉시 알려 준다.
const v = listing.validation;

/** 줄의 칸. 화면 입력값이라 전부 글자 (빈 칸 = "") */
export type BulkFields = {
  prodId: string;
  prodName: string;
  prodBrand: string;
  prodClassNo: string;
  prodNo: string;
  categoryCode: string;
  prodState: string;
  salesUnitPrice: string;
  salesQuantity: string;
  minOrderQuantity: string;
  orderUnit: string;
  deliveryDate: string;
  description: string;
};

/** 화면에 입력 칸으로 보이는 순서. prodId 는 후보를 골랐을 때만 채워지는 숨은 칸 */
export const BULK_INPUT_FIELDS = [
  "prodName",
  "prodBrand",
  "prodClassNo",
  "prodNo",
  "categoryCode",
  "prodState",
  "salesUnitPrice",
  "salesQuantity",
  "minOrderQuantity",
  "orderUnit",
  "deliveryDate",
  "description",
] as const satisfies readonly (keyof BulkFields)[];

export type BulkInputField = (typeof BULK_INPUT_FIELDS)[number];

/** 엑셀·서버와 같이 쉼표("1,000")는 허용하고, 부호·소수점·지수는 거부 */
const toDigits = (s: string) => s.replace(/,/g, "").trim();
const intIn = (s: string, min: number, max: number) => /^\d+$/.test(toDigits(s)) && Number(toDigits(s)) >= min && Number(toDigits(s)) <= max;

const text = (max: number, message: string) => z.string().trim().max(max, message);
const requiredInt = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1, v.required)
    .refine((s) => intIn(s, min, max), message);
const optionalInt = (min: number, max: number, message: string) => z.string().trim().refine((s) => s === "" || intIn(s, min, max), message);

/** today = 한국 날짜 YYYY-MM-DD. 제공가능일의 하한 */
function bulkRowSchema(today: string) {
  return z
    .object({
      prodId: z.string(),
      prodName: text(50, v.prodName),
      prodBrand: text(40, v.prodBrand),
      prodClassNo: text(20, v.prodClassNo),
      prodNo: text(20, v.prodNo),
      categoryCode: text(12, v.categoryCode),
      prodState: z.string().refine((s) => (PROD_STATES as readonly string[]).includes(s), v.prodState),
      salesUnitPrice: requiredInt(0, MAX_PRICE, v.salesUnitPrice),
      salesQuantity: requiredInt(1, MAX_QUANTITY, v.salesQuantity),
      minOrderQuantity: optionalInt(1, MAX_QUANTITY, v.minOrderQuantity),
      orderUnit: optionalInt(1, MAX_QUANTITY, v.orderUnit),
      deliveryDate: z
        .string()
        .trim()
        .min(1, v.required)
        .refine((s) => normalizeDate(s) !== null, v.date)
        .refine((s) => (normalizeDate(s) ?? "9999-12-31") >= today, v.deliveryDate),
      description: text(MAX_DESCRIPTION, v.description),
    })
    .superRefine((d, ctx) => {
      // 후보를 골라 prodId 가 있으면 상품 칸은 마스터가 기준이라 비워도 된다 (서버 ListingBulkService 와 같다)
      if (d.prodId.trim() === "") {
        if (d.prodName.trim() === "") ctx.addIssue({ code: "custom", path: ["prodName"], message: v.required });
        if (d.prodBrand.trim() === "") ctx.addIssue({ code: "custom", path: ["prodBrand"], message: v.required });
      }
      if (intIn(d.minOrderQuantity, 1, MAX_QUANTITY) && intIn(d.salesQuantity, 1, MAX_QUANTITY)) {
        if (Number(toDigits(d.minOrderQuantity)) > Number(toDigits(d.salesQuantity))) {
          ctx.addIssue({ code: "custom", path: ["minOrderQuantity"], message: v.minOrderOverSales });
        }
      }
    });
}

/** 칸 이름 → 첫 오류 문구. 통과하면 빈 객체 */
export function validateBulkRow(fields: BulkFields, today: string): Record<string, string> {
  const parsed = bulkRowSchema(today).safeParse(fields);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}

/** 이 모달은 .xlsx 만 받는다 (서버가 .xls 를 읽지 않는다). 확장자 검사는 올리자마자 */
export function isXlsx(file: File): boolean {
  return file.name.toLowerCase().endsWith(".xlsx");
}
