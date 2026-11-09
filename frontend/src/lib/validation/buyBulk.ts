import { z } from "zod";
import { isValidDate } from "@/lib/search";
import { buyBulk } from "@/messages/buyBulk";

// 엑셀 대량구매 줄 한 개의 입력 규칙. 수치는 백엔드 CartBulkService(수량 1~100,000 · 요청사항 100자 · 납품희망일 오늘 이후)와 같다.
// 어느 매물을 살 수 있는지·마스터를 찾는 일은 서버가 판단한다 — 여기선 형식과 범위만 즉시 알려 준다.
const v = buyBulk.validation;

export const MAX_QUANTITY = 100_000;
export const MAX_REMARKS = 100;

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
};

/** 화면에 입력 칸으로 보이는 순서 */
export const BUY_INPUT_FIELDS = ["prodName", "prodBrand", "prodClassNo", "orderQuantity", "reqDeliDate", "remarks"] as const satisfies readonly (keyof BuyFields)[];

export type BuyInputField = (typeof BUY_INPUT_FIELDS)[number];

/** 쉼표("1,000")는 허용하고, 부호·소수점·지수는 거부 */
const digits = (s: string) => s.replace(/,/g, "").trim();
const intIn = (s: string, min: number, max: number) => /^\d+$/.test(digits(s)) && Number(digits(s)) >= min && Number(digits(s)) <= max;

const text = (max: number, message: string) => z.string().trim().max(max, message);

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
    })
    .superRefine((d, ctx) => {
      // 마스터를 고르면(prodId) 상품 칸은 마스터가 기준이라 비워도 된다 (서버 CartBulkService 와 같다)
      if (d.prodId.trim() === "") {
        if (d.prodName.trim() === "") ctx.addIssue({ code: "custom", path: ["prodName"], message: v.required });
        if (d.prodBrand.trim() === "") ctx.addIssue({ code: "custom", path: ["prodBrand"], message: v.required });
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
