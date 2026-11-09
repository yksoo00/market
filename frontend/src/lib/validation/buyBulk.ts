import { z } from "zod";
import { isValidDate } from "@/lib/search";
import { PROD_STATES } from "@/lib/validation/listing";
import { buyBulk } from "@/messages/buyBulk";

// 엑셀 대량구매 줄 한 개의 입력 규칙. 수치는 백엔드 CartBulkService(수량 1~100,000 · 요청사항 100자 · 납품희망일 오늘 이후)와 같다.
// 어느 매물을 살 수 있는지·마스터를 찾는 일은 서버가 판단한다 — 여기선 형식과 범위만 즉시 알려 준다.
const v = buyBulk.validation;

export const MAX_QUANTITY = 100_000;
export const MAX_REMARKS = 100;
/** 단가 상한의 범위 — 매물 등록단가 최대(10억)와 같다 (서버 CartBulkConditions.MAX_PRICE) */
export const MAX_PRICE = 1_000_000_000;
/** 고를 수 있는 최소 보증 개월 — 매물의 보증기한 선택지(30·90·180·360·720·1080일)에 대응한다 */
export const WARRANTY_MONTHS = [1, 3, 6, 12, 24, 36] as const;

/** 줄의 칸. 화면 입력값이라 전부 글자 (빈 칸 = ""). sellerId·regDate = 사용자가 고른 매물(없으면 서버가 기본을 정한다) */
export type BuyFields = {
  prodId: string;
  prodName: string;
  prodBrand: string;
  prodClassNo: string;
  orderQuantity: string;
  reqDeliDate: string;
  remarks: string;
  sellerId: string;
  regDate: string;
  /** 조건 칸 — 비우면 조건 없음. need* 는 "Y"(있어야 함) 또는 "" */
  minState: string;
  maxPrice: string;
  minWarrantyMonths: string;
  needDataSheet: string;
  needPhoto: string;
  needCoverage: string;
  needTestReport: string;
  needCertificate: string;
};

/** 증빙 필수 칸 (Y/빈칸) */
export const BUY_EVIDENCE_FIELDS = ["needDataSheet", "needPhoto", "needCoverage", "needTestReport", "needCertificate"] as const satisfies readonly (keyof BuyFields)[];

/** 줄의 "조건" 구역에 보이는 순서 */
export const BUY_CONDITION_FIELDS = ["minState", "maxPrice", "minWarrantyMonths", ...BUY_EVIDENCE_FIELDS] as const satisfies readonly (keyof BuyFields)[];

export type BuyConditionField = (typeof BUY_CONDITION_FIELDS)[number];

/** 조건이 하나라도 걸려 있는지 (접힌 구역의 요약 배지용) */
export const conditionCount = (f: BuyFields): number => BUY_CONDITION_FIELDS.filter((k) => f[k].trim() !== "").length;

/** 화면에 입력 칸으로 보이는 순서 */
export const BUY_INPUT_FIELDS = ["prodName", "prodBrand", "prodClassNo", "orderQuantity", "reqDeliDate", "remarks"] as const satisfies readonly (keyof BuyFields)[];

export type BuyInputField = (typeof BUY_INPUT_FIELDS)[number];

/** 쉼표("1,000")는 허용하고, 부호·소수점·지수는 거부 */
const digits = (s: string) => s.replace(/,/g, "").trim();
const intIn = (s: string, min: number, max: number) => /^\d+$/.test(digits(s)) && Number(digits(s)) >= min && Number(digits(s)) <= max;

const text = (max: number, message: string) => z.string().trim().max(max, message);

const needFlag = z
  .string()
  .trim()
  .refine((s) => s === "" || s.toUpperCase() === "Y", v.need);

/** today = 한국 날짜 YYYY-MM-DD. 납품희망일의 하한 */
function buyRowSchema(today: string) {
  return z
    .object({
      prodId: z.string(),
      prodName: text(50, v.prodName),
      prodBrand: text(40, v.prodBrand),
      prodClassNo: text(20, v.prodClassNo),
      orderQuantity: z
        .string()
        .trim()
        .min(1, v.required)
        .refine((s) => intIn(s, 1, MAX_QUANTITY), v.orderQuantity),
      reqDeliDate: z
        .string()
        .trim()
        .min(1, v.required)
        .refine((s) => isValidDate(s), v.date)
        .refine((s) => !isValidDate(s) || s >= today, v.reqDeliDate),
      remarks: text(MAX_REMARKS, v.remarks),
      sellerId: z.string(),
      regDate: z.string(),
      minState: z
        .string()
        .trim()
        .refine((s) => s === "" || (PROD_STATES as readonly string[]).includes(s), v.minState),
      maxPrice: z
        .string()
        .trim()
        .refine((s) => s === "" || intIn(s, 1, MAX_PRICE), v.maxPrice),
      minWarrantyMonths: z
        .string()
        .trim()
        .refine((s) => s === "" || (WARRANTY_MONTHS as readonly number[]).includes(Number(s)), v.minWarrantyMonths),
      needDataSheet: needFlag,
      needPhoto: needFlag,
      needCoverage: needFlag,
      needTestReport: needFlag,
      needCertificate: needFlag,
    })
    .superRefine((d, ctx) => {
      // 마스터를 고르면(prodId) 상품 칸은 마스터가 기준이라 비워도 된다 (서버 CartBulkService 와 같다). 제조사는 선택 — 비우면 이름만으로 찾는다
      if (d.prodId.trim() === "" && d.prodName.trim() === "") {
        ctx.addIssue({ code: "custom", path: ["prodName"], message: v.required });
      }
    });
}

/** 칸 이름 → 첫 오류 문구. 통과하면 빈 객체 */
export function validateBuyRow(fields: BuyFields, today: string): Record<string, string> {
  const parsed = buyRowSchema(today).safeParse(fields);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
